import { useId, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// The core action, made tactile. The field stays crisp; the gooey SVG-filter
// merge is reserved for the "Check" reagent — a droplet buds off it and
// reabsorbs while focused (a nod to the litmus/chemistry metaphor). Always a
// real, paste-friendly input.
export function GooeyUrlInput({
  value,
  onChange,
  onSubmit,
  loading = false,
  error,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading?: boolean
  error?: string | null
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className={cn('w-full', className)}>
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id={`goo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <form onSubmit={handleSubmit}>
        <label htmlFor={`url-${id}`} className="sr-only">
          YouTube Shorts link
        </label>

        <div
          className={cn(
            'relative flex h-14 items-center rounded-full border bg-card pl-5 pr-2 transition-colors',
            focused ? 'border-blue/60 ring-2 ring-blue/15' : 'border-border',
          )}
        >
          <input
            id={`url-${id}`}
            type="url"
            inputMode="url"
            enterKeyHint="go"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste a YouTube Shorts link…"
            className="tabnums h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-base text-ink outline-none placeholder:text-faint"
          />

          {/* gooey reagent: button + droplet share the goo filter so the drop
              stretches off the button like liquid */}
          <div className="relative flex h-10 items-center" style={{ filter: `url(#goo-${id})` }}>
            {focused && !loading && (
              <motion.span
                aria-hidden
                className="absolute left-1 top-1/2 size-3 -translate-y-1/2 rounded-full bg-blue-strong"
                animate={{ x: [0, -14, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-blue-strong px-6 font-mono text-sm font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-blue disabled:cursor-default disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Testing
                </>
              ) : (
                'Check'
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-refuted">
          {error}
        </p>
      )}
    </div>
  )
}
