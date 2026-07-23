import asyncio
import logging
import random
import string

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str
    start_s: float | None = None
    end_s: float | None = None


def make_job_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


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
def clear_cache():
    """Wipe every cached result so the next /analyze for any video re-runs the full
    pipeline. Useful during dev/demo prep since this instance's disk (and cache/) stays
    alive across requests -- a local file delete on your machine never reaches it."""
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

    jobs.create_job(job_id, video_id, canonical_url, payload.start_s, payload.end_s)
    background_tasks.add_task(run_pipeline, job_id, video_id, canonical_url, payload.start_s, payload.end_s)
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="no such job")
    return job