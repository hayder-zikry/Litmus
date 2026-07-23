import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'
import type { Score } from './types'

const CX = 100
const CY = 100
const R = 76 // needle length

// The concern-score instrument: a spectrum arc + a needle that sweeps to its
// reading. The needle tip is computed by trig (no CSS transform-origin), so it
// always pivots exactly at the hub. When evidence is thin, the number recedes.
export function ScoreGauge({ score, className }: { score: Score; className?: string }) {
  const reduce = useReducedMotion()
  const pct = score.percentage ?? 0
  const limited = score.limited_evidence

  // math angle: pct 0 → 180° (left), pct 100 → 0° (right)
  const targetTheta = 180 - pct * 1.8
  const theta = useMotionValue(reduce ? targetTheta : 180)
  useEffect(() => {
    if (reduce) return
    const controls = animate(theta, targetTheta, { duration: 1.1, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [targetTheta, reduce, theta])
  const nx = useTransform(theta, (t) => CX + R * Math.cos((t * Math.PI) / 180))
  const ny = useTransform(theta, (t) => CY - R * Math.sin((t * Math.PI) / 180))

  if (score.percentage === null || score.percentage === undefined) {
    return (
      <div className={cn('text-center', className)}>
        <div className="font-mono text-sm text-muted">No checkable claims found.</div>
        <p className="mx-auto mt-2 max-w-xs text-sm text-faint">
          Nothing in this video could be fact-checked against evidence.
        </p>
      </div>
    )
  }

  const breakdown = [
    score.refuted > 0 && `${score.refuted} refuted`,
    score.disputed > 0 && `${score.disputed} disputed`,
    score.unverified > 0 && `${score.unverified} unverified`,
    score.supported > 0 && `${score.supported} supported`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        {limited ? 'Limited evidence available' : 'Concern score'}
      </div>

      <div className="relative mt-3">
        <svg viewBox="0 0 200 116" className="w-[220px]" role="img" aria-label={`Concern score ${pct} percent`}>
          <defs>
            <linearGradient id="litmus-arc" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--supported)" />
              <stop offset="0.5" stopColor="var(--disputed)" />
              <stop offset="1" stopColor="var(--refuted)" />
            </linearGradient>
          </defs>
          {/* track */}
          <path
            d="M 14 100 A 86 86 0 0 1 186 100"
            fill="none"
            stroke="var(--track)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* spectrum */}
          <path
            d="M 14 100 A 86 86 0 0 1 186 100"
            fill="none"
            stroke="url(#litmus-arc)"
            strokeWidth="16"
            strokeLinecap="round"
            opacity={limited ? 0.32 : 0.95}
          />
          {/* needle (tip computed by trig) */}
          <motion.line
            x1={CX}
            y1={CY}
            x2={nx}
            y2={ny}
            stroke="var(--ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r="7" fill="var(--ink)" stroke="var(--card)" strokeWidth="3" />
        </svg>
      </div>

      <div className="mt-1 flex w-[220px] justify-between px-1 font-mono text-[10px] tracking-[0.04em] text-faint">
        <span>Trustworthy</span>
        <span>Concern</span>
      </div>

      <div
        className={cn(
          'tabnums mt-4 font-mono font-semibold leading-none',
          limited ? 'text-4xl text-muted' : 'text-6xl text-ink',
        )}
      >
        {pct}
        <span className={cn('align-top', limited ? 'text-xl' : 'text-2xl text-muted')}>%</span>
      </div>

      <div className="mt-3 max-w-xs text-center text-sm text-muted">
        {breakdown || 'no flags'}
        <span className="text-faint"> · of {score.checkable_total} checkable {score.checkable_total === 1 ? 'claim' : 'claims'}</span>
      </div>

      {limited && (
        <p className="mt-2 max-w-sm text-center text-sm text-faint">
          Most of this video can't be verified. Treat the score as weak — that's the honest read.
        </p>
      )}
    </div>
  )
}
