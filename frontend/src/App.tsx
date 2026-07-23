import { useCallback, useRef, useState } from 'react'
import { Landing } from '@/pages/Landing'
import { Analyze } from '@/pages/Analyze'
import { analyze, normalizeYouTubeUrl } from '@/litmus/api'
import type { AnalysisResult, JobStatus } from '@/litmus/types'

type Phase = 'landing' | 'analyzing'

export default function App() {
  const [phase, setPhase] = useState<Phase>('landing')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<JobStatus>('queued')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (rawUrl: string, forceMock = false) => {
    const normalized = normalizeYouTubeUrl(rawUrl)
    if (!normalized && !forceMock) {
      setError('That doesn’t look like a YouTube link. Paste a Shorts or watch URL.')
      return
    }
    setError(null)
    setResult(null)
    setStatus('queued')
    setPhase('analyzing')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await analyze(
        normalized ?? rawUrl,
        { onStatus: setStatus, signal: controller.signal },
        forceMock,
      )
      if (!controller.signal.aborted) {
        setResult(res)
        setStatus('done')
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setStatus('failed')
        setError(e instanceof Error ? e.message : 'Could not reach the server.')
      }
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase('landing')
    setError(null)
    setResult(null)
  }, [])

  if (phase === 'analyzing') {
    return (
      <Analyze
        status={status}
        result={result}
        error={error}
        onReset={reset}
        onRetry={() => run(url)}
      />
    )
  }

  return (
    <Landing
      url={url}
      setUrl={setUrl}
      onSubmit={() => run(url)}
      loading={false}
      error={error}
      onSample={() => run('https://www.youtube.com/shorts/fsyrnOkVsc0', true)}
    />
  )
}
