import { ExternalLink, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Claim, ClaimVerdict } from './types'
import { VerdictChip } from './VerdictChip'
import { EVIDENCE_SOURCE_LABEL, VERDICT_META, fmtTime } from './verdict'

export function ClaimCard({
  claim,
  verdict,
  onSeek,
  className,
}: {
  claim?: Claim
  verdict: ClaimVerdict
  onSeek?: (seconds: number) => void
  className?: string
}) {
  const text = claim?.text ?? verdict.claim_id
  const meta = VERDICT_META[verdict.verdict]
  const hasEvidence = verdict.evidence && verdict.evidence.length > 0

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-card-2/70 p-4 transition-colors hover:bg-card-2',
        className,
      )}
    >
      {/* verdict spectrum marker (swatch, not a heavy border) */}
      <span
        aria-hidden
        className="absolute left-0 top-4 h-8 w-1 rounded-full"
        style={{ backgroundColor: meta.color }}
      />

      <div className="flex items-start justify-between gap-3 pl-3">
        <VerdictChip verdict={verdict.verdict} size="sm" />
        {claim && onSeek && (
          <button
            type="button"
            onClick={() => onSeek(claim.start_s)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-white/5 hover:text-blue focus-visible:bg-white/5"
            aria-label={`Jump to ${fmtTime(claim.start_s)} in the video`}
          >
            <Clock className="size-3" aria-hidden />
            <span className="tabnums">{fmtTime(claim.start_s)}</span>
          </button>
        )}
      </div>

      <p className="mt-2 pl-3 text-[15px] font-medium leading-snug text-ink text-balance">{text}</p>

      {verdict.reasoning && (
        <p className="mt-1.5 pl-3 text-sm leading-relaxed text-muted">{verdict.reasoning}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-3">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint"
          title={`How this verdict was sourced: ${EVIDENCE_SOURCE_LABEL[verdict.evidence_source]}`}
        >
          {EVIDENCE_SOURCE_LABEL[verdict.evidence_source]}
        </span>

        {hasEvidence &&
          verdict.evidence.map((e, i) => (
            <a
              key={i}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1.5 text-sm text-blue underline-offset-2 hover:underline focus-visible:underline"
            >
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{e.publisher || e.title || new URL(e.url).hostname}</span>
            </a>
          ))}
      </div>
    </div>
  )
}
