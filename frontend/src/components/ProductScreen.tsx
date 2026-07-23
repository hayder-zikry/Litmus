import { ExternalLink } from 'lucide-react'
import { ScoreGauge } from '@/litmus/ScoreGauge'
import { VerdictChip } from '@/litmus/VerdictChip'
import { MOCK_RESULT } from '@/litmus/mock'
import { VERDICT_META } from '@/litmus/verdict'

// A self-contained mini dashboard sized for the MacBook lid. Unlike the full
// ResultsView it doesn't use viewport (lg:) breakpoints, so it lays out
// correctly inside a small container.
export function ProductScreen() {
  const flagged = MOCK_RESULT.verdicts
    .filter((v) => VERDICT_META[v.verdict].bucket === 'flagged')
    .slice(0, 2)
  const claimsById = Object.fromEntries(MOCK_RESULT.extraction.claims.map((c) => [c.id, c]))

  return (
    <div className="flex h-full w-full flex-col bg-bg">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-refuted/70" />
        <span className="size-2.5 rounded-full bg-disputed/70" />
        <span className="size-2.5 rounded-full bg-supported/70" />
        <div className="ml-3 flex-1 rounded-md bg-card px-3 py-1 font-mono text-[11px] text-muted">
          litmus.app
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 gap-4 overflow-hidden p-5">
        <div className="grid w-[220px] shrink-0 place-items-center rounded-xl border border-border bg-card/60 py-4">
          <ScoreGauge score={MOCK_RESULT.score} />
        </div>

        <div className="flex-1 space-y-2.5">
          <div className="border-b border-border pb-1.5 text-sm font-semibold text-ink">
            Flagged as misinformation
          </div>
          {flagged.map((v) => (
            <div key={v.claim_id} className="rounded-lg border border-border bg-card-2/60 p-3">
              <VerdictChip verdict={v.verdict} size="sm" />
              <p className="mt-2 text-sm leading-snug text-ink">{claimsById[v.claim_id]?.text}</p>
              {v.evidence[0] && (
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue">
                  <ExternalLink className="size-3" aria-hidden />
                  {v.evidence[0].publisher}
                </span>
              )}
            </div>
          ))}
          <div
            className="flex items-center gap-2 rounded-lg border p-3 text-xs text-muted"
            style={{ borderColor: 'rgba(242,169,80,0.35)', background: 'rgba(242,169,80,0.06)' }}
          >
            <span className="size-2 rounded-full bg-disputed" />
            Footage appears recycled — online since April 2023
          </div>
        </div>
      </div>
    </div>
  )
}
