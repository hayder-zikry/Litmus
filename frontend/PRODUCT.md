# Litmus — Product Truth

## What it is
Litmus is a web app that fact-checks short-form video (YouTube Shorts). Paste a link → it returns the factual **claims** the video makes, each checked against **real published evidence** (Google Fact Check API + Gemini `google_search` grounding), with live source URLs, timed to the moment each claim is spoken. It also **traces the footage** (Cloud Vision reverse-image search) to flag recycled clips passed off as new.

Built for a Google/Gemini hackathon.

## The one thing it owns
**Verifiability, not opinion.** The model is only ever asked what the video *claims*; whether a claim is *true* is answered by retrieved evidence a human can open. Every verdict traces to a URL. The killer differentiator vs. "just a Gemini wrapper" is measurable: a low **dead-link rate** and **correct abstention** (returns `unverified` when no evidence exists instead of hallucinating a verdict).

## Users
Anyone fact-checking a viral Short — media-literacy-minded general public. Also, at the demo table: hackathon judges. The interface must earn trust in seconds and survive the question "isn't this a wrapper?"

## Core ethos (load-bearing for design)
**Credibility over confidence. The UI must look weak when the evidence is weak.** When most of a video can't be verified, lead with "Limited evidence available" and de-emphasize the score. This honesty is the most credible thing the UI can do — never dress up thin evidence as certainty.

## Verdict vocabulary
`supported` · `disputed` · `refuted` · `unverified` · `not_checkable`.
Score = `(refuted + 0.5·disputed) / checkable_total`, shown only ever *with* its breakdown; never a bare percentage.

## Surfaces
1. **Website** — landing (Persuade: convert a curious visitor into pasting a link) + the analysis tool (Operate: read the verdict). Deployed to static hosting.
2. **Chrome extension** — an on-page panel that auto-analyzes the Short you dwell on. Same design system, compact.

## Scope now
Frontend only. Build against the mock `AnalysisResult` (`src/litmus/mock.ts`) with the real Cloud Run API client wired (`src/litmus/api.ts`); `?mock=1` demos offline.

## Constraints / commitments
- Verdicts always carry an openable source link.
- YouTube Shorts only; embeds via the IFrame Player API (click a claim → seek).
- Brand commitment: the **litmus pH-strip spectrum** (rose→amber→blue) and **IBM Plex** type are preserved from the incumbent identity — deliberately, for the lab/measurement register.
