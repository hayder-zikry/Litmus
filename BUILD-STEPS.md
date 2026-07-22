# LITMUS — Step-by-step build guide

Companion to `BRIEF.md`. The brief says *what*; this says *in what order*.

**The one rule that overrides everything:** nobody starts a workstream until Phase 1 is pushed.
Four people coding against four different guesses at the data shape is how a 48-hour project dies
at hour 30.

---

## PHASE 0 — Before the clock starts

Everyone, on their own machine. Do it the night before.

| Tool | Check | If missing |
|---|---|---|
| Python 3.11+ | `python3 --version` | python.org |
| Node.js 22+ | `node -v` | nodejs.org (frontend owner only, but install anyway) |
| Git | `git -v` | git-scm.com |
| gcloud CLI | `gcloud --version` | cloud.google.com/sdk/docs/install |
| Claude Code | `claude --version` | https://code.claude.com/docs/en/setup — **needs a paid Claude plan** |

```bash
gcloud auth login
gcloud auth application-default login
```

The second one matters — it's what lets Cloud Vision work on your laptop without a service account
key file.

**Also decide now:**
- Who owns A, B, C, D (§8 of the brief)
- Whether this is 24 or 48 hours (§14 of the brief)
- Your 3–4 demo videos, one with recycled footage

---

## PHASE 1 — Skeleton (one person, ~90 min, blocks everyone)

The person who owns workstream A does this alone. Everyone else reads the brief and picks demo
videos while waiting.

### 1.1 GCP project

```bash
gcloud projects create litmus-hack --name="Litmus"
gcloud config set project litmus-hack
```

Then in the browser at `console.cloud.google.com`:
- **Billing → link a billing account** (required — free tier won't survive four people testing)
- **Billing → Budgets & alerts → Create budget → $30, email alert**

Enable everything you'll need:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  vision.googleapis.com \
  factchecktools.googleapis.com \
  generativelanguage.googleapis.com
```

Get two API keys from **APIs & Services → Credentials → Create credentials → API key**:
- One for Gemini (or from `aistudio.google.com/apikey`)
- One for Fact Check Tools

### 1.2 Repo

```bash
mkdir litmus && cd litmus
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn google-genai google-cloud-vision httpx pydantic python-dotenv
pip freeze > requirements.txt
git init
```

Create `.gitignore` **first**, before anything else:

```
.venv/
__pycache__/
.env
*.json.key
service-account*.json
web/node_modules/
web/dist/
```

Create `Procfile`:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Create `.env` (and `.env.example` with the values blanked, which you *do* commit):

```
GEMINI_API_KEY=...
GEMINI_MODEL=...
FACTCHECK_API_KEY=...
```

### 1.3 The data contract — this is the part that unblocks everyone

If `models.py` and `example_response.json` already exist, verify they match §6 of the brief and
skip to 1.4. If not, this is the highest-priority thing in the project.

> Read BRIEF.md section 6. Create `models.py` using Pydantic models for every shape in the
> AnalysisResult tree: AnalysisResult, Extraction, Segment, Claim, ClaimVerdict, Evidence,
> Provenance, Score. Use the exact field names and the exact verdict enum values from the brief.
> Include the `evidence_source` field on ClaimVerdict.
>
> Then create `example_response.json` — a complete, realistic, fully-populated example with 4
> claims: one supported, one refuted, one disputed, one unverified. Make the URLs real ones that
> actually resolve. It must validate against models.py.
>
> Nothing else. No API code yet.

Verify it validates:

```bash
python -c "import json, models; models.AnalysisResult(**json.load(open('example_response.json'))); print('OK')"
```

### 1.4 Stub API

> Create `main.py` — a FastAPI app with:
> - `GET /healthz` returning `{"ok": true}`
> - `POST /analyze` accepting `{url, start_s?, end_s?}`, returning HTTP 202 with a random job id
> - `GET /jobs/{id}` returning the contents of example_response.json for now
> - CORSMiddleware with `allow_origins=["*"]`, all methods, all headers
>
> No real pipeline yet. This exists so the frontend has something to poll.

The CORS line is not optional. The frontend runs on a different domain and every request will fail
without it. This is the single most common integration bug in this shape of project.

Test locally:
```bash
uvicorn main:app --reload
curl localhost:8000/healthz
```

### 1.5 Deploy — ⚠️ do not skip this

```bash
gcloud run deploy litmus-api --source . \
  --region asia-southeast1 \
  --min-instances 1 --max-instances 1 \
  --no-cpu-throttling \
  --timeout 300 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=xxx,GEMINI_MODEL=xxx,FACTCHECK_API_KEY=xxx
```

First deploy takes 3–5 minutes. Then:

```bash
curl https://litmus-api-xxxxx.a.run.app/healthz
```

**If that doesn't return 200, stop and fix it now.** Deployment failing at hour 40 with a finished
app is the classic way to lose. You are eliminating that risk while `main.py` is twelve lines long.

Common first-deploy failures:

| Error | Cause |
|---|---|
| `gunicorn: command not found` or worker boot failure | No `Procfile`, or wrong contents |
| Build fails on requirements | `pip freeze` captured something platform-specific — trim it |
| 403 on deploy | `--allow-unauthenticated` missing |
| Container failed to start | App not binding `$PORT` — check the Procfile again |

### 1.6 Push

```bash
git add -A
git commit -m "skeleton: models, stub api, deploys to cloud run"
git remote add origin <your-repo>
git push -u origin main
```

**Message the team: "skeleton is up, pull and start."** Include the Cloud Run URL.

---

## PHASE 2 — Spikes (everyone, ~1 hour, in parallel)

Before anyone builds a workstream, **prove your hardest API call works in a 20-line throwaway
script.** Put them in `spikes/`. They are not production code and nobody reviews them.

The point: find out at hour 3 that an API doesn't behave how you expected, not at hour 30.

```bash
mkdir spikes
```

### Spike A — extraction (owner: whoever has extract.py)

```bash
python extract.py "https://www.youtube.com/shorts/<ID>"
```

Confirm, against current docs at ai.google.dev and not from memory:
- The model name in `GEMINI_MODEL` resolves (Gemini 1.5 and 2.0 are shut down and return 404)
- `VideoMetadata` still takes `start_offset` / `end_offset` as `"12s"` strings
- The `MediaResolution` enum spelling
- **The YouTube URL quota** — how many videos per day, what max length, and whether it differs
  between free and paid tiers

**Gate: real claims with real timestamps come back from a real Short.** If this fails, the project
does not work. Everyone stops and helps.

### Spike B — Fact Check API and grounding

Two separate scripts, both tiny.

`spikes/spike_factcheck.py`:
> Write a 20-line script that calls the Google Fact Check Tools API
> (`https://factchecktools.googleapis.com/v1alpha1/claims:search`) with a query string and the
> FACTCHECK_API_KEY, and prints the raw JSON. Test it with a claim that definitely has been
> fact-checked, like "5G causes coronavirus". Verify the response shape against the current docs.

**Gate: you get back at least one `claimReview` with a publisher and a URL.**

`spikes/spike_grounding.py`:
> Write a 30-line script using google-genai that calls Gemini with the google_search tool enabled
> and a response schema requiring an `evidence` array of `{url, title, publisher}`.
>
> Print three things separately:
> 1. `response.candidates[0].grounding_metadata.web_search_queries`
> 2. `response.candidates[0].grounding_metadata.grounding_chunks`
> 3. The parsed JSON's evidence array
>
> Check the docs at ai.google.dev for the current SDK shapes.

**Gate: you know which of #2 and #3 actually populates.** This determines how `verify.py` gets its
URLs and it's the highest-risk unknown in the whole backend. If `grounding_chunks` is empty while
`web_search_queries` is populated, that's the known failure mode — the schema fallback is your
real path. Tell the team which one fired.

### Spike C — Cloud Vision

`spikes/spike_vision.py`:
> Write a 20-line script using google-cloud-vision that runs `web_detection` on
> `https://i.ytimg.com/vi/<ID>/hq2.jpg` and prints `pages_with_matching_images`,
> `full_matching_images` and `partial_matching_images` with their URLs.
>
> Use Application Default Credentials — no service account JSON file.

**Gate: it returns matching pages for a well-known viral clip.** Pick a genuinely widespread video
for this test; an obscure one legitimately returns nothing and you'll waste an hour thinking you
broke it.

### Spike D — frontend scaffold

```bash
npm create vite@latest web -- --template react
cd web && npm install && npm run dev
```

> Fetch `example_response.json` from the project root and render the claims array as a plain list —
> claim text and verdict only, no styling. Confirm the shape matches models.py.

**Gate: the example data renders.** Workstream D is now unblocked for the next 12 hours without
needing the backend at all.

Commit all spikes. Then message the team what you learned — especially spike B.

---

## PHASE 3 — Build

Now the four tracks run independently. Each is a sequence; do them in order, test each, commit
each.

```bash
git add -A && git commit -m "verify.py: factcheck returns a hit"
```

Commit after every piece that runs. Not every hour — every piece.

### Track A — Orchestration

| # | Task | Done when |
|---|---|---|
| A1 | `cache.py` — sha1 key from `(video_id, start_s, end_s)`, read/write JSON in `cache/` | Write a dict, read it back after restarting Python |
| A2 | `jobs.py` — in-process dict, `create_job`, `update_status`, `get_job` | Job status changes are visible via `GET /jobs/{id}` |
| A3 | Wire `POST /analyze` → validate URL via `parse_video_id()` → check cache → return 202 | Cached video returns instantly with full result |
| A4 | `BackgroundTasks` pipeline calling extract → verify → provenance → score, updating status between stages | `GET /jobs/{id}` shows `extracting`, then `verifying`, then `done` |
| A5 | Write completed results to `cache/` | Second submission of the same video is instant |
| A6 | Redeploy and confirm the full flow works on Cloud Run, not just localhost | Same behaviour on the live URL |

A6 matters more than it looks. Background tasks behave differently on Cloud Run than on your
laptop, which is exactly what `--no-cpu-throttling` is for. Verify it rather than assume it.

### Track B — Verification (largest track)

| # | Task | Done when |
|---|---|---|
| B1 | `verify.py`: Fact Check API call for one claim, returning normalised `Evidence` objects | A known-checked claim returns a publisher and URL |
| B2 | Grounding fallback for misses — implement **both** extraction paths from §8B of the brief | Both paths logged; you can see which fired |
| B3 | Enforce non-negotiable #2: empty evidence → verdict overwritten to `unverified` in code | A nonsense claim returns `unverified`, not a guess |
| B4 | `asyncio.gather` across claims | 5 claims take about as long as 1 |
| B5 | Cap searches at 15 per job | Log shows the cap being respected |
| B6 | `score.py` implementing §7 exactly, including the 0.5 weight on `disputed` | Hand-check the arithmetic on one video |

B3 is the one that separates this from a wrapper. Write a test with an invented claim
("scientists confirmed the moon is made of tungsten in 2024") and confirm you get `unverified`
with an empty evidence array — not a confident refutation from model memory.

### Track C — Provenance

| # | Task | Done when |
|---|---|---|
| C1 | `provenance.py`: web_detection over `hq1/hq2/hq3.jpg`, deduped results | Matching pages returned for a viral clip |
| C2 | Include `partial_matching_images` — recycled footage is usually cropped or rescaled | Partial matches appear in output |
| C3 | Fetch each matching page's date where available; compare to the video's upload date | Dates present on at least some matches |
| C4 | Set `likely_recycled = true` when matches predate the upload | Your known-recycled demo video flags true |
| C5 | Handle 404 on `maxresdefault.jpg` as normal, and no-matches as a valid empty result | Obscure video returns empty without an exception |

C4 is your best demo moment. Make sure it fires reliably on your chosen video before you build the
UI around it.

### Track D — Frontend

| # | Task | Done when |
|---|---|---|
| D1 | Paste box → `POST /analyze` → poll `GET /jobs/{id}` every 2s → render | Works against the stub API |
| D2 | YouTube IFrame embed with `player.seekTo(seconds, true)` | Clicking a claim jumps the video |
| D3 | Claim cards: text, verdict chip, clickable source links | Links open real pages in a new tab |
| D4 | Score panel per §7 — percentage plus breakdown, never bare | "58% — 2 refuted, 1 disputed, 1 unverified, of 4 checkable" |
| D5 | The "Limited evidence available" state when `unverified > half` | Force it with hand-edited JSON and check it looks right |
| D6 | Provenance panel: matching pages, dates, recycled flag | Renders from example data |
| D7 | Litmus styling — the colour strip, grey → verdict colour | Looks deliberate |

Deploy the frontend separately to Firebase Hosting:

```bash
cd web
npm run build
firebase init hosting     # public dir: dist, SPA: yes, GitHub: no
firebase deploy --only hosting
```

Point it at the Cloud Run URL via an env var, not a hardcoded string — the backend URL will change
if you ever redeploy under a different name.

---

## PHASE 4 — Integration

Do this in one sitting with everyone present. Do not attempt it at 4am.

1. Track A swaps the stub `GET /jobs/{id}` for the real pipeline
2. Frontend points at the real Cloud Run URL
3. Run all four demo videos end to end
4. **Fix only what's broken.** No new features from this point.

Then run the eval (§12 of the brief) if you have the hours — one person, four hours, and it's the
strongest slide in the deck.

---

## PHASE 5 — Demo prep

**Seed the cache.** Run each demo video, then commit the resulting `cache/*.json` files. They ship
inside the container and survive every redeploy.

```bash
git add cache/ && git commit -m "seed demo cache" && git push
gcloud run deploy litmus-api --source . --region asia-southeast1 \
  --min-instances 1 --max-instances 1 --no-cpu-throttling
```

**Record the backup run.** One perfect pass, screen-recorded, cued in a background tab. If anything
breaks you say "let me show you the recorded run" and keep going.

**The extension button** (§11 of the brief) — 30 lines, 20 minutes, and you get to click a real
extension icon on a real YouTube page.

**Freeze code with three hours left.** Bug fixes only. Spend the time rehearsing out loud,
standing up, five times. Everyone learns the explanation in §11.

**Morning of:** redeploy, `curl /healthz`, load the frontend on your phone, then don't touch it.

---

## CLAUDE.md

Put this at the repo root. Every Claude Code session reads it.

```markdown
# Litmus — project context

Read BRIEF.md first. It is the full spec and it overrides anything you infer from the code.

## What this is
Paste a YouTube Shorts link, get back the factual claims it makes, each checked against
retrieved evidence, with live source links and timestamps.

## Stack — do not add to this list
Python 3.11 + FastAPI, deployed to Cloud Run. google-genai, google-cloud-vision, httpx, pydantic.
Frontend: React + Vite in web/, deployed to Firebase Hosting.
NO Celery. NO Redis. NO Cloud Tasks. NO Docker. NO ffmpeg. NO video downloading.

## Architecture rules you must not simplify past
1. The extraction call returns CLAIMS ONLY, never verdicts. Perception and judgment are separate
   calls on purpose.
2. Verdicts come from retrieved evidence only. Empty evidence means verdict = "unverified",
   enforced in code, not in a prompt.
3. Evidence has both a groundingMetadata path AND a schema `url` fallback. Both are required.
   The fallback is not redundant — grounding metadata sometimes returns empty.
4. The cache is JSON files on disk in cache/, committed to the repo. Never an in-memory dict.
5. The score is arithmetic (BRIEF.md §7), never a number a model produced.

## Model
Read from GEMINI_MODEL env var. Never hardcode a model name.
Gemini 1.5 and 2.0 models are SHUT DOWN and return 404.

## Before writing google-genai or google-cloud-vision code
Check current docs. These SDKs changed recently. Do not write them from memory.

## Data contract
models.py is the single source of truth. Do not change it without being told to —
four people are coding against it in parallel.

## Working style
Small changes. Test each one before continuing. Never refactor working code.
Stop and let me run it before you move to the next piece.
```

---

## THE GATES

Five moments where you stop and check rather than push forward.

| Gate | Must be true | If it isn't |
|---|---|---|
| End of Phase 1 | `/healthz` returns 200 from the Cloud Run URL | Nobody starts a track. Fix deployment. |
| Spike A | Real claims come back from a real Short | Whole team stops. This is the project. |
| Spike B | You know whether grounding metadata or the schema fallback is your real path | Track B is guessing |
| End of Track B3 | A nonsense claim returns `unverified` | You have a wrapper, not a verification system |
| 3 hours left | Code frozen | You will be debugging on stage |

---

## IF THIS IS 24 HOURS, NOT 48

Cut in this order:
1. The eval (§12) drops to 5 videos and dead-link rate only
2. The extension button
3. Timestamp seeking (D2) — show claims as a list without jumping the player
4. Track C down to C1 + C4 only — matching pages and the recycled flag, skip date scraping

**Do not cut provenance entirely.** It's the only thing in this product nobody else at the
hackathon will have.
