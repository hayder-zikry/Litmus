import { History, ImageOff, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Provenance } from './types'

function earliestDate(p: Provenance): string | null {
  const dates = [...p.full_matching_images, ...p.partial_matching_images]
    .map((m) => m.date)
    .filter((d): d is string => !!d)
    .sort()
  return dates[0] ?? null
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

export function ProvenancePanel({ provenance, className }: { provenance: Provenance; className?: string }) {
  const total = provenance.pages_with_matching_images
  const earliest = earliestDate(provenance)

  if (provenance.likely_recycled) {
    return (
      <div
        className={cn('rounded-xl border p-4', className)}
        style={{ borderColor: 'rgba(242,169,80,0.35)', background: 'rgba(242,169,80,0.06)' }}
      >
        <div className="flex items-start gap-3">
          <History className="mt-0.5 size-5 shrink-0 text-disputed" aria-hidden />
          <div>
            <h3 className="font-semibold text-ink">This footage appears recycled</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The same imagery was already online
              {earliest ? (
                <>
                  {' '}
                  as early as <span className="text-ink">{fmtDate(earliest)}</span>
                </>
              ) : null}
              , predating this upload — so it may be old footage presented as new.
            </p>
            <p className="mt-2 font-mono text-[11px] text-faint">
              <span className="tabnums text-muted">{total}</span> matching{' '}
              {total === 1 ? 'page' : 'pages'} found by reverse-image search
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (total > 0) {
    return (
      <div className={cn('flex items-start gap-3 rounded-xl border border-border bg-card-2/60 p-4', className)}>
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-supported" aria-hidden />
        <div>
          <h3 className="font-semibold text-ink">No sign of recycled footage</h3>
          <p className="mt-1 text-sm text-muted">
            Matching imagery exists online but none predates the upload.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-border bg-card-2/60 p-4', className)}>
      <ImageOff className="mt-0.5 size-5 shrink-0 text-faint" aria-hidden />
      <div>
        <h3 className="font-semibold text-ink">Footage trace inconclusive</h3>
        <p className="mt-1 text-sm text-muted">Reverse-image search returned no matches to date.</p>
      </div>
    </div>
  )
}
