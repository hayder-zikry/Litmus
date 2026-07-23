import asyncio
import logging
import os
import random
import string
import threading
import time
from collections import deque

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import cache
import jobs
import models
import provenance as provenance_module
import score as score_module
import verify
from extract import canonical_watch_url, extract, parse_video_id

log = logging.getLogger("main")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # No cookies/auth exist anywhere in this API, so credentials are never needed. Leaving this
    # True while allow_origins=["*"] is a known anti-pattern (invalid per the CORS spec, and
    # some setups end up echoing the caller's origin instead of rejecting the combination).
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str
    start_s: float | None = None
    end_s: float | None = None


def make_job_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


# Rate limit on the EXPENSIVE path only (a cache miss triggering a real Gemini/Vision run).
# Cache hits are free and stay unlimited -- someone re-checking a known video should never be
# throttled. This API is public and unauthenticated, so without this, anyone who finds the URL
# could spam new videos and burn through real API quota/cost.
RATE_LIMIT_MAX_NEW = 5
RATE_LIMIT_WINDOW_S = 60
_recent_new_analyses = deque()
_rate_lock = threading.Lock()


def _rate_limited() -> bool:
    """True if we're already at the cap for new (uncached) analyses this window."""
    now = time.time()
    with _rate_lock:
        while _recent_new_analyses and now - _recent_new_analyses[0] > RATE_LIMIT_WINDOW_S:
            _recent_new_analyses.popleft()
        if len(_recent_new_analyses) >= RATE_LIMIT_MAX_NEW:
            return True
        _recent_new_analyses.append(now)
        return False


def run_pipeline(job_id: str, video_id: str, canonical_url: str,
                  start_s: float | None, end_s: float | None) -> None:
    """The real pipeline: extract -> verify -> provenance -> score, updating status between
    stages. Runs in a background thread (FastAPI/Starlette does this automatically for a sync
    BackgroundTasks target), so a blocking call here does not block the event loop."""
    try:
        jobs.update_status(job_id, "extracting")
        extraction = extract(canonical_url, start_s, end_s)
        jobs.update_status(job_id, "verifying", extraction=extraction)

        verdicts = asyncio.run(verify.verify_claims(extraction.claims))
        jobs.update_status(job_id, "tracing", verdicts=verdicts)

        provenance = provenance_module.provenance(video_id)
        score = score_module.compute_score(extraction.claims, verdicts)

        finished = jobs.update_status(job_id, "done", provenance=provenance, score=score)
        cache.set(finished)
    except Exception:
        log.exception("pipeline failed for job_id=%s", job_id)
        jobs.update_status(job_id, "failed")


@app.get("/health")
def health():
    # Note: /healthz is intercepted by Google's front-end infrastructure and never
    # reaches the app, so we serve the health check at /health instead.
    return {"ok": True}


@app.delete("/cache")
def clear_cache(x_admin_key: str | None = Header(default=None)):
    """Wipe every cached result so the next /analyze for any video re-runs the full
    pipeline. Useful during dev/demo prep since this instance's disk (and cache/) stays
    alive across requests -- a local file delete on your machine never reaches it.

    Guarded by a shared secret: without it, anyone who finds the URL could wipe the
    seeded demo cache right before a presentation. Set ADMIN_KEY as an env var and pass
    it back as the X-Admin-Key header."""
    admin_key = os.environ.get("ADMIN_KEY")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="missing or invalid X-Admin-Key header")
    removed = cache.clear()
    return {"cleared": removed}


@app.post("/analyze")
def analyze(payload: AnalyzeRequest, background_tasks: BackgroundTasks):
    try:
        video_id = parse_video_id(payload.url)
    except ValueError:
        raise HTTPException(status_code=400, detail="could not parse a YouTube video id from that url")

    canonical_url = canonical_watch_url(video_id)
    job_id = make_job_id()

    cached = cache.get(video_id, payload.start_s, payload.end_s)
    if cached is not None:
        jobs.store(job_id, cached)
        return {"job_id": job_id, "status": cached.status}

    if _rate_limited():
        raise HTTPException(
            status_code=429,
            detail=f"Too many new videos right now (max {RATE_LIMIT_MAX_NEW} per "
                   f"{RATE_LIMIT_WINDOW_S}s). Try again shortly, or a video that's already "
                   f"been checked.",
        )

    jobs.create_job(job_id, video_id, canonical_url, payload.start_s, payload.end_s)
    background_tasks.add_task(run_pipeline, job_id, video_id, canonical_url, payload.start_s, payload.end_s)
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="no such job")
    return job


# Serves the built React frontend (frontend/dist/, built via `npm run build`) from this same
# Cloud Run service. Mounted LAST so it only catches what the routes above didn't -- /health,
# /analyze, /jobs/{id} still resolve to their own handlers first.
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")