import React from 'react'
import { useTraffic } from '../../hooks/use-traffic'
import { useLang } from '../../i18n/use-lang'
import type { TrafficJam, TrafficTravel } from '../../types/api'
import type { WidgetProps } from '../base-registry'

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

const CARD_BG          = 'rgba(255,255,255,0.05)'
const CARD_BORDER      = 'rgba(255,255,255,0.09)'
const CARD_BG_ROUTE    = 'rgba(234,179,8,0.07)'
const CARD_BORDER_ROUTE = 'rgba(234,179,8,0.35)'
const DIVIDER          = 'rgba(255,255,255,0.07)'

// Accent colours per jam severity (by delay)
function jamAccent(delayMin: number): string {
  if (delayMin >= 30) return '#ef4444' // red
  if (delayMin >= 10) return '#f97316' // orange
  return '#eab308'                     // yellow
}

// Road badge colour: A-roads blue, N-roads grey, rest white/dim
function roadColor(road: string): string {
  const upper = road.toUpperCase()
  if (upper.startsWith('A')) return '#3b82f6'
  if (upper.startsWith('N')) return '#6b7280'
  return '#9ca3af'
}

function TravelCard({ travel, t }: { travel: TrafficTravel; t: ReturnType<typeof useLang> }) {
  const hasDelay = travel.delay_min > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderLeft: `4px solid ${hasDelay ? '#f97316' : '#22c55e'}`,
      borderRadius: 8,
      padding: '0.6rem 0.85rem',
      flexShrink: 0,
      gap: '0.5rem',
    }}>
      {/* Label + distance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        <span style={{
          fontSize: 'clamp(0.8rem, 1.4vw, 1.1rem)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'var(--color-muted)',
        }}>
          {t.travelTime}
        </span>
        <span style={{
          fontSize: 'clamp(0.8rem, 1.3vw, 1rem)',
          color: 'var(--color-muted)',
          opacity: 0.55,
        }}>
          {travel.distance_km} {t.km}
        </span>
      </div>

      {/* Duration + delay */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{
          fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtDuration(travel.duration_min)}
        </span>
        {hasDelay ? (
          <span style={{
            fontSize: 'clamp(0.8rem, 1.4vw, 1.1rem)',
            color: '#f97316',
            marginLeft: '0.2rem',
          }}>
            +{fmtDuration(travel.delay_min)} {t.trafficDelay}
          </span>
        ) : (
          <span style={{
            fontSize: 'clamp(0.8rem, 1.4vw, 1.1rem)',
            color: '#22c55e',
            marginLeft: '0.2rem',
          }}>
            {t.noDelay}
          </span>
        )}
      </div>
    </div>
  )
}

function JamRow({ jam, t }: { jam: TrafficJam; t: ReturnType<typeof useLang> }) {
  const accent = jamAccent(jam.delay_min)
  const badge  = roadColor(jam.road)
  const isRoute = jam.on_route

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      background: isRoute ? CARD_BG_ROUTE : CARD_BG,
      border: `1px solid ${isRoute ? CARD_BORDER_ROUTE : CARD_BORDER}`,
      borderLeft: `4px solid ${isRoute ? '#eab308' : accent}`,
      borderRadius: 6,
      padding: '0.4rem 0.7rem',
      flexShrink: 0,
      minWidth: 0,
    }}>
      {/* Road badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', flexShrink: 0 }}>
        <div style={{
          background: badge,
          color: '#fff',
          fontSize: 'clamp(0.75rem, 1.3vw, 1rem)',
          fontWeight: 700,
          borderRadius: 4,
          padding: '0.1rem 0.4rem',
          minWidth: '2.6rem',
          textAlign: 'center',
          letterSpacing: '0.03em',
        }}>
          {jam.road}
        </div>
        {isRoute && (
          <div style={{
            background: 'rgba(234,179,8,0.2)',
            color: '#eab308',
            fontSize: 'clamp(0.55rem, 0.9vw, 0.7rem)',
            fontWeight: 700,
            borderRadius: 3,
            padding: '0.05rem 0.3rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>
            {t.onRoute}
          </div>
        )}
      </div>

      {/* From → To */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
          color: 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {jam.from}
        </span>
        <span style={{ color: 'var(--color-muted)', flexShrink: 0, fontSize: '0.9em' }}>→</span>
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
          color: 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {jam.to}
        </span>
      </div>

      {/* Distance + delay */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        flexShrink: 0,
        gap: '0.05rem',
      }}>
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
          whiteSpace: 'nowrap',
        }}>
          {jam.distance_km} {t.km}
        </span>
        <span style={{
          fontSize: 'clamp(0.75rem, 1.3vw, 1rem)',
          color: accent,
          whiteSpace: 'nowrap',
        }}>
          +{jam.delay_min} {t.min}
        </span>
      </div>
    </div>
  )
}

export function TrafficWidget(_: WidgetProps) {
  const t = useLang()
  const { data, isError, isLoading } = useTraffic()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    boxSizing: 'border-box',
    gap: '0.65rem',
    overflow: 'hidden',
  }

  const title = (
    <div style={{
      fontSize: 'clamp(1.35rem, 2.85vw, 2.25rem)',
      fontWeight: 300,
      textTransform: 'uppercase',
      letterSpacing: '0.25em',
      color: 'var(--color-text)',
      flexShrink: 0,
    }}>
      {t.trafficTitle}
    </div>
  )

  const divider = (
    <div style={{ height: 1, background: DIVIDER, flexShrink: 0 }} />
  )

  const sectionLabel = (text: string) => (
    <div style={{
      fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
      color: 'var(--color-muted)',
      flexShrink: 0,
    }}>
      {text}
    </div>
  )

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}>
        {t.trafficUnavailable}
      </span>
    </div>
  )

  return (
    <div style={shell}>
      {title}
      {divider}

      {/* Travel time block */}
      {data.travel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
          <TravelCard travel={data.travel} t={t} />
        </div>
      )}

      {/* Traffic jams */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
        {sectionLabel(t.trafficJams)}
      </div>

      {data.jams.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderLeft: '3px solid #22c55e',
          borderRadius: 6,
          padding: '0.5rem 0.7rem',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 'clamp(0.95rem, 1.7vw, 1.3rem)',
            color: '#22c55e',
          }}>
            {t.noJams}
          </span>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          overflow: 'hidden',
          flex: 1,
          minHeight: 0,
        }}>
          {data.jams.map((jam, i) => (
            <JamRow key={`${jam.road}-${jam.from}-${i}`} jam={jam} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
