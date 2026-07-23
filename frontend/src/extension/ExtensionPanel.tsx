import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { Wordmark } from '@/components/Wordmark'
import { ScoreGauge } from '@/litmus/ScoreGauge'
import { VerdictChip } from '@/litmus/VerdictChip'
import { ProvenancePanel } from '@/litmus/ProvenancePanel'
import { References } from '@/litmus/References'
import { STATUS_LABELS } from '@/litmus/statusLabels'
import { PIPELINE_STAGES } from '@/litmus/statusLabels'
import { VERDICT_META } from '@/litmus/verdict'
import type { AnalysisResult, ClaimVerdict, Evidence, JobStatus } from '@/litmus/types'

export type PanelState =
  | { kind: 'loading'; status: JobStatus }
  | { kind: 'done'; result: AnalysisResult }
  | { kind: 'error' }

export function ExtensionPanel({ state, onClose }: { state: PanelState; onClose: () => void }) {
  return (
    <div className="w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-border bg-card font-sans text-ink shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Wordmark className="text-sm" />
        <button
          onClick={onClose}
          aria-label="Dismiss Litmus"
          className="grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="max-h-[72vh] overflow-y-auto p-4">
        {state.kind === 'loading' && <Loading status={state.status} />}
        {state.kind === 'error' && (
          <p className="py-6 text-center text-sm text-muted">
            Couldn't check this one. Try again in a moment.
          </p>
        )}
        {state.kind === 'done' && <Done result={state.result} />}
      </div>
    </div>
  )
}

function Loading({ status }: { status: JobStatus }) {
  const activeIdx = Math.max(
    0,
    PIPELINE_STAGES.findIndex((s) => s.key === status),
  )
  return (
    <div className="py-4">
      <div className="text-center font-mono text-xs uppercase tracking-[0.12em] text-muted">
        {STATUS_LABELS[status]}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {PIPELINE_STAGES.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={
                i <= activeIdx ? 'font-mono text-xs text-blue' : 'font-mono text-xs text-faint'
              }
            >
              {s.label}
            </div>
            {i < PIPELINE_STAGES.length - 1 && <span className="text-faint">·</span>}
          </div>
        ))}
      </div>
      <motion.div
        className="mx-auto mt-4 h-0.5 w-40 origin-left rounded-full bg-blue/50"
        animate={{ scaleX: [0.1, 1, 0.1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

function Done({ result }: { result: AnalysisResult }) {
  const flagged = result.verdicts.filter((v) => VERDICT_META[v.verdict].bucket === 'flagged')
  const claimsById = Object.fromEntries(result.extraction.claims.map((c) => [c.id, c]))
  const refs: Evidence[] = []
  const seen = new Set<string>()
  for (const v of result.verdicts)
    for (const e of v.evidence)
      if (!seen.has(e.url)) {
        seen.add(e.url)
        refs.push(e)
      }

  return (
    <div className="space-y-4">
      <div className="scale-95">
        <ScoreGauge score={result.score} />
      </div>

      {result.provenance.likely_recycled && <ProvenancePanel provenance={result.provenance} />}

      {flagged.length > 0 && (
        <div>
          <h3 className="mb-2 border-b border-border pb-1.5 font-semibold text-ink">
            Flagged claims
          </h3>
          <div className="space-y-2">
            {flagged.map((v: ClaimVerdict) => (
              <div key={v.claim_id} className="rounded-lg border border-border bg-card-2/60 p-3">
                <VerdictChip verdict={v.verdict} size="sm" />
                <p className="mt-2 text-sm leading-snug text-ink">
                  {claimsById[v.claim_id]?.text ?? v.claim_id}
                </p>
                {v.evidence[0] && (
                  <a
                    href={v.evidence[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block truncate text-xs text-blue hover:underline"
                  >
                    {v.evidence[0].publisher || v.evidence[0].title}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {refs.length > 0 && (
        <div>
          <h3 className="mb-2 border-b border-border pb-1.5 font-semibold text-ink">Sources</h3>
          <References items={refs} />
        </div>
      )}
    </div>
  )
}
