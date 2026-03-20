import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/use-config'
import { LANGUAGE_LABELS, type Lang } from '../i18n/translations'
import type { WallConfig } from '../types/config'

/** Unlock scrolling while the admin panel is open (index.css locks html+body for the kiosk). */
function useScrollUnlock() {
  useEffect(() => {
    const html = document.documentElement
    const prev = { html: html.style.overflow, body: document.body.style.overflow }
    html.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      html.style.overflow = prev.html
      document.body.style.overflow = prev.body
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

async function saveConfig(config: WallConfig): Promise<void> {
  const res = await fetch('/api/admin/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed (${res.status}): ${text}`)
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RotateSlot {
  type: string
  config: Record<string, unknown>
  enabled?: boolean
}

function RotatorSection({
  widgetId,
  rotateConfig,
  onChange,
}: {
  widgetId: string
  rotateConfig: Record<string, unknown>
  onChange: (cfg: Record<string, unknown>) => void
}) {
  const slots = (rotateConfig.widgets as RotateSlot[]) ?? []
  const intervalSec = (rotateConfig.interval_sec as number) ?? 30

  function toggleSlot(idx: number) {
    const next = slots.map((s, i) =>
      i === idx ? { ...s, enabled: s.enabled === false ? true : false } : s
    )
    onChange({ ...rotateConfig, widgets: next })
  }

  function setInterval_(val: number) {
    onChange({ ...rotateConfig, interval_sec: val })
  }

  return (
    <section style={sectionStyle}>
      <h3 style={headingStyle}>Rotator: <code style={codeStyle}>{widgetId}</code></h3>

      <label style={labelStyle}>
        Interval (seconds)
        <input
          type="number"
          min={5}
          max={3600}
          value={intervalSec}
          onChange={e => setInterval_(Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <div style={{ marginTop: '0.75rem' }}>
        <span style={labelStyle}>Active widgets</span>
        {slots.map((slot, idx) => (
          <label key={idx} style={checkRowStyle}>
            <input
              type="checkbox"
              checked={slot.enabled !== false}
              onChange={() => toggleSlot(idx)}
              style={{ accentColor: 'var(--color-accent)', marginRight: '0.5rem' }}
            />
            <code style={codeStyle}>{slot.type}</code>
          </label>
        ))}
      </div>
    </section>
  )
}

interface NewsFeed {
  url: string
  label: string
}

function NewsSection({
  newsConfig,
  onChange,
}: {
  newsConfig: Record<string, unknown>
  onChange: (cfg: Record<string, unknown>) => void
}) {
  const feeds = (newsConfig.feeds as NewsFeed[]) ?? []

  function updateFeed(idx: number, field: keyof NewsFeed, value: string) {
    const next = feeds.map((f, i) => (i === idx ? { ...f, [field]: value } : f))
    onChange({ ...newsConfig, feeds: next })
  }

  function addFeed() {
    onChange({ ...newsConfig, feeds: [...feeds, { url: '', label: '' }] })
  }

  function removeFeed(idx: number) {
    onChange({ ...newsConfig, feeds: feeds.filter((_, i) => i !== idx) })
  }

  return (
    <section style={sectionStyle}>
      <h3 style={headingStyle}>News feeds</h3>
      {feeds.map((feed, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
          <input
            placeholder="Label"
            value={feed.label}
            onChange={e => updateFeed(idx, 'label', e.target.value)}
            style={{ ...inputStyle, width: '8rem', flexShrink: 0 }}
          />
          <input
            placeholder="RSS feed URL"
            value={feed.url}
            onChange={e => updateFeed(idx, 'url', e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <button onClick={() => removeFeed(idx)} style={dangerBtnStyle}>✕</button>
        </div>
      ))}
      <button onClick={addFeed} style={ghostBtnStyle}>+ Add feed</button>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPanel
// ---------------------------------------------------------------------------

export default function AdminPanel() {
  useScrollUnlock()
  const { data: remoteConfig, isLoading, isError } = useConfig()
  const [draft, setDraft] = useState<WallConfig | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  // Seed draft from remote config (once loaded, or when remote updates)
  useEffect(() => {
    if (remoteConfig) setDraft(deepClone(remoteConfig))
  }, [remoteConfig])

  if (isLoading || !draft) {
    return (
      <div style={{ ...pageStyle, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading config…
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ ...pageStyle, color: '#ff4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Cannot reach backend
      </div>
    )
  }

  function updateWidgetConfig(widgetId: string, newCfg: Record<string, unknown>) {
    setDraft(prev => {
      if (!prev) return prev
      return {
        ...prev,
        widgets: prev.widgets.map(w => w.id === widgetId ? { ...w, config: newCfg } : w),
      }
    })
    setSaveState('idle')
  }

  async function handleSave() {
    if (!draft) return
    setSaveState('saving')
    setSaveError('')
    try {
      await saveConfig(draft)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setSaveState('error')
    }
  }

  const rotateWidgets = draft.widgets.filter(w => w.type === 'rotate')
  const newsWidget = draft.widgets.find(w => w.type === 'news')
  const garbageWidget = draft.widgets
    .flatMap(w => w.type === 'rotate' ? (w.config.widgets as Array<{type:string;config:Record<string,unknown>}> ?? []) : [w])
    .find(w => w.type === 'garbage')

  function setLanguage(lang: string) {
    setDraft(prev => prev ? { ...prev, language: lang } : prev)
    setSaveState('idle')
  }

  function setGarbageDaysAhead(days: number) {
    // Update days_ahead in every rotate slot that contains a garbage widget
    setDraft(prev => {
      if (!prev) return prev
      return {
        ...prev,
        widgets: prev.widgets.map(w => {
          if (w.type !== 'rotate') return w
          const slots = (w.config.widgets as Array<{type:string;config:Record<string,unknown>}> ?? [])
          if (!slots.some(s => s.type === 'garbage')) return w
          return {
            ...w,
            config: {
              ...w.config,
              widgets: slots.map(s => s.type === 'garbage' ? { ...s, config: { ...s.config, days_ahead: days } } : s),
            },
          }
        }),
      }
    })
    setSaveState('idle')
  }

  const currentLang = (draft.language ?? 'nl') as Lang
  const currentDaysAhead = (garbageWidget?.config?.days_ahead as number) ?? 7

  return (
    <div style={pageStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--color-accent)', fontSize: '1.2rem', letterSpacing: '0.05em' }}>
            wall-cast admin
          </h2>
          <a href="/" style={{ color: 'var(--color-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← display
          </a>
        </div>

        {/* Language */}
        <section style={sectionStyle}>
          <h3 style={headingStyle}>Display language</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(Object.entries(LANGUAGE_LABELS) as [Lang, string][]).map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                style={currentLang === code ? primaryBtnStyle : ghostBtnStyle}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Rotate widgets */}
        {rotateWidgets.map(w => (
          <RotatorSection
            key={w.id}
            widgetId={w.id}
            rotateConfig={w.config}
            onChange={cfg => updateWidgetConfig(w.id, cfg)}
          />
        ))}

        {/* Garbage days ahead */}
        {garbageWidget && (
          <section style={sectionStyle}>
            <h3 style={headingStyle}>Garbage — days to look ahead</h3>
            <label style={labelStyle}>
              Days ahead
              <input
                type="number"
                min={1}
                max={60}
                value={currentDaysAhead}
                onChange={e => setGarbageDaysAhead(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
          </section>
        )}

        {/* News feeds */}
        {newsWidget && (
          <NewsSection
            newsConfig={newsWidget.config}
            onChange={cfg => updateWidgetConfig(newsWidget.id, cfg)}
          />
        )}

        {/* Save bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            style={saveState === 'saving' ? { ...primaryBtnStyle, opacity: 0.6 } : primaryBtnStyle}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {saveState === 'saved' && (
            <span style={{ color: '#4caf50', fontSize: '0.9rem' }}>Saved — display is updating</span>
          )}
          {saveState === 'error' && (
            <span style={{ color: '#ff4444', fontSize: '0.85rem' }}>{saveError}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  padding: '2rem',
  boxSizing: 'border-box',
}

const panelStyle: React.CSSProperties = {
  maxWidth: '640px',
  margin: '0 auto',
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-panel)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '1.25rem',
  marginBottom: '1rem',
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 1rem 0',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: 'var(--color-text)',
  letterSpacing: '0.03em',
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.9em',
  color: 'var(--color-accent)',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  fontSize: '0.9rem',
  color: 'var(--color-muted)',
  marginBottom: '0.25rem',
}

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.9rem',
  color: 'var(--color-text)',
  padding: '0.35rem 0',
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  color: 'var(--color-text)',
  padding: '0.35rem 0.6rem',
  fontSize: '0.9rem',
  outline: 'none',
  width: '6rem',
}

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  padding: '0.5rem 1.5rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '6px',
  color: 'var(--color-muted)',
  padding: '0.35rem 0.75rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
}

const dangerBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,80,80,0.4)',
  borderRadius: '6px',
  color: '#ff6666',
  padding: '0.3rem 0.6rem',
  fontSize: '0.8rem',
  cursor: 'pointer',
  flexShrink: 0,
}
