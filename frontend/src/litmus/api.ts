import type { AnalysisResult, JobStatus } from './types'
import { MOCK_RESULT } from './mock'

// The live Cloud Run backend (carried over from the original web/app.js).
export const API_BASE = 'https://litmus-api-907722055477.asia-southeast1.run.app'

// Offline demo mode: ?mock=1 in the URL, or VITE_USE_MOCK=1.
export function useMock(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock')) {
    return true
  }
  return import.meta.env.VITE_USE_MOCK === '1'
}

/** Rebuild a canonical watch URL from whatever the user pasted (id, watch, or /shorts/). */
export function normalizeYouTubeUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const patterns = [
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /^([\w-]{11})$/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`
  }
  return null
}

export interface AnalyzeCallbacks {
  onStatus?: (status: JobStatus) => void
  signal?: AbortSignal
}

const POLL_MS = 2000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Kick off an analysis and poll to completion. Resolves with the final result. */
export async function analyze(
  url: string,
  cb: AnalyzeCallbacks = {},
  forceMock = false,
): Promise<AnalysisResult> {
  if (forceMock || useMock()) {
    for (const s of ['queued', 'extracting', 'verifying', 'tracing'] as JobStatus[]) {
      cb.onStatus?.(s)
      await sleep(1400)
    }
    cb.onStatus?.('done')
    return MOCK_RESULT
  }

  cb.onStatus?.('queued')
  const resp = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: cb.signal,
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail || `Server returned ${resp.status}`)
  }
  const job = await resp.json()
  return poll(job.job_id, cb)
}

async function poll(jobId: string, cb: AnalyzeCallbacks): Promise<AnalysisResult> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await fetch(`${API_BASE}/jobs/${jobId}`, { signal: cb.signal })
    const data: AnalysisResult = await resp.json()
    cb.onStatus?.(data.status)
    if (data.status === 'failed') throw new Error('Analysis failed. Try a different video.')
    if (data.status === 'done') return data
    await sleep(POLL_MS)
  }
}
