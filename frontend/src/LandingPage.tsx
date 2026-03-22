import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './lib/api'

// ── Colours matching the dark dashboard theme ─────────────────────────────────
const C = {
  bg:       '#0d1117',
  surface:  '#161b22',
  border:   'rgba(255,255,255,0.09)',
  text:     '#e6edf3',
  muted:    'rgba(230,237,243,0.45)',
  green:    '#4ade80',
  greenBg:  'rgba(74,222,128,0.12)',
  greenBdr: 'rgba(74,222,128,0.3)',
  red:      '#f87171',
  redBg:    'rgba(248,113,113,0.12)',
  redBdr:   'rgba(248,113,113,0.3)',
  amber:    '#fbbf24',
  amberBg:  'rgba(251,191,36,0.12)',
  amberBdr: 'rgba(251,191,36,0.3)',
  blue:     '#60a5fa',
  blueBg:   'rgba(96,165,250,0.12)',
  blueBdr:  'rgba(96,165,250,0.3)',
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Screen {
  id: string
  name: string
  chromecast_ip?: string
  casting_active?: boolean
}

interface RawConfig {
  shared?: { casting_enabled?: boolean }
  screens?: Screen[]
}

interface StatusData {
  backend: { status: string }
  caster: { status: string; last_seen_s: number | null }
}

interface LogRecord {
  ts: string
  level: string
  name: string
  msg: string
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function WallCastLogo() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Background rounded square */}
      <rect width="56" height="56" rx="13" fill="#161b22"/>
      <rect width="56" height="56" rx="13" fill="url(#wcg)"/>
      {/* Monitor bezel */}
      <rect x="7" y="10" width="42" height="27" rx="3.5" fill="#0a0f17" stroke="#21262d" strokeWidth="1.5"/>
      {/* Widget grid */}
      <rect x="11" y="14" width="17" height="8" rx="2" fill="#4ade80" opacity="0.9"/>
      <rect x="30" y="14" width="15" height="8" rx="2" fill="#60a5fa" opacity="0.5"/>
      <rect x="11" y="24" width="9" height="9" rx="2" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.75"/>
      <rect x="22" y="24" width="10" height="9" rx="2" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.75"/>
      {/* Cast signal — corner point + two concentric arcs, bottom-right of screen */}
      <circle cx="45" cy="35" r="1.8" fill="#4ade80"/>
      <path d="M 41 35 A 4 4 0 0 0 45 31" stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M 38 35 A 7 7 0 0 0 45 28" stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.38"/>
      {/* Monitor stand */}
      <path d="M 23 37 L 28 42 L 33 37" stroke="#21262d" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <line x1="21" y1="42" x2="35" y2="42" stroke="#21262d" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="wcg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.07"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Shared card style ─────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   C.surface,
  border:       `1px solid ${C.border}`,
  borderRadius: 10,
  padding:      '1.25rem 1.5rem',
}

const sectionTitle: React.CSSProperties = {
  fontSize:      '0.7rem',
  fontWeight:    600,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color:         C.muted,
  marginBottom:  '0.9rem',
}

// ── Toggle button ─────────────────────────────────────────────────────────────
function ToggleButton({ active, onToggle, loading }: {
  active: boolean
  onToggle: () => void
  loading?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '0.45rem',
        padding:       '0.35rem 0.85rem',
        borderRadius:  6,
        border:        `1px solid ${active ? C.greenBdr : C.redBdr}`,
        background:    active ? C.greenBg : C.redBg,
        color:         active ? C.green : C.red,
        fontSize:      '0.8rem',
        fontWeight:    600,
        cursor:        loading ? 'wait' : 'pointer',
        opacity:       loading ? 0.6 : 1,
        transition:    'opacity 0.15s',
        whiteSpace:    'nowrap',
      }}
    >
      <span style={{
        width: 7, height: 7,
        borderRadius: '50%',
        background: active ? C.green : C.red,
        flexShrink: 0,
      }} />
      {active ? 'CASTING ON' : 'CASTING OFF'}
    </button>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────
function Pill({ ok, stale, label }: { ok: boolean; stale?: boolean; label: string }) {
  const color = ok ? C.green : stale ? C.amber : C.red
  const bg    = ok ? C.greenBg : stale ? C.amberBg : C.redBg
  const bdr   = ok ? C.greenBdr : stale ? C.amberBdr : C.redBdr
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '0.4rem',
      padding:      '0.25rem 0.7rem',
      borderRadius: 6,
      border:       `1px solid ${bdr}`,
      background:   bg,
      color,
      fontSize:     '0.8rem',
      fontWeight:   600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Main landing page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const qc = useQueryClient()
  const [togglingGlobal, setTogglingGlobal] = useState(false)
  const [togglingScreen, setTogglingScreen] = useState<string | null>(null)

  const { data: rawCfg } = useQuery<RawConfig>({
    queryKey: ['admin-config'],
    queryFn: () => apiFetch<RawConfig>('/api/admin/config'),
    staleTime: 5000,
  })

  const { data: statusData } = useQuery<StatusData>({
    queryKey: ['admin-status'],
    queryFn: () => apiFetch<StatusData>('/api/admin/status'),
    refetchInterval: 10_000,
    staleTime: 9_000,
  })

  const { data: logsData } = useQuery<{ records: LogRecord[] }>({
    queryKey: ['admin-logs'],
    queryFn: () => apiFetch<{ records: LogRecord[] }>('/api/admin/logs'),
    refetchInterval: 5_000,
    staleTime: 4_000,
  })

  const globalCasting = rawCfg?.shared?.casting_enabled !== false
  const screens: Screen[] = rawCfg?.screens ?? []

  const toggleGlobal = useCallback(async () => {
    setTogglingGlobal(true)
    try {
      await fetch('/api/admin/casting/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !globalCasting }),
      })
      await qc.invalidateQueries({ queryKey: ['admin-config'] })
    } finally {
      setTogglingGlobal(false)
    }
  }, [globalCasting, qc])

  const toggleScreen = useCallback(async (screen: Screen) => {
    setTogglingScreen(screen.id)
    const currentlyActive = screen.casting_active !== false
    try {
      await fetch('/api/admin/casting/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_id: screen.id, active: !currentlyActive }),
      })
      await qc.invalidateQueries({ queryKey: ['admin-config'] })
    } finally {
      setTogglingScreen(null)
    }
  }, [qc])

  const casterOk    = statusData?.caster.status === 'ok'
  const casterStale = statusData?.caster.status === 'stale'
  const casterLabel = (() => {
    if (!statusData) return 'CASTER —'
    const s = statusData.caster
    if (s.status === 'offline') return 'CASTER OFFLINE'
    if (s.status === 'stale')   return `CASTER STALE (${s.last_seen_s}s)`
    return `CASTER OK (${s.last_seen_s}s)`
  })()

  const logs = (logsData?.records ?? []).slice().reverse()

  return (
    <div style={{
      minHeight:  '100vh',
      background: C.bg,
      color:      C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding:    '2rem 1rem',
      boxSizing:  'border-box',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ ...card, display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <WallCastLogo />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                wall-cast
              </div>
              <div style={{ fontSize: '0.85rem', color: C.muted }}>
                Your home's pulse, on every wall.
              </div>
            </div>
          </div>
        </div>

        {/* ── System ─────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: '0.2rem' }}>System</div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '0.85rem' }}>
            Halt casting across every screen at once, or open the admin panel to configure widgets, people, and integrations.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <ToggleButton
              active={globalCasting}
              onToggle={toggleGlobal}
              loading={togglingGlobal}
            />
            <a
              href="/#admin"
              style={{
                padding:        '0.35rem 0.85rem',
                borderRadius:   6,
                border:         `1px solid ${C.blueBdr}`,
                background:     C.blueBg,
                color:          C.blue,
                fontSize:       '0.8rem',
                fontWeight:     600,
                textDecoration: 'none',
                whiteSpace:     'nowrap',
              }}
            >
              ⚙ Settings
            </a>
          </div>
        </div>

        {/* ── Screens ────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: '0.2rem' }}>Screens</div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '0.85rem' }}>
            Start or pause casting per screen independently. Open a live preview in your browser without touching the Chromecast.
          </div>
          {screens.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: C.muted }}>No screens configured.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {screens.map(screen => {
                const screenActive = screen.casting_active !== false
                const hasIp = !!(screen.chromecast_ip || '').trim()
                const effectivelyCasting = globalCasting && screenActive && hasIp
                return (
                  <div
                    key={screen.id}
                    style={{
                      background:    'rgba(255,255,255,0.03)',
                      border:        `1px solid ${effectivelyCasting ? C.greenBdr : C.border}`,
                      borderRadius:  8,
                      padding:       '0.9rem 1rem',
                      minWidth:      160,
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           '0.6rem',
                    }}
                  >
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: C.text }}>
                      {screen.name || screen.id}
                    </div>
                    {!hasIp && (
                      <div style={{ fontSize: '0.72rem', color: C.amber }}>no Chromecast IP</div>
                    )}
                    <ToggleButton
                      active={screenActive}
                      onToggle={() => toggleScreen(screen)}
                      loading={togglingScreen === screen.id}
                    />
                    <a
                      href={`/?screen=${encodeURIComponent(screen.id)}`}
                      style={{
                        display:        'block',
                        padding:        '0.3rem 0.75rem',
                        borderRadius:   5,
                        border:         `1px solid ${C.border}`,
                        background:     'rgba(255,255,255,0.04)',
                        color:          C.muted,
                        fontSize:       '0.78rem',
                        fontWeight:     500,
                        textDecoration: 'none',
                        textAlign:      'center',
                      }}
                    >
                      View →
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Status ─────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: '0.2rem' }}>Status</div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '0.85rem' }}>
            Live health of the backend and caster, with a running feed of recent warnings and errors.
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Pill ok label="BACKEND OK" />
            <Pill
              ok={casterOk}
              stale={casterStale}
              label={casterLabel}
            />
          </div>

          {/* Log buffer */}
          <div style={{
            background:   'rgba(0,0,0,0.3)',
            border:       `1px solid ${C.border}`,
            borderRadius: 6,
            padding:      '0.6rem 0.75rem',
            maxHeight:    220,
            overflowY:    'auto',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, marginBottom: '0.4rem' }}>
              Recent warnings / errors
            </div>
            {logs.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: C.muted, opacity: 0.5 }}>No warnings or errors.</div>
            ) : (
              logs.map((r, i) => (
                <div key={i} style={{
                  display:      'flex',
                  gap:          '0.5rem',
                  fontSize:     '0.75rem',
                  lineHeight:   1.5,
                  color:        r.level === 'ERROR' ? C.red : C.amber,
                  fontFamily:   'monospace',
                  borderBottom: i < logs.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
                  padding:      '0.15rem 0',
                }}>
                  <span style={{ color: C.muted, flexShrink: 0 }}>{r.ts}</span>
                  <span style={{ flexShrink: 0, fontWeight: 700 }}>{r.level}</span>
                  <span style={{ color: C.muted, flexShrink: 0 }}>{r.name}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── About ──────────────────────────────────────────────────────── */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: C.muted }}>wall-cast</span>
            <span style={{ fontSize: '0.78rem', color: C.muted, opacity: 0.4 }}>·</span>
            <span style={{
              fontSize:     '0.72rem',
              fontWeight:   600,
              color:        C.green,
              background:   C.greenBg,
              border:       `1px solid ${C.greenBdr}`,
              borderRadius: 4,
              padding:      '0.1em 0.45em',
            }}>
              v{__APP_VERSION__}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <a
              href="https://github.com/niels-emmer/wall-cast"
              target="_blank"
              rel="noreferrer"
              style={{
                padding:        '0.3rem 0.75rem',
                borderRadius:   6,
                border:         `1px solid ${C.border}`,
                background:     'rgba(255,255,255,0.04)',
                color:          C.muted,
                fontSize:       '0.78rem',
                textDecoration: 'none',
                fontWeight:     500,
              }}
            >
              GitHub
            </a>
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              style={{
                padding:        '0.3rem 0.75rem',
                borderRadius:   6,
                border:         `1px solid ${C.border}`,
                background:     'rgba(255,255,255,0.04)',
                color:          C.muted,
                fontSize:       '0.78rem',
                textDecoration: 'none',
                fontWeight:     500,
              }}
            >
              API docs
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
