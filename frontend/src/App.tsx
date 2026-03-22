import { useEffect, useState } from 'react'
import { useConfig } from './hooks/use-config'
import { WidgetRenderer } from './widgets/WidgetRenderer'
import type { WidgetConfig } from './types/config'
import AdminPanel from './admin/AdminPanel'
import LandingPage from './LandingPage'

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          // Re-acquire if the OS releases the lock (e.g. tab hidden, then visible again)
          if (document.visibilityState === 'visible') acquire()
        })
      } catch {
        // Wake Lock not supported or denied — silently ignore
      }
    }

    acquire()
    document.addEventListener('visibilitychange', acquire)

    return () => {
      document.removeEventListener('visibilitychange', acquire)
      lock?.release()
    }
  }, [])
}

// Computed once at module load — these never change during a page session.
const _hasScreen = new URLSearchParams(window.location.search).has('screen')
const _isAdminHash = window.location.hash === '#admin'

function ScreenApp() {
  useWakeLock()

  const [isAdmin, setIsAdmin] = useState(_isAdminHash)
  useEffect(() => {
    const handler = () => setIsAdmin(window.location.hash === '#admin')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const { data: config, isLoading, isError } = useConfig()

  if (isAdmin) return <AdminPanel />

  const fullscreen: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100vw', height: '100vh',
  }

  if (isLoading) return (
    <div style={{ ...fullscreen, color: 'var(--color-muted)', fontSize: '1rem', letterSpacing: '0.2em' }}>
      LOADING
    </div>
  )

  if (isError || !config) return (
    <div style={{ ...fullscreen, color: '#ff4444', fontSize: '0.9rem' }}>
      Cannot reach wall-cast backend
    </div>
  )

  const cols = config.layout?.columns ?? 12
  const rows = config.layout?.rows ?? 8
  const widgets: WidgetConfig[] = config.widgets ?? []

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        width: '100vw',
        height: '100vh',
        gap: '0.5rem',
        padding: '0.5rem',
        background: 'var(--color-bg)',
      }}
    >
      {widgets.map((widget) => (
        <div
          key={widget.id}
          style={{
            gridColumn: `${widget.col} / span ${widget.col_span}`,
            gridRow: `${widget.row} / span ${widget.row_span}`,
            height: '100%',        // stretch to fill the grid cell
            minHeight: 0,          // allow shrinking below content size
            overflow: 'hidden',
          }}
        >
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  )
}

export default function App() {
  if (!_hasScreen && !_isAdminHash) return <LandingPage />
  return <ScreenApp />
}
