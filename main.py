import random
import string
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXAMPLE_RESPONSE = json.loads(Path("example_response.json").read_text())


def make_job_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


@app.get("/health")
def health():
    # Note: /healthz is intercepted by Google's front-end infrastructure and never
    # reaches the app, so we serve the health check at /health instead.
    return {"ok": True}

@app.post("/analyze")
def analyze(payload: dict):
    job_id = make_job_id()
    return JSONResponse(content={"job_id": job_id, "status": "queued"}, status_code=202)


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    # Stub: always return the example data regardless of job_id, so the
    # frontend can build its rendering logic before the real pipeline exists.
    result = dict(EXAMPLE_RESPONSE)
    result["job_id"] = job_id
    return result