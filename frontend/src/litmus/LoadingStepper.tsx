import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { JobStatus } from './types'
import { PIPELINE_STAGES } from './statusLabels'

// Watch → Verify → Trace, advancing like an instrument running its cycle.
const ORDER: JobStatus[] = ['queued', 'extracting', 'verifying', 'tracing', 'done']

function stageState(stage: JobStatus, current: JobStatus): 'done' | 'active' | 'pending' {
  const ci = ORDER.indexOf(current)
  const si = ORDER.indexOf(stage)
  if (current === 'done' || ci > si) return 'done'
  // 'queued' counts as the first stage ('extracting') warming up
  if (ci === si || (current === 'queued' && stage === 'extracting')) return 'active'
  return 'pending'
}

export function LoadingStepper({ status }: { status: JobStatus }) {
  return (
    <ol className="mx-auto max-w-sm space-y-1">
      {PIPELINE_STAGES.map((s, i) => {
        const state = stageState(s.key, status)
        return (
          <li key={s.key} className="flex gap-4">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full border transition-colors',
                  state === 'done' && 'border-supported/50 bg-supported/15 text-supported',
                  state === 'active' && 'border-blue/50 text-blue',
                  state === 'pending' && 'border-border text-faint',
                )}
              >
                {state === 'done' ? (
                  <Check className="size-4" aria-hidden />
                ) : state === 'active' ? (
                  <motion.span
                    className="size-2.5 rounded-full bg-blue"
                    animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : (
                  <span className="size-2 rounded-full bg-current" />
                )}
              </span>
              {i < PIPELINE_STAGES.length - 1 && (
                <span className={cn('my-1 w-px flex-1', state === 'done' ? 'bg-supported/40' : 'bg-border')} />
              )}
            </div>

            {/* label */}
            <div className={cn('pb-6 pt-0.5', state === 'pending' && 'opacity-50')}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                  0{i + 1}
                </span>
                <span className="font-semibold text-ink">{s.label}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted">{s.blurb}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
