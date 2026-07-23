import type { JobStatus } from './types'

// Human-facing progress copy (carried over from the original web/app.js).
export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued…',
  extracting: 'Watching the video…',
  verifying: 'Checking claims against evidence…',
  tracing: 'Tracing the footage…',
  done: 'Done.',
  failed: 'Something went wrong.',
}

// The pipeline stages shown in the loading stepper, in order.
export const PIPELINE_STAGES: { key: JobStatus; label: string; blurb: string }[] = [
  { key: 'extracting', label: 'Watch', blurb: 'Reading the claims the video makes' },
  { key: 'verifying', label: 'Verify', blurb: 'Checking each claim against published evidence' },
  { key: 'tracing', label: 'Trace', blurb: 'Reverse-searching the footage for reuse' },
]
