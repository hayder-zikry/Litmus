import { cn } from '@/lib/utils'

// The pH test strip beside the wordmark — the brand in one glyph.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <span
        aria-hidden
        className="block h-5 w-2 rounded-sm"
        style={{
          background: 'linear-gradient(180deg, var(--refuted) 0%, var(--disputed) 50%, var(--supported) 100%)',
          boxShadow: '0 0 12px rgba(79,143,247,0.45)',
        }}
      />
      <span className="text-ink" translate="no">
        Litmus
      </span>
    </span>
  )
}
