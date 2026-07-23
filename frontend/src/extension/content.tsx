import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import cssText from '@/index.css?inline'
import { ExtensionPanel, type PanelState } from './ExtensionPanel'
import { analyze } from '@/litmus/api'

// Litmus content script — auto-checks the Short you dwell on, on the page.
// React is mounted into a Shadow DOM so YouTube's CSS can't touch the panel
// and Litmus's reset can't touch YouTube. Tokens defined on :root in index.css
// are rehomed to :host so they cascade inside the shadow tree.

const DWELL_MS = 7000 // stay on a Short this long before we spend an API call

function getShortId(): string | null {
  const m = location.pathname.match(/^\/shorts\/([\w-]+)/)
  return m ? m[1] : null
}

function Root() {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<PanelState>({ kind: 'loading', status: 'queued' })
  const currentId = useRef<string | null>(null)
  const analyzed = useRef<Set<string>>(new Set())
  const dwell = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const runAnalyze = async (id: string) => {
      setState({ kind: 'loading', status: 'queued' })
      setVisible(true)
      try {
        const res = await analyze(`https://www.youtube.com/shorts/${id}`, {
          onStatus: (s) => currentId.current === id && setState({ kind: 'loading', status: s }),
        })
        if (currentId.current === id) setState({ kind: 'done', result: res })
      } catch {
        if (currentId.current === id) setState({ kind: 'error' })
      }
    }

    // YouTube is an SPA — poll the URL and react when the Short changes.
    const tick = () => {
      const id = getShortId()
      if (id === currentId.current) return
      currentId.current = id
      clearTimeout(dwell.current)
      setVisible(false)
      if (!id || analyzed.current.has(id)) return
      dwell.current = setTimeout(() => {
        analyzed.current.add(id)
        runAnalyze(id)
      }, DWELL_MS)
    }

    const iv = setInterval(tick, 500)
    tick()
    return () => {
      clearInterval(iv)
      clearTimeout(dwell.current)
    }
  }, [])

  if (!visible) return null
  return (
    <div style={{ position: 'fixed', top: 80, right: 16, zIndex: 2147483647 }}>
      <ExtensionPanel state={state} onClose={() => setVisible(false)} />
    </div>
  )
}

function mount() {
  if (document.getElementById('litmus-ext-host')) return

  // brand fonts, registered at document level so the shadow tree can use them
  const font = document.createElement('link')
  font.rel = 'stylesheet'
  font.href =
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
  document.head.appendChild(font)

  const host = document.createElement('div')
  host.id = 'litmus-ext-host'
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = cssText.replace(/:root/g, ':host')
  shadow.appendChild(style)

  const mountEl = document.createElement('div')
  shadow.appendChild(mountEl)
  createRoot(mountEl).render(<Root />)
}

mount()
