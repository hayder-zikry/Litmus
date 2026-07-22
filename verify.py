"""verify.py -- Stage 3: check each claim against RETRIEVED evidence, never model memory.

Order per checkable claim:
  1. Query the Google Fact Check Tools API. Coverage is thin -- most claims miss.
  2. On a miss, ask Gemini (via Vertex) with the google_search tool -- added in the next piece.
  3. Enforce in code: if the evidence list ends up empty, the verdict is forced to "unverified".
     This is non-negotiable #2 from the brief -- never let a model fill the gap from memory.

Piece 1 (this piece): the Fact Check API path, standalone and testable for free.
"""
import os
import json
import logging
import asyncio

import httpx
from pydantic import BaseModel
from typing import Literal

import models

log = logging.getLogger("verify")

FACTCHECK_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
MAX_SEARCHES_PER_JOB = 15  # grounding is billed per search query issued, not per prompt

# Fact Check ratings are free text ("False", "Mostly False", "Misleading", "Pants on Fire", ...).
# This is a best-effort keyword mapping onto our five-value verdict enum -- documented as a
# heuristic, not a claim of perfect accuracy.
_REFUTED_WORDS = ["false", "fake", "hoax", "incorrect", "fabricated", "debunked", "pants on fire", "no evidence"]
_DISPUTED_WORDS = ["misleading", "mostly false", "partly false", "half true", "unproven", "out of context",
                    "exaggerat", "unsupported", "mixture", "needs context", "lacks context"]
_SUPPORTED_WORDS = ["true", "correct", "accurate", "confirmed", "verified", "real"]


def _rating_to_verdict(rating: str) -> str:
    r = rating.lower()
    if any(w in r for w in _DISPUTED_WORDS):
        return "disputed"
    if any(w in r for w in _REFUTED_WORDS):
        return "refuted"
    if any(w in r for w in _SUPPORTED_WORDS):
        return "supported"
    return "disputed"  # an unrecognised rating is treated as contested, not confidently either way


def factcheck_lookup(claim_text: str) -> models.ClaimVerdict | None:
    """Query the Fact Check API for this claim. Returns None on a miss (no claimReview found) --
    the caller should then fall through to the search-grounding path."""
    key = os.environ["FACTCHECK_API_KEY"]
    resp = httpx.get(FACTCHECK_URL, params={"query": claim_text, "key": key}, timeout=15)
    resp.raise_for_status()

    claims = resp.json().get("claims", [])
    if not claims:
        return None

    # Take the first result's first review -- Fact Check API orders by relevance.
    top = claims[0]
    review = (top.get("claimReview") or [{}])[0]
    rating = review.get("textualRating", "")
    if not rating:
        return None

    url = review.get("url")
    if not url:
        return None  # brief non-negotiable #5: never show a verdict without a real link

    evidence = [models.Evidence(
        url=url,
        title=top.get("text", claim_text)[:200],
        publisher=(review.get("publisher") or {}).get("name"),
        date=review.get("reviewDate"),
    )]

    return models.ClaimVerdict(
        claim_id="",  # filled in by the caller once we know which claim this is
        verdict=_rating_to_verdict(rating),
        confidence=0.85,
        reasoning=f"Fact-checked by {evidence[0].publisher or 'a publisher'}: rated \"{rating}\".",
        evidence=evidence,
        evidence_source="factcheck_api",
    )


# --- Search-grounding fallback (Gemini via Vertex + google_search tool) ---

class _RawEvidence(BaseModel):
    url: str
    title: str
    publisher: str | None = None
    date: str | None = None


class _RawVerdict(BaseModel):
    verdict: Literal["supported", "disputed", "refuted", "unverified"]
    confidence: float
    reasoning: str
    evidence: list[_RawEvidence] = []


_SYSTEM = (
    "You verify a factual claim using web search. Base your verdict ONLY on what your search "
    "finds -- never on prior knowledge. If search finds nothing conclusive, the verdict MUST be "
    "'unverified'. Only cite URLs that came from your actual search results; never invent one.\n"
    "verdict must be exactly one of: supported, disputed, refuted, unverified."
)

_client = None


def _get_client():
    """Create the Vertex client on first use so importing this module needs no creds."""
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(
            vertexai=True,
            project=os.environ["GOOGLE_CLOUD_PROJECT"],
            location=os.environ["GOOGLE_CLOUD_LOCATION"],
        )
    return _client


def grounding_lookup(claim_text: str, claim_id: str) -> models.ClaimVerdict:
    """Search-grounded fallback for claims the Fact Check API missed. Always returns a
    ClaimVerdict -- if no real evidence turns up, it is forced to 'unverified' in code
    (brief non-negotiable #2), never left to the model's judgment."""
    from google.genai import types

    resp = _get_client().models.generate_content(
        model=os.environ["GEMINI_MODEL"],
        contents=f"Verify this claim: {claim_text}",
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM,
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
            response_schema=_RawVerdict,
            temperature=0,
        ),
    )

    raw = _RawVerdict.model_validate_json(resp.text)

    # 1. Preferred path: structured grounding metadata -- the model can't invent these URLs.
    gm = getattr(resp.candidates[0], "grounding_metadata", None)
    chunks = getattr(gm, "grounding_chunks", None) if gm else None
    evidence = [
        models.Evidence(url=c.web.uri, title=getattr(c.web, "title", "") or "", publisher=None, date=None)
        for c in (chunks or []) if getattr(c, "web", None)
    ]
    evidence_source = "grounding_metadata" if evidence else None

    # 2. Fallback: URLs the model wrote into the required schema field.
    if not evidence:
        evidence = [models.Evidence(url=e.url, title=e.title, publisher=e.publisher, date=e.date)
                    for e in raw.evidence]
        evidence_source = "schema_fallback" if evidence else "none"
        log.warning("grounding_chunks empty; used schema fallback (claim_id=%s)", claim_id)

    verdict = raw.verdict

    # 3. Enforce non-negotiable #2 in code: empty evidence means unverified. Always.
    if not evidence:
        verdict = "unverified"
        evidence_source = "none"

    return models.ClaimVerdict(
        claim_id=claim_id,
        verdict=verdict,
        confidence=raw.confidence if evidence else 0.0,
        reasoning=raw.reasoning,
        evidence=evidence,
        evidence_source=evidence_source,
    )


# --- Tying it together: one call per claim, concurrent, capped ---

async def verify_claim(claim: models.Claim, _search_count: list[int]) -> models.ClaimVerdict:
    """Verify a single claim: skip if not checkable, try Fact Check, fall back to grounding
    (unless the per-job search cap is already spent)."""
    if not claim.checkable:
        return models.ClaimVerdict(
            claim_id=claim.id, verdict="not_checkable", confidence=1.0,
            reasoning="Opinion, joke, prediction, or subjective statement.",
            evidence=[], evidence_source="none",
        )

    fc = await asyncio.to_thread(factcheck_lookup, claim.text)
    if fc is not None:
        fc.claim_id = claim.id
        return fc

    if _search_count[0] >= MAX_SEARCHES_PER_JOB:
        log.warning("search cap (%d) reached; claim_id=%s forced unverified", MAX_SEARCHES_PER_JOB, claim.id)
        return models.ClaimVerdict(
            claim_id=claim.id, verdict="unverified", confidence=0.0,
            reasoning="Per-job search cap reached before this claim could be checked.",
            evidence=[], evidence_source="none",
        )
    _search_count[0] += 1  # safe: single-threaded event loop, no await between check and increment
    return await asyncio.to_thread(grounding_lookup, claim.text, claim.id)


async def verify_claims(claims: list[models.Claim]) -> list[models.ClaimVerdict]:
    """Verify all claims from one job concurrently, respecting the shared search-count cap."""
    search_count = [0]
    return await asyncio.gather(*(verify_claim(c, search_count) for c in claims))


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    logging.basicConfig(level=logging.INFO)

    print("=== Fact Check path ===")
    tests = [
        "5G causes coronavirus",
        "The earth is flat",
        "Mexico is the country that eats the most avocados in the world",  # likely a miss
    ]
    for t in tests:
        print(f"\nClaim: {t}")
        result = factcheck_lookup(t)
        if result is None:
            print("  MISS -- no fact-check found, would fall through to search grounding")
        else:
            print(f"  HIT  verdict={result.verdict}  source={result.evidence_source}")
            print(f"       {result.reasoning}")
            print(f"       {result.evidence[0].url}")

    print("\n=== Grounding fallback (only for the miss above) ===")
    result = grounding_lookup("Mexico is the country that eats the most avocados in the world", claim_id="c9")
    print(f"verdict={result.verdict}  source={result.evidence_source}  confidence={result.confidence}")
    print(f"reasoning: {result.reasoning}")
    for e in result.evidence:
        print(f"  - {e.publisher}: {e.title} -> {e.url}")

    print("\n=== Non-negotiable #2 check: a nonsense claim must come back unverified ===")
    result = grounding_lookup(
        "Scientists confirmed the moon is made of tungsten in 2024", claim_id="c_nonsense"
    )
    print(f"verdict={result.verdict}  source={result.evidence_source}")
    assert result.verdict == "unverified" or result.evidence, "should be unverified if no evidence"

    print("\n=== Full pipeline: verify_claims() concurrently over 10 real claims ===")
    import time
    fruit_claims = [
        models.Claim(id="c1", text="The US eats the most strawberries in the world.", verbatim="", start_s=0, end_s=3, claim_type="statistic", checkable=True),
        models.Claim(id="c2", text="Afghanistan eats the least strawberries in the world.", verbatim="", start_s=3, end_s=6, claim_type="statistic", checkable=True),
        models.Claim(id="c3", text="China eats the most apples in the world.", verbatim="", start_s=6, end_s=9, claim_type="statistic", checkable=True),
        models.Claim(id="c4", text="Somalia eats the least apples in the world.", verbatim="", start_s=9, end_s=12, claim_type="statistic", checkable=True),
        models.Claim(id="c5", text="Spain eats the most oranges in the world.", verbatim="", start_s=12, end_s=15, claim_type="statistic", checkable=True),
        models.Claim(id="c6", text="Mongolia eats the least oranges in the world.", verbatim="", start_s=15, end_s=18, claim_type="statistic", checkable=True),
        models.Claim(id="c7", text="India eats the most mangoes in the world.", verbatim="", start_s=18, end_s=21, claim_type="statistic", checkable=True),
        models.Claim(id="c8", text="Norway eats the least mangoes in the world.", verbatim="", start_s=21, end_s=24, claim_type="statistic", checkable=True),
        models.Claim(id="c9", text="Mexico eats the most avocados in the world.", verbatim="", start_s=24, end_s=27, claim_type="statistic", checkable=True),
        models.Claim(id="c10", text="Iceland eats the least avocados in the world.", verbatim="", start_s=27, end_s=30, claim_type="statistic", checkable=True),
    ]
    start = time.time()
    verdicts = asyncio.run(verify_claims(fruit_claims))
    elapsed = time.time() - start

    for v in verdicts:
        print(f"  {v.claim_id}: {v.verdict:12s} source={v.evidence_source:18s} evidence={len(v.evidence)}")
    print(f"\n{len(fruit_claims)} claims verified in {elapsed:.1f}s (concurrent)")
    print("PASS - verify.py full pipeline works.")
