"""Spike: prove the Google Fact Check Tools API works with our key.

Run:  .venv\\Scripts\\python spikes\\spike_factcheck.py

Success looks like: status 200, and at least one claim with a publisher and a URL.
Throwaway test code — not part of the app.
"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

key = os.environ["FACTCHECK_API_KEY"]
query = "5G causes coronavirus"  # a claim that has definitely been fact-checked

resp = httpx.get(
    "https://factchecktools.googleapis.com/v1alpha1/claims:search",
    params={"query": query, "key": key},
    timeout=15,
)

print("HTTP status:", resp.status_code)

if resp.status_code != 200:
    print("FAILED — the key was rejected or the API isn't enabled. Response:")
    print(resp.text[:800])
    raise SystemExit(1)

claims = resp.json().get("claims", [])
print(f"Got {len(claims)} claims back.\n")

for c in claims[:3]:
    review = (c.get("claimReview") or [{}])[0]
    print("• claim   :", c.get("text", "")[:90])
    print("  publisher:", (review.get("publisher") or {}).get("name"))
    print("  rating   :", review.get("textualRating"))
    print("  url      :", review.get("url"))
    print()

if claims:
    print("PASS - Fact Check API works and returns real publisher + URL.")
else:
    print("No claims returned — key works but this query had no coverage. Try another query.")
