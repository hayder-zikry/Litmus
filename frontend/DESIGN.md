# Litmus — Design System

Durable visual authority. Dark-only, brief-pinned world.

## THESIS
Litmus looks like a **scientific instrument for reading truth** — a spectrophotometer / pH bench for a video feed. It refuses the generic "AI SaaS" arrangement (centered hero, three icon cards, neon glow). The pH-strip spectrum is the whole identity: every verdict is a position on a physical color gradient from acid (false) to base (true).

## OWN-WORLD
- **Ground:** deep navy-black `#0a0e18`, panels `#101a2e` with hairline `rgba(129,161,255,.14)` borders. Layered ambient radial light, never flat black.
- **The spectrum (the brand):** refuted `#ef5875` (rose/acid) → disputed `#f2a950` (amber) → supported `#4f8ff7` (blue/base); unverified `#5b6b88` (inert slate). Used as a *field* — the physical test strip, the gauge arc — not scattered accents.
- **Ink:** `#e8ecf5`; muted `#7e8ba6`; faint `#566079`.
- **Type:** IBM Plex Sans (UI/body) + IBM Plex Mono. **Mono is legitimate measurement type here** — scores, counts, verdict labels, timestamps, evidence-source tags — never costume. Display headings: Plex Sans 600/700, tight tracking, large scale. Tabular-nums on every number.
- **Motion:** instrument motion — a gauge needle that *sweeps* to its reading, a strip that develops toward its color, a stepper that advances through Watch→Verify→Trace. Exponential ease-out from an already-visible default. Honor `prefers-reduced-motion`.

## STORY
Landing (Persuade): a curious visitor sees a real Short being read by the instrument, understands "it checks claims against openable sources," and pastes a link. Results (Operate): they read the concern score, scan three verdict buckets, and can open every source / seek to the moment.

## Signature devices
- **Concern-score gauge:** conic-spectrum half-dial + sweeping needle (evolve the incumbent speedometer). Under `limited_evidence`, the number recedes and "Limited evidence available" leads.
- **Verdict chip:** color **and** text label always (never color-only) — redundant cue for accessibility.
- **Evidence-source badge:** `factcheck_api` / `grounding_metadata` / `schema_fallback` — surfaces provenance of the check itself.
- **pH test-strip** motif for the wordmark and section transitions.

## Refuse (per craft floor + this world)
- No gradient text; emphasis via weight/size.
- No same-size icon-card grid as the "how it works" structure — dramatize the pipeline instead.
- No glass/blur as mere decoration; blur only as a real instrument effect.
- No tracked uppercase eyebrow over *every* section.
- Color-coded status always paired with a text label.

## Aceternity components in play
hero-section (landing), macbook-scroll (product reveal), shaders (hero aurora in litmus hues), gooey input (the URL paste field). These serve the instrument world — retune their palettes to the spectrum; do not ship their stock demo colors.

## Tokens
Source of truth: `src/index.css` (`:root` vars + `@theme inline`). Update there; mirror durable rules here.
