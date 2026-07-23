/*
THESIS: Litmus is a scientific instrument for reading truth in a video feed —
  it refuses the AI-SaaS hero+three-cards+neon arrangement. The pH-strip spectrum
  (acid→base = false→true) is the whole identity.
OWN-WORLD: near-black navy ground, layered WebGL aurora in rose/amber/blue,
  hairline panels, IBM Plex Sans + Mono, mono reserved for measurement.
STORY: a curious visitor sees a real claim being refuted with an openable Harvard
  source in the first viewport, understands "claims checked against evidence, not
  opinion," and pastes a link.
FIRST VIEWPORT: left = kicker, headline, gooey URL intake; right = a live specimen
  panel (claim → source → refuted). Primary action sits under the headline.
FORM: instrument/lab-assay bench; brief-pinned world (no concept roll).
*/
import { ArrowRight, Link2 } from 'lucide-react'
import { motion } from 'motion/react'
import { ShaderBackground } from '@/components/ShaderBackground'
import { GooeyUrlInput } from '@/components/GooeyUrlInput'
import { Wordmark } from '@/components/Wordmark'
import { MacbookScroll } from '@/components/ui/macbook-scroll'
import { ProductScreen } from '@/components/ProductScreen'
import { ScoreGauge } from '@/litmus/ScoreGauge'
import { VerdictChip } from '@/litmus/VerdictChip'
import { ProvenancePanel } from '@/litmus/ProvenancePanel'
import { MOCK_RESULT } from '@/litmus/mock'
import { fmtTime } from '@/litmus/verdict'

interface HeroProps {
  url: string
  setUrl: (v: string) => void
  onSubmit: () => void
  loading: boolean
  error: string | null
  onSample: () => void
}

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

export function Landing(props: HeroProps) {
  return (
    <div className="relative">
      <Hero {...props} />
      <HowItWorks />
      <ProductReveal />
      <NotAWrapper />
      <ProvenanceSection />
      <FinalCta {...props} />
      <Footer />
    </div>
  )
}

/* ---------- Hero ---------- */
function Hero({ url, setUrl, onSubmit, loading, error, onSample }: HeroProps) {
  const specimen = MOCK_RESULT.verdicts[0] // celery juice → refuted (Harvard)
  const specimenClaim = MOCK_RESULT.extraction.claims[0]

  return (
    <section className="relative min-h-screen overflow-hidden">
      <ShaderBackground />
      {/* legibility scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/20 to-bg" />

      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark className="text-lg" />
        <a
          href="#how"
          className="font-mono text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
        >
          How it works
        </a>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="size-1.5 rounded-full bg-supported" />
            Misinformation, measured
          </div>

          <h1 className="mt-5 text-balance text-5xl font-bold leading-[1.02] tracking-tight text-ink sm:text-6xl">
            A pH test for your feed.
          </h1>

          <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted">
            Paste a YouTube Short. Litmus pulls out every factual claim and checks each one
            against real, published evidence — with the source link, timed to the second it's said.
          </p>

          <div className="mt-8 max-w-lg">
            <GooeyUrlInput
              value={url}
              onChange={setUrl}
              onSubmit={onSubmit}
              loading={loading}
              error={error}
            />
            <button
              onClick={onSample}
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-faint transition-colors hover:text-blue"
            >
              <Link2 className="size-3" aria-hidden />
              or run a sample analysis
            </button>
          </div>
        </div>

        {/* live specimen — proves the mechanism in the first viewport */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="relative"
        >
          <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              <span>Specimen · claim 1</span>
              <span className="tabnums">{fmtTime(specimenClaim.start_s)}</span>
            </div>
            <p className="mt-3 text-lg font-medium leading-snug text-ink text-balance">
              "{specimenClaim.text}"
            </p>
            <div className="mt-4 flex items-center gap-2">
              <VerdictChip verdict={specimen.verdict} size="sm" />
              <span className="h-px flex-1 bg-border" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{specimen.reasoning}</p>
            <a
              href={specimen.evidence[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue hover:underline"
            >
              {specimen.evidence[0].publisher} — {specimen.evidence[0].title}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>
          <p className="mt-3 pl-1 font-mono text-[11px] text-faint">
            Every verdict opens a source. That's the whole product.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------- How it works ---------- */
function HowItWorks() {
  const claims = MOCK_RESULT.extraction.claims.slice(0, 3)
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <motion.div {...fade} className="max-w-2xl">
        <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Three passes. One openable answer.
        </h2>
        <p className="mt-4 text-lg text-muted">
          The model is only ever asked what a video <em className="text-ink not-italic">claims</em>.
          Whether a claim is <em className="text-ink not-italic">true</em> is answered somewhere
          else entirely — by retrieved evidence.
        </p>
      </motion.div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {/* Watch */}
        <motion.div {...fade} className="rounded-2xl border border-border bg-card/50 p-6">
          <StageHead n="01" label="Watch" tint="var(--supported)" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Gemini watches the video and returns the exact claims it makes, each stamped to the
            moment it's spoken.
          </p>
          <ul className="mt-5 space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm text-ink">
                <span className="tabnums mt-0.5 shrink-0 font-mono text-[11px] text-faint">
                  {fmtTime(c.start_s)}
                </span>
                <span className="leading-snug">{c.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Verify */}
        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.1 }}
          className="rounded-2xl border border-border bg-card/50 p-6"
        >
          <StageHead n="02" label="Verify" tint="var(--disputed)" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Each claim goes to the Google Fact Check database, then a live web search. The verdict
            is read off the evidence — never the model's memory.
          </p>
          <div className="mt-5 rounded-xl border border-border bg-card-2/70 p-4">
            <p className="text-sm leading-snug text-ink">"{claims[0].text}"</p>
            <div className="mt-3 flex items-center gap-2">
              <VerdictChip verdict="refuted" size="sm" />
              <span className="truncate font-mono text-[11px] text-blue">health.harvard.edu ↗</span>
            </div>
          </div>
        </motion.div>

        {/* Trace */}
        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.2 }}
          className="rounded-2xl border border-border bg-card/50 p-6"
        >
          <StageHead n="03" label="Trace" tint="var(--refuted)" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            We reverse-image-search the footage itself. If the clip was online before this upload,
            we flag it — old footage sold as new.
          </p>
          <div className="mt-5">
            <ProvenancePanel provenance={MOCK_RESULT.provenance} />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function StageHead({ n, label, tint }: { n: string; label: string; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid size-9 place-items-center rounded-full font-mono text-xs font-semibold"
        style={{ background: `${tint}22`, color: tint }}
      >
        {n}
      </span>
      <span className="text-lg font-semibold text-ink">{label}</span>
    </div>
  )
}

/* ---------- MacBook product reveal ---------- */
function ProductReveal() {
  return (
    <section className="relative">
      <div className="hidden md:block">
        <MacbookScroll
          title={
            <span className="text-2xl font-bold tracking-tight text-ink">
              The whole verdict — score, claims, sources, and the footage trace.
            </span>
          }
          showGradient={false}
        >
          <ProductScreen />
        </MacbookScroll>
      </div>

      {/* mobile: no scroll gimmick, just show the results */}
      <div className="mx-auto max-w-md px-6 py-20 md:hidden">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-ink">
          The whole verdict, in one panel.
        </h2>
        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <ScoreGauge score={MOCK_RESULT.score} />
        </div>
      </div>
    </section>
  )
}

/* ---------- Not a wrapper ---------- */
function NotAWrapper() {
  const rows = [
    {
      metric: 'Dead source links',
      baseline: 'Cites URLs that 404 — plausible, unopenable',
      litmus: 'Every source retrieved from a real search, and live',
    },
    {
      metric: 'When evidence is missing',
      baseline: 'Still sounds certain — invents a verdict',
      litmus: 'Returns Unverified, and the panel looks weak on purpose',
    },
  ]
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <motion.div {...fade} className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-disputed">The hard question</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          "Isn't this just a Gemini wrapper?"
        </h2>
        <p className="mt-4 text-lg text-muted">
          No — and it's measurable. A wrapper asks a model if something is true and prints the
          answer. Litmus separates what's <em className="not-italic text-ink">claimed</em> from
          what's <em className="not-italic text-ink">verified</em>, and it's the difference you can
          count.
        </p>
      </motion.div>

      <motion.div {...fade} className="mt-12 overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-[1.2fr_1fr_1fr] items-stretch">
          <div className="border-b border-border bg-card/40 p-4" />
          <div className="border-b border-l border-border bg-card/40 p-4 font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
            A naive AI answer
          </div>
          <div className="border-b border-l border-border bg-card/40 p-4 font-mono text-[11px] uppercase tracking-[0.1em] text-supported">
            Litmus
          </div>
          {rows.map((r) => (
            <div key={r.metric} className="contents">
              <div className="border-b border-border p-4 font-medium text-ink">{r.metric}</div>
              <div className="border-b border-l border-border p-4 text-sm text-muted">{r.baseline}</div>
              <div className="border-b border-l border-border bg-supported/[0.04] p-4 text-sm text-ink">
                {r.litmus}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
      <p className="mt-4 font-mono text-xs text-faint">
        Two numbers on one slide — the proof almost no hackathon team bothers to show.
      </p>
    </section>
  )
}

/* ---------- Provenance ---------- */
function ProvenanceSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-28">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <motion.div {...fade}>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-refuted">The part nobody else has</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            It checks the footage, not just the words.
          </h2>
          <p className="mt-4 text-lg text-muted">
            A lie doesn't have to be spoken. Old disaster clips get re-uploaded as breaking news
            every day. Litmus reverse-image-searches the frames and compares dates — if the footage
            predates the upload, you'll know.
          </p>
        </motion.div>
        <motion.div {...fade} transition={{ ...fade.transition, delay: 0.1 }}>
          <ProvenancePanel provenance={MOCK_RESULT.provenance} />
        </motion.div>
      </div>
    </section>
  )
}

/* ---------- Final CTA ---------- */
function FinalCta({ url, setUrl, onSubmit, loading, error }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center md:py-32">
        <motion.div {...fade}>
          <Wordmark className="justify-center text-2xl" />
          <p className="mx-auto mt-5 max-w-md text-lg text-muted">
            Test a video before you trust it. Paste a Short and watch the strip develop.
          </p>
          <div className="mx-auto mt-8 max-w-lg text-left">
            <GooeyUrlInput
              value={url}
              onChange={setUrl}
              onSubmit={onSubmit}
              loading={loading}
              error={error}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
        <Wordmark />
        <p className="font-mono text-xs text-faint">
          Retrieved evidence, not model memory. YouTube Shorts only.
        </p>
      </div>
    </footer>
  )
}
