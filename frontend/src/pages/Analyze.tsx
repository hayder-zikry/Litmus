import { ArrowLeft, RotateCw } from 'lucide-react'
import { motion } from 'motion/react'
import { Wordmark } from '@/components/Wordmark'
import { ShaderBackground } from '@/components/ShaderBackground'
import { LoadingStepper } from '@/litmus/LoadingStepper'
import { ResultsView } from '@/litmus/ResultsView'
import { STATUS_LABELS } from '@/litmus/statusLabels'
import type { AnalysisResult, JobStatus } from '@/litmus/types'

// How far the litmus strip has "developed" at each stage.
const PROGRESS: Record<JobStatus, number> = {
  queued: 0.1,
  extracting: 0.32,
  verifying: 0.62,
  tracing: 0.86,
  done: 1,
  failed: 0,
}

export function Analyze({
  status,
  result,
  error,
  onReset,
  onRetry,
}: {
  status: JobStatus
  result: AnalysisResult | null
  error: string | null
  onReset: () => void
  onRetry: () => void
}) {
  const done = status === 'done' && result

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Check another
          </button>
          <Wordmark />
        </div>
      </header>

      {error ? (
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="mx-auto max-w-md py-24 text-center">
            <div className="mx-auto mb-5 h-8 w-2 rounded-sm bg-refuted" />
            <h1 className="text-xl font-semibold text-ink">That didn't come back.</h1>
            <p className="mt-2 text-muted">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-full bg-blue-strong px-5 py-2.5 font-mono text-sm font-semibold text-white transition-colors hover:bg-blue"
              >
                <RotateCw className="size-4" aria-hidden />
                Try again
              </button>
              <button
                onClick={onReset}
                className="rounded-full border border-border px-5 py-2.5 font-mono text-sm text-muted transition-colors hover:text-ink"
              >
                Different video
              </button>
            </div>
          </div>
        </main>
      ) : done ? (
        <motion.main
          className="mx-auto max-w-6xl px-6 py-12"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <ResultsView result={result} />
        </motion.main>
      ) : (
        <LoadingScreen status={status} />
      )}
    </div>
  )
}

function LoadingScreen({ status }: { status: JobStatus }) {
  return (
    <main className="relative isolate flex min-h-[calc(100vh-61px)] items-center justify-center overflow-hidden px-6">
      <ShaderBackground speed={0.5} className="opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/40 to-bg" />

      <div className="relative flex flex-col items-center gap-10">
        <div className="text-center">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-xs uppercase tracking-[0.16em] text-blue"
          >
            {STATUS_LABELS[status]}
          </motion.div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Testing this video</h1>
          <p className="mt-2 text-muted">Reading the claims, then checking each against the evidence.</p>
        </div>

        <div className="flex items-center gap-8 sm:gap-14">
          <DevelopingStrip status={status} />
          <LoadingStepper status={status} />
        </div>
      </div>
    </main>
  )
}

// A litmus strip developing its color as the analysis proceeds.
function DevelopingStrip({ status }: { status: JobStatus }) {
  const p = PROGRESS[status] ?? 0
  return (
    <div className="relative h-56 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-[var(--track)]">
      <motion.div
        className="absolute inset-x-0 bottom-0 rounded-full"
        style={{
          background:
            'linear-gradient(0deg, var(--supported) 0%, var(--disputed) 55%, var(--refuted) 100%)',
        }}
        initial={{ height: '0%' }}
        animate={{ height: `${p * 100}%` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* wet development front */}
        <motion.div
          className="absolute inset-x-0 top-0 h-6 -translate-y-1/2 rounded-full bg-white/40 blur-md"
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
