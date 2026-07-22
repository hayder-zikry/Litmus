"""Spike B: the biggest verification-track unknown.

Ask Gemini to search the web for evidence about a claim AND force a JSON schema with a
required `url` field. Then look at which source of URLs actually populates:

  1. grounding_metadata.web_search_queries  (did a search even happen?)
  2. grounding_metadata.grounding_chunks     (the PREFERRED path - model can't invent these)
  3. the parsed JSON evidence array          (the schema FALLBACK path)

The brief warns: when a forced schema is combined with the search tool, grounding_chunks
sometimes comes back EMPTY while web_search_queries is populated. This spike tells us which
path is real so verify.py knows where to get its URLs.

Run:  .venv\\Scripts\\python spikes\\spike_grounding.py
Throwaway test code -- not part of the app.
"""
import os
import json
from dotenv import load_dotenv
from pydantic import BaseModel
from google import genai
from google.genai import types

load_dotenv()

model = os.environ["GEMINI_MODEL"]
# Vertex AI mode: bills to the Google Cloud project (uses the free-trial credits), auth via ADC.
client = genai.Client(
    vertexai=True,
    project=os.environ["GOOGLE_CLOUD_PROJECT"],
    location=os.environ["GOOGLE_CLOUD_LOCATION"],
)

CLAIM = "Mexico is the country that eats the most avocados in the world."


class Evidence(BaseModel):
    url: str
    title: str
    publisher: str


class Result(BaseModel):
    evidence: list[Evidence]


SYSTEM = (
    "You verify claims using web search. Only report URLs that came from your search results. "
    "NEVER invent or guess a URL."
)
PROMPT = f"Search the web for evidence about this claim and return the sources you found. Claim: {CLAIM}"

print(f"Claim: {CLAIM}\nModel: {model}\n")


def run(with_schema: bool):
    config_kwargs = dict(
        tools=[types.Tool(google_search=types.GoogleSearch())],
        system_instruction=SYSTEM,
    )
    if with_schema:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = Result
    return client.models.generate_content(
        model=model,
        contents=PROMPT,
        config=types.GenerateContentConfig(**config_kwargs),
    )


# --- The brief's approach: search tool + forced schema together ---
try:
    resp = run(with_schema=True)
    mode = "search tool + forced JSON schema (combined)"
except Exception as e:
    msg = str(e)
    if "RESOURCE_EXHAUSTED" in msg or "credits" in msg or "429" in msg:
        print("BLOCKED: out of Gemini quota/credits -- this spike needs the Gemini billing sorted.")
        print("  ", msg[:250])
        raise SystemExit(2)
    print("!! Combined (search + forced schema) was REJECTED (not a quota issue):")
    print("  ", msg[:300])
    print("   -> Falling back to search-tool-only (no schema). This itself is a finding.\n")
    try:
        resp = run(with_schema=False)
        mode = "search tool only (schema rejected)"
    except Exception as e2:
        print("Fallback also failed:", str(e2)[:250])
        raise SystemExit(2)

print(f"Mode that ran: {mode}\n" + "-" * 60)

cand = resp.candidates[0]
gm = getattr(cand, "grounding_metadata", None)

queries = getattr(gm, "web_search_queries", None) if gm else None
chunks = getattr(gm, "grounding_chunks", None) if gm else None

print("1) web_search_queries:", queries)
print(f"2) grounding_chunks   : {len(chunks) if chunks else 0} chunk(s)")
if chunks:
    for c in chunks[:5]:
        web = getattr(c, "web", None)
        if web:
            print(f"     - {getattr(web, 'title', None)}  ->  {getattr(web, 'uri', None)}")

print("3) parsed schema evidence:")
try:
    parsed = json.loads(resp.text)
    ev = parsed.get("evidence", [])
    print(f"     {len(ev)} item(s)")
    for e in ev[:5]:
        print(f"     - {e.get('publisher')}: {e.get('title')} -> {e.get('url')}")
except Exception as e:
    print("     (no JSON body / not parseable:", str(e)[:120], ")")

print("-" * 60)
has_chunks = bool(chunks)
has_schema = False
try:
    has_schema = bool(json.loads(resp.text).get("evidence"))
except Exception:
    pass

if has_chunks:
    print("VERDICT: grounding_chunks IS populated -> use the PREFERRED grounding path.")
elif has_schema:
    print("VERDICT: grounding_chunks EMPTY but schema evidence present -> the FALLBACK is our real path.")
else:
    print("VERDICT: neither path returned URLs -> would become 'unverified' in verify.py.")
