import type { EvidenceSource, Verdict } from './types'

// Single source of truth for how each verdict looks and reads.
export const VERDICT_META: Record<
  Verdict,
  { label: string; color: string; ink: string; bucket: 'flagged' | 'true' | 'uncheckable' }
> = {
  refuted: { label: 'Refuted', color: 'var(--refuted)', ink: '#2b0510', bucket: 'flagged' },
  disputed: { label: 'Disputed', color: 'var(--disputed)', ink: '#2b1a02', bucket: 'flagged' },
  supported: { label: 'Supported', color: 'var(--supported)', ink: '#041022', bucket: 'true' },
  unverified: { label: 'Unverified', color: 'var(--unverified)', ink: '#eef1f6', bucket: 'uncheckable' },
  not_checkable: { label: 'Not checkable', color: 'var(--unverified)', ink: '#eef1f6', bucket: 'uncheckable' },
}

export const BUCKET_META = {
  flagged: {
    title: 'Flagged as misinformation',
    blurb: 'Claims that published evidence contradicts or disputes',
  },
  true: {
    title: 'Checked out',
    blurb: 'Claims evidence supports',
  },
  uncheckable: {
    title: "Couldn't verify",
    blurb: 'No published evidence either way — shown, not scored',
  },
} as const

export const EVIDENCE_SOURCE_LABEL: Record<EvidenceSource, string> = {
  factcheck_api: 'Fact Check database',
  grounding_metadata: 'Web search grounding',
  schema_fallback: 'Model-cited source',
  none: 'No source',
}

/** mm:ss for a timestamp in seconds. */
export function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
