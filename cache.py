"""cache.py -- on-disk result cache. JSON files in cache/, committed to the repo.

An in-memory dict loses everything on redeploy -- which is exactly when demo seeds matter most.
Keyed on (video_id, start_s, end_s), the same video is submitted many times so this is both our
biggest speed win and the demo safety net.
"""
import hashlib
import json
from pathlib import Path

import models

CACHE_DIR = Path("cache")


def _cache_key(video_id: str, start_s: float | None, end_s: float | None) -> str:
    return hashlib.sha1(f"{video_id}:{start_s}:{end_s}".encode()).hexdigest()[:16]


def _cache_path(video_id: str, start_s: float | None, end_s: float | None) -> Path:
    return CACHE_DIR / f"{_cache_key(video_id, start_s, end_s)}.json"


def get(video_id: str, start_s: float | None = None, end_s: float | None = None) -> models.AnalysisResult | None:
    """Return the cached result, or None if this (video, range) hasn't been cached yet."""
    path = _cache_path(video_id, start_s, end_s)
    if not path.exists():
        return None
    return models.AnalysisResult(**json.loads(path.read_text()))


def set(result: models.AnalysisResult) -> None:
    """Write a finished result to disk, keyed on its own video_id/start_s/end_s."""
    CACHE_DIR.mkdir(exist_ok=True)
    path = _cache_path(result.video_id, result.start_s, result.end_s)
    path.write_text(result.model_dump_json(indent=2))


if __name__ == "__main__":
    # Self-test: write a result, then read it back as if in a fresh process (proves it survives
    # a restart -- an in-memory dict could not do this).
    sample = models.AnalysisResult(
        job_id="test123", status="done", video_id="klhX42PAzsk",
        video_url="https://www.youtube.com/watch?v=klhX42PAzsk",
    )
    set(sample)
    print(f"wrote cache file: {_cache_path('klhX42PAzsk', None, None)}")

    reloaded = get("klhX42PAzsk")
    assert reloaded is not None, "cache miss right after writing"
    assert reloaded.job_id == "test123"
    print("read back after 'restart':", reloaded.job_id, reloaded.status)

    miss = get("some_other_video_id_entirely")
    assert miss is None
    print("correctly missed on an uncached video")

    # Clean up the test file so it doesn't linger as a fake demo seed.
    _cache_path("klhX42PAzsk", None, None).unlink()
    print("\nPASS - cache read/write/miss all work.")
