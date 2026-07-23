import { useMemo, useRef } from 'react'
import type { AnalysisResult, ClaimVerdict, Evidence } from './types'
import { ScoreGauge } from './ScoreGauge'
import { ClaimCard } from './ClaimCard'
import { ProvenancePanel } from './ProvenancePanel'
import { References } from './References'
import { BUCKET_META, VERDICT_META } from './verdict'
import { YouTubeEmbed, type YouTubePlayerHandle } from '@/components/YouTubeEmbed'

function bucketOf(v: ClaimVerdict) {
  return VERDICT_META[v.verdict].bucket
}

export function ResultsView({ result }: { result: AnalysisResult }) {
  const playerRef = useRef<YouTubePlayerHandle>(null)
  const claimsById = useMemo(
    () => Object.fromEntries(result.extraction.claims.map((c) => [c.id, c])),
    [result],
  )

  const buckets = useMemo(() => {
    const g = { flagged: [] as ClaimVerdict[], true: [] as ClaimVerdict[], uncheckable: [] as ClaimVerdict[] }
    for (const v of result.verdicts) g[bucketOf(v)].push(v)
    return g
  }, [result])

  const references = useMemo(() => {
    const seen = new Set<string>()
    const out: Evidence[] = []
    for (const v of result.verdicts) {
      for (const e of v.evidence) {
        if (!seen.has(e.url)) {
          seen.add(e.url)
          out.push(e)
        }
      }
    }
    return out
  }, [result])

  const onSeek = (s: number) => playerRef.current?.seekTo(s)

  const bucketOrder: (keyof typeof buckets)[] = ['flagged', 'true', 'uncheckable']

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* left rail: instrument readout + specimen */}
      <div className="lg:col-span-5 xl:col-span-4">
        <div className="lg:sticky lg:top-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <ScoreGauge score={result.score} />
          </div>
          <YouTubeEmbed videoId={result.video_id} ref={playerRef} />
          <ProvenancePanel provenance={result.provenance} />
        </div>
      </div>

      {/* right: the evidence */}
      <div className="space-y-8 lg:col-span-7 xl:col-span-8">
        {result.extraction.summary && (
          <p className="text-pretty text-[15px] leading-relaxed text-muted">
            {result.extraction.summary}
          </p>
        )}

        {bucketOrder.map((key) => {
          const items = buckets[key]
          if (items.length === 0) return null
          const meta = BUCKET_META[key]
          return (
            <section key={key} aria-labelledby={`bucket-${key}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-2">
                <h2 id={`bucket-${key}`} className="font-semibold text-ink">
                  {meta.title}
                </h2>
                <span className="tabnums shrink-0 font-mono text-xs text-faint">
                  {items.length}
                </span>
              </div>
              <p className="mb-4 text-sm text-muted">{meta.blurb}</p>
              <div className="space-y-3">
                {items.map((v) => (
                  <ClaimCard
                    key={v.claim_id}
                    verdict={v}
                    claim={claimsById[v.claim_id]}
                    onSeek={onSeek}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {references.length > 0 && (
          <section aria-labelledby="refs">
            <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-border pb-2">
              <h2 id="refs" className="font-semibold text-ink">
                Sources
              </h2>
              <span className="tabnums shrink-0 font-mono text-xs text-faint">{references.length}</span>
            </div>
            <References items={references} />
          </section>
        )}
      </div>
    </div>
  )
}
