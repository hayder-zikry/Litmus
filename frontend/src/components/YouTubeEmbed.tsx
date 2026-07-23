import { useImperativeHandle, useRef, type Ref } from 'react'
import { cn } from '@/lib/utils'

export interface YouTubePlayerHandle {
  seekTo: (seconds: number) => void
}

// Shorts are vertical (9:16). Uses the IFrame API over postMessage so claim
// cards can seek the player without loading the full YT SDK.
export function YouTubeEmbed({
  videoId,
  ref,
  className,
}: {
  videoId: string
  ref?: Ref<YouTubePlayerHandle>
  className?: string
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      win.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), '*')
      win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*')
    },
  }))

  return (
    <div
      className={cn(
        'relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-black shadow-2xl',
        className,
      )}
    >
      <iframe
        ref={iframeRef}
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&playsinline=1`}
        title="Video being fact-checked"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
