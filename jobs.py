"""jobs.py -- in-process job status tracking.

Valid ONLY because Cloud Run is pinned to --min-instances 1 --max-instances 1: with two instances
a POST could land on one and a GET on the other, returning 404 for a real job. No Celery/Redis/
Cloud Tasks -- a job takes 20-40s, a queue is complexity nobody would see.
"""
import models

_jobs: dict[str, models.AnalysisResult] = {}


def create_job(job_id: str, video_id: str, video_url: str,
               start_s: float | None = None, end_s: float | None = None) -> models.AnalysisResult:
    job = models.AnalysisResult(
        job_id=job_id, status="queued", video_id=video_id, video_url=video_url,
        start_s=start_s, end_s=end_s,
    )
    _jobs[job_id] = job
    return job


def store(job_id: str, result: models.AnalysisResult) -> models.AnalysisResult:
    """Store a full result directly under this job_id (used for cache hits, where the whole
    result already exists and there's nothing to run in the background)."""
    stamped = result.model_copy(update={"job_id": job_id})
    _jobs[job_id] = stamped
    return stamped


def update_status(job_id: str, status: str, **fields) -> models.AnalysisResult:
    """Advance a job's status and optionally attach newly-completed fields (extraction,
    verdicts, provenance, score)."""
    job = _jobs[job_id]
    updated = job.model_copy(update={"status": status, **fields})
    _jobs[job_id] = updated
    return updated


def get_job(job_id: str) -> models.AnalysisResult | None:
    return _jobs.get(job_id)


if __name__ == "__main__":
    j = create_job("t1", "klhX42PAzsk", "https://www.youtube.com/watch?v=klhX42PAzsk")
    assert get_job("t1").status == "queued"
    print("created:", get_job("t1").status)

    update_status("t1", "extracting")
    assert get_job("t1").status == "extracting"
    print("updated:", get_job("t1").status)

    update_status("t1", "done", score=models.Score(percentage=42, checkable_total=3))
    final = get_job("t1")
    assert final.status == "done"
    assert final.score.percentage == 42
    print("final:", final.status, "score:", final.score.percentage)

    assert get_job("nonexistent") is None
    print("missing job -> None, correctly")

    print("\nPASS - job creation/update/lookup all work.")
