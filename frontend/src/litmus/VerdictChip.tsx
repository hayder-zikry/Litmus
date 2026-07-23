import { cn } from '@/lib/utils'
import type { Verdict } from './types'
import { VERDICT_META } from './verdict'

// Verdict shown as color AND text label — never color alone (a11y redundancy).
export function VerdictChip({
  verdict,
  className,
  size = 'md',
}: {
  verdict: Verdict
  className?: string
  size?: 'sm' | 'md'
}) {
  const m = VERDICT_META[verdict]
  return (
    <span
      className={cn(
        'inline-flex select-none items-center rounded-md font-mono font-semibold uppercase leading-none tracking-[0.04em]',
        size === 'sm' ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
        className,
      )}
      style={{ backgroundColor: m.color, color: m.ink }}
    >
      {m.label}
    </span>
  )
}
