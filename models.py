from pydantic import BaseModel
from typing import Optional, Literal

# --- Building blocks ---

class Segment(BaseModel):
    start_s: float
    end_s: float
    speech: Optional[str] = None
    on_screen_text: Optional[str] = None

class Claim(BaseModel):
    id: str
    text: str          # rewritten to stand alone
    verbatim: str       # what was actually said
    start_s: float
    end_s: float
    claim_type: str     # e.g. "statistic", "event", "quote", "prediction"
    checkable: bool
    entities: list[str] = []

class Evidence(BaseModel):
    url: str
    title: str
    publisher: Optional[str] = None
    date: Optional[str] = None

class ClaimVerdict(BaseModel):
    claim_id: str
    verdict: Literal["supported", "disputed", "refuted", "unverified", "not_checkable"]
    confidence: float
    reasoning: str
    evidence: list[Evidence] = []
    evidence_source: Literal["factcheck_api", "grounding_metadata", "schema_fallback", "none"]

class Extraction(BaseModel):
    language: str
    summary: str
    segments: list[Segment] = []
    claims: list[Claim] = []
    context_mismatch: Optional[str] = None
    manipulation_signals: list[str] = []
    injection_attempt: bool = False

class MatchingImage(BaseModel):
    url: str
    page_url: Optional[str] = None
    date: Optional[str] = None

class Provenance(BaseModel):
    pages_with_matching_images: int = 0
    full_matching_images: list[MatchingImage] = []
    partial_matching_images: list[MatchingImage] = []
    likely_recycled: bool = False

class Score(BaseModel):
    percentage: Optional[int] = None   # None when denominator == 0
    refuted: int = 0
    disputed: int = 0
    unverified: int = 0
    supported: int = 0
    not_checkable: int = 0
    checkable_total: int = 0
    limited_evidence: bool = False     # true when unverified > checkable_total / 2

# --- Top level ---

class AnalysisResult(BaseModel):
    job_id: str
    status: Literal["queued", "extracting", "verifying", "tracing", "done", "failed"]
    video_id: str
    video_url: str
    start_s: Optional[float] = None
    end_s: Optional[float] = None
    extraction: Optional[Extraction] = None
    verdicts: list[ClaimVerdict] = []
    provenance: Optional[Provenance] = None
    score: Optional[Score] = None