import type { Evidence } from './types'

// Numbered source list. Every verdict Litmus shows traces to an openable URL —
// this is the ledger of them.
export function References({ items }: { items: Evidence[] }) {
  if (items.length === 0) return null
  return (
    <ol className="space-y-2">
      {items.map((e, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="tabnums shrink-0 font-mono text-xs text-faint">
            [{(i + 1).toString().padStart(2, '0')}]
          </span>
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 text-muted underline-offset-2 hover:text-blue hover:underline focus-visible:text-blue"
          >
            <span className="text-ink">{e.title || e.url}</span>
            {e.publisher && <span className="text-faint"> — {e.publisher}</span>}
          </a>
        </li>
      ))}
    </ol>
  )
}
