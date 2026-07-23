# Litmus

**a pH test for your feed**

Litmus is a fact-checker for YouTube Shorts. Paste a link and get back every factual claim the
video makes, each one checked against real published evidence, with source links timed to the
video so you can jump straight to the moment a claim was made. It also traces the footage itself —
if a clip is passed off as new but has been circulating online since 2023, Litmus flags it.

Built at a Google hackathon.

## Why it's not just a Gemini wrapper

The obvious version of this project is: send the video to an AI, ask "is this true?", print the
answer. That produces a confident paragraph nobody can verify.

Litmus splits the job in two instead:

- **The model is only ever asked what the video claims.** That's a perception task — watching and
  listening — and models are good at it. It never renders a verdict on truth.
- **Whether a claim is true is answered elsewhere** — first against a database of human
  fact-checkers, then a web search. Verdicts come from retrieved evidence, never from the model's
  own memory. If nothing is found, the result is an honest `unverified`, not a guess.

Every verdict shown traces back to a URL a human can open.

## How it works

| Step | What happens |
|---|---|
| 1. Ingest | User pastes a YouTube Shorts link; the video ID is extracted and validated. |
| 2. Extract | The **link** (not the video file) is sent to Gemini, which watches it on Google's side and returns timestamped claims. |
| 3. Verify | Each claim is checked against Google's Fact Check Tools API first, falling back to Google Search grounding if no human fact-check exists. |
| 4. Trace | A thumbnail frame is run through Cloud Vision's web detection to find other places the image has appeared, and compare dates. |
| 5. Present | A score is computed arithmetically from the verdicts and returned as JSON, rendered next to an embedded, timestamp-seekable player. |

The video file never touches the backend — Litmus sends a URL string and Google fetches and
processes it on their infrastructure. No GPU, no ffmpeg, no video libraries.

### Verdicts

| Value | Means |
|---|---|
| `supported` | Evidence backs the claim |
| `disputed` | Sources disagree, or the claim is misleading rather than outright false |
| `refuted` | A published fact-check rates it false |
| `unverified` | Searched and found nothing conclusive |
| `not_checkable` | Opinion, joke, prediction, or otherwise subjective |

### Scoring

```
checkable   = claims where checkable == true
numerator   = refuted + (0.5 * disputed)
percentage  = round(numerator / len(checkable) * 100)
```

`disputed` only counts at half weight since it means *contested*, not *false*. The percentage is
always shown with its breakdown (e.g. "2 refuted, 1 disputed, 1 unverified, of 4 checkable
claims"), never on its own. If most claims come back `unverified`, the UI leads with "Limited
evidence available" rather than a misleadingly clean number.

## Architecture

- **Backend:** Python + FastAPI, deployed on Cloud Run
- **AI / retrieval:** Gemini (via Vertex AI) for claim extraction, Google Fact Check Tools API +
  Google Search grounding for verification, Cloud Vision web detection for provenance
- **Frontend:** plain HTML/JS, talking directly to the Cloud Run backend
- **Chrome extension:** one-click "Check with Litmus" from any YouTube Shorts page
- **Jobs:** in-process background tasks (a job takes 20–40 seconds), single Cloud Run instance
- **Cache:** results are cached as JSON files committed to `cache/`, so seeded demo results
  survive redeploys

### Project structure

```
main.py         API entrypoint — /analyze, /jobs/{id}, /health, /cache
extract.py      Stage 2 — sends the video link to Gemini, returns claims
verify.py       Stage 3 — checks each claim against Fact Check API / Search grounding
provenance.py   Stage 4 — Cloud Vision web detection + date comparison
score.py        Stage 5 — arithmetic scoring over verdicts
models.py       Pydantic models — the data contract shared by backend and frontend
jobs.py         In-process job status tracking
cache.py        On-disk JSON result cache
web/            Frontend (paste-a-link UI)
extension/      Chrome extension (one-click check from a YouTube Shorts page)
spikes/         Early exploratory scripts for individual API integrations
```

## Setup

### Requirements

- Python 3.11+
- A Google Cloud project with the Vertex AI API (`aiplatform.googleapis.com`) enabled
- A Fact Check Tools API key
- A YouTube Data API key (used to reliably resolve upload dates for provenance)

### Install

```bash
git clone https://github.com/hayder-zikry/Litmus.git
cd Litmus
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### Configure

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `GEMINI_MODEL` | Gemini model used for claim extraction |
| `GOOGLE_CLOUD_PROJECT` | GCP project Gemini/Vertex AI bills to |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region |
| `FACTCHECK_API_KEY` | Google Fact Check Tools API key |
| `YOUTUBE_API_KEY` | YouTube Data API key, for reliable upload dates |
| `ADMIN_KEY` | Shared secret required to hit `DELETE /cache` |

Gemini authenticates through Vertex AI using Application Default Credentials rather than a plain
API key:

```bash
gcloud auth application-default login
```

Cloud Vision uses the same ADC.

### Run locally

```bash
uvicorn main:app --reload
```

Then open `web/index.html`, or point any HTTP client at:

```
POST /analyze          {"url": "https://www.youtube.com/shorts/..."}
GET  /jobs/{job_id}
GET  /health
```

### Deploy

Deployed to Cloud Run pinned to a single instance with CPU throttling disabled — the in-process
job store and rate limiter are only valid with exactly one instance, and background tasks need to
keep running after the HTTP response is sent:

```bash
gcloud run deploy litmus-api \
  --min-instances 1 --max-instances 1 \
  --no-cpu-throttling
```

### Chrome extension

Load `extension/` via `chrome://extensions` → Developer mode → Load unpacked. It adds a
one-click "Check with Litmus" button on any YouTube Shorts page.

## What it deliberately doesn't do

Litmus doesn't attempt deepfake or synthetic-voice detection — that's unreliable, and a false
accusation against a real person is the worst error the product could make. Instead it verifies
*attribution*: did the person actually say this, checked through the same evidence pipeline as
everything else.

## Docs

- [`BRIEF.md`](BRIEF.md) — full project spec, design rationale, and non-negotiables
- [`BUILD-STEPS.md`](BUILD-STEPS.md) — step-by-step build log
