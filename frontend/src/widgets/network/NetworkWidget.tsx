import { useNetwork } from '../../hooks/use-network'
import type { WidgetProps } from '../base-registry'
import { fs, sp, col, shellStyle, titleStyle, dividerStyle } from '../styles'

// ── Colours ───────────────────────────────────────────────────────────────────
const GREEN  = '#4ade80'
const RED    = '#ef4444'
const YELLOW = '#eab308'
const MUTED  = 'var(--color-muted)'
const TEXT   = 'var(--color-text)'

// ── Tiny status dot ───────────────────────────────────────────────────────────
function Dot({ ok, unknown }: { ok: boolean; unknown?: boolean }) {
  const color = unknown ? YELLOW : ok ? GREEN : RED
  return (
    <span style={{
      display:      'inline-block',
      width:        '0.55em',
      height:       '0.55em',
      borderRadius: '50%',
      background:   color,
      flexShrink:   0,
      marginTop:    '0.1em',
    }} />
  )
}

// ── Row container ─────────────────────────────────────────────────────────────
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display:      'flex',
      flexDirection: 'row',
      alignItems:   'center',
      gap:          '0.5em',
      background:   col.cardBgDim,
      borderRadius: sp.cardRadius,
      padding:      sp.cardPad,
      flexShrink:   0,
      minWidth:     0,
    }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize:      fs.xs,
      fontWeight:    600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.12em',
      color:         MUTED,
      flexShrink:    0,
      width:         '2.8em',
    }}>
      {children}
    </span>
  )
}

// ── WAN link type badge ───────────────────────────────────────────────────────
function LinkBadge({ type }: { type: string | null }) {
  if (!type) return null
  const labels: Record<string, string> = { ETH: 'ETH', PTM: 'VDSL', ATM: 'ADSL', USB: 'USB' }
  const label = labels[type] ?? type
  return (
    <span style={{
      fontSize:     fs.xs,
      fontWeight:   700,
      color:        GREEN,
      background:   'rgba(74,222,128,0.12)',
      border:       '1px solid rgba(74,222,128,0.25)',
      borderRadius: 4,
      padding:      '0.1em 0.4em',
      flexShrink:   0,
    }}>
      {label}
    </span>
  )
}

// ── DNS badge ─────────────────────────────────────────────────────────────────
function DnsBadge({ label, ok }: { label: string; ok: boolean }) {
  const color  = ok ? GREEN : RED
  const bg     = ok ? 'rgba(74,222,128,0.10)' : 'rgba(239,68,68,0.10)'
  const border = ok ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'
  return (
    <span style={{
      fontSize:     fs.xs,
      fontWeight:   700,
      color,
      background:   bg,
      border:       `1px solid ${border}`,
      borderRadius: 4,
      padding:      '0.1em 0.45em',
      flexShrink:   0,
    }}>
      {label}
    </span>
  )
}

// ── Uptime formatter ──────────────────────────────────────────────────────────
function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

// ── Speed age formatter ───────────────────────────────────────────────────────
function fmtAge(ts: number): string {
  const secs = Math.round(Date.now() / 1000 - ts)
  if (secs < 90)  return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  return `${Math.round(secs / 3600)}h ago`
}

// ── Main widget ───────────────────────────────────────────────────────────────
export function NetworkWidget(_props: WidgetProps) {
  const { data, isLoading, isError } = useNetwork()

  const shell = shellStyle
  const title = <div style={titleStyle}>Network</div>
  const divider = <div style={dividerStyle} />

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <Row>
        <Dot ok={false} />
        <span style={{ fontSize: fs.sm, color: RED }}>Unavailable</span>
      </Row>
    </div>
  )

  const { wan, connectivity, dns, hosts, speedtest } = data
  const wanUp = wan?.status === 'up'

  return (
    <div style={shell}>
      {title}
      {divider}

      {/* Content list */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           sp.listGap,
        flex:          1,
        minHeight:     0,
        overflow:      'hidden',
      }}>

        {/* ── WAN row ───────────────────────────────────────────────────── */}
        <Row>
          <Label>WAN</Label>
          <Dot ok={wanUp} unknown={!wan} />
          <span style={{
            fontSize:   fs.sm,
            fontWeight: 500,
            color:      wanUp ? TEXT : RED,
            flex:       1,
            minWidth:   0,
            overflow:   'hidden',
            whiteSpace: 'nowrap' as const,
            textOverflow: 'ellipsis',
          }}>
            {wan ? (wanUp ? (wan.ip ?? 'Up') : 'Down') : 'No router'}
          </span>
          {wan && <LinkBadge type={wan.link_type} />}
          {wan?.uptime_s != null && (
            <span style={{ fontSize: fs.xs, color: MUTED, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
              {fmtUptime(wan.uptime_s)}
            </span>
          )}
        </Row>

        {/* ── Connectivity row ──────────────────────────────────────────── */}
        <Row>
          <Label>Net</Label>
          <Dot ok={connectivity.ok} />
          <span style={{
            fontSize:   fs.sm,
            fontWeight: 500,
            color:      connectivity.ok ? TEXT : RED,
            flex:       1,
          }}>
            {connectivity.ok ? 'Online' : 'Offline'}
          </span>
          {connectivity.latency_ms != null && (
            <span style={{ fontSize: fs.xs, color: MUTED, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
              {connectivity.latency_ms} ms
            </span>
          )}
        </Row>

        {/* ── DNS row ───────────────────────────────────────────────────── */}
        <Row>
          <Label>DNS</Label>
          <DnsBadge label="CF" ok={dns.cloudflare} />
          <DnsBadge label="G" ok={dns.google} />
          {!dns.cloudflare && !dns.google && (
            <span style={{ fontSize: fs.xs, color: RED, marginLeft: '0.3em' }}>All down</span>
          )}
        </Row>

        {/* ── Hosts row ─────────────────────────────────────────────────── */}
        {hosts ? (
          <Row>
            <Label>LAN</Label>
            <span style={{ fontSize: fs.lg, fontWeight: 700, color: TEXT, lineHeight: 1 }}>
              {hosts.total}
            </span>
            <span style={{ fontSize: fs.xs, color: MUTED }}>hosts</span>
            <div style={{ flex: 1 }} />
            {/* Ethernet */}
            <span style={{ fontSize: fs.xs, color: MUTED, whiteSpace: 'nowrap' as const }}>
              <span style={{ color: TEXT, fontWeight: 600 }}>{hosts.ethernet}</span>
              {' eth'}
            </span>
            {/* Wi-Fi */}
            <span style={{ fontSize: fs.xs, color: MUTED, whiteSpace: 'nowrap' as const }}>
              <span style={{ color: TEXT, fontWeight: 600 }}>{hosts.wifi}</span>
              {' wifi'}
            </span>
          </Row>
        ) : (
          <Row>
            <Label>LAN</Label>
            <span style={{ fontSize: fs.sm, color: MUTED }}>—</span>
          </Row>
        )}

        {/* ── Speedtest row ─────────────────────────────────────────────── */}
        <Row>
          <Label>Speed</Label>
          {speedtest ? (
            <>
              {/* Down */}
              <span style={{ fontSize: fs.xs, color: MUTED, flexShrink: 0 }}>↓</span>
              <span style={{
                fontSize:   fs.sm,
                fontWeight: 600,
                color:      TEXT,
                flexShrink: 0,
                whiteSpace: 'nowrap' as const,
              }}>
                {speedtest.download_mbps != null ? `${speedtest.download_mbps}` : '—'}
              </span>
              {/* Up */}
              <span style={{ fontSize: fs.xs, color: MUTED, flexShrink: 0 }}>↑</span>
              <span style={{
                fontSize:   fs.sm,
                fontWeight: 600,
                color:      TEXT,
                flexShrink: 0,
                whiteSpace: 'nowrap' as const,
              }}>
                {speedtest.upload_mbps != null ? `${speedtest.upload_mbps}` : '—'}
              </span>
              <span style={{ fontSize: fs.xs, color: MUTED, flexShrink: 0 }}>Mbps</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: fs.xs, color: MUTED, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                {fmtAge(speedtest.tested_at)}
              </span>
            </>
          ) : (
            <span style={{ fontSize: fs.xs, color: MUTED }}>Testing…</span>
          )}
        </Row>

      </div>
    </div>
  )
}
