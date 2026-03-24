import { useTraffic } from '../../hooks/use-traffic'
import { useLang } from '../../i18n/use-lang'
import type { TrafficJam, TrafficTravel } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { fs, sp, col, shellStyle, titleStyle, dividerStyle, sectionLabelStyle, cardBase } from '../styles'

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// Accent colours per jam severity (by delay)
function jamAccent(delayMin: number): string {
  if (delayMin >= 30) return '#ef4444'
  if (delayMin >= 10) return '#f97316'
  return '#eab308'
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
      ...cardBase,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      borderLeft:     `4px solid ${hasDelay ? '#f97316' : '#22c55e'}`,
      gap:            '0.5rem',
    }}>
      {/* Label + distance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp.innerGap }}>
        <span style={{
          ...sectionLabelStyle,
          fontSize: fs.xs,
        }}>
          {t.travelTime}
        </span>
        <span style={{
          fontSize: fs.xs,
          color:    'var(--color-muted)',
          opacity:  0.55,
        }}>
          {travel.distance_km} {t.km}
        </span>
      </div>

      {/* Duration + delay */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{
          fontSize:           fs.lg,
          fontWeight:         600,
          color:              'var(--color-text)',
          lineHeight:         1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtDuration(travel.duration_min)}
        </span>
        {hasDelay ? (
          <span style={{ fontSize: fs.xs, color: '#f97316', marginLeft: '0.2rem' }}>
            +{fmtDuration(travel.delay_min)} {t.trafficDelay}
          </span>
        ) : (
          <span style={{ fontSize: fs.xs, color: '#22c55e', marginLeft: '0.2rem' }}>
            {t.noDelay}
          </span>
        )}
      </div>
    </div>
  )
}

function JamRow({ jam, t }: { jam: TrafficJam; t: ReturnType<typeof useLang> }) {
  const accent  = jamAccent(jam.delay_min)
  const badge   = roadColor(jam.road)
  const isRoute = jam.on_route

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        '0.65rem',
      background: isRoute ? 'rgba(234,179,8,0.07)' : col.cardBg,
      border:     `1px solid ${isRoute ? 'rgba(234,179,8,0.35)' : col.cardBorder}`,
      borderLeft: `4px solid ${isRoute ? '#eab308' : accent}`,
      borderRadius: sp.cardRadius,
      padding:    sp.cardPad,
      flexShrink: 0,
      minWidth:   0,
    }}>
      {/* Road badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp.innerGap, flexShrink: 0 }}>
        <div style={{
          background:    badge,
          color:         '#fff',
          fontSize:      fs.xs,
          fontWeight:    700,
          borderRadius:  4,
          padding:       '0.1rem 0.4rem',
          minWidth:      '2.6rem',
          textAlign:     'center',
          letterSpacing: '0.03em',
        }}>
          {jam.road}
        </div>
        {isRoute && (
          <div style={{
            background:    'rgba(234,179,8,0.2)',
            color:         '#eab308',
            fontSize:      'clamp(0.55rem, 0.9vw, 0.7rem)',
            fontWeight:    700,
            borderRadius:  3,
            padding:       '0.05rem 0.3rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace:    'nowrap',
          }}>
            {t.onRoute}
          </div>
        )}
      </div>

      {/* From → To */}
      <div style={{
        flex:       1,
        minWidth:   0,
        display:    'flex',
        alignItems: 'center',
        gap:        '0.3rem',
        overflow:   'hidden',
      }}>
        <span style={{
          fontSize:     fs.sm,
          color:        'var(--color-text)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {jam.from}
        </span>
        <span style={{ color: 'var(--color-muted)', flexShrink: 0, fontSize: '0.9em' }}>→</span>
        <span style={{
          fontSize:     fs.sm,
          color:        'var(--color-text)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {jam.to}
        </span>
      </div>

      {/* Distance + delay */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-end',
        flexShrink:    0,
        gap:           sp.innerGap,
      }}>
        <span style={{
          fontSize:   fs.sm,
          fontWeight: 600,
          color:      'var(--color-text)',
          whiteSpace: 'nowrap',
        }}>
          {jam.distance_km} {t.km}
        </span>
        <span style={{ fontSize: fs.xs, color: accent, whiteSpace: 'nowrap' }}>
          +{jam.delay_min} {t.min}
        </span>
      </div>
    </div>
  )
}

export function TrafficWidget({ config }: WidgetProps) {
  const t = useLang()
  const home       = config.home_address as string | undefined
  const work       = config.work_address as string | undefined
  const routeRoads = config.route_roads  as string | undefined
  const { data, isError, isLoading } = useTraffic({ home, work, routeRoads })

  const shell   = shellStyle
  const divider = <div style={dividerStyle} />
  const title   = <div style={titleStyle}>{t.trafficTitle}</div>

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: fs.md }}>
        {t.trafficUnavailable}
      </span>
    </div>
  )

  const totalJamKm = Math.round(data.jams.reduce((sum, j) => sum + (j.distance_km || 0), 0))

  return (
    <div style={shell}>
      {title}
      {divider}

      {/* Travel time block */}
      {data.travel && (
        <div style={{ flexShrink: 0 }}>
          <TravelCard travel={data.travel} t={t} />
        </div>
      )}

      {/* Traffic jams header + total km */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={sectionLabelStyle}>{t.trafficJams}</span>
        {totalJamKm > 0 && (
          <span style={{ fontSize: fs.sm, color: 'var(--color-text)', opacity: 0.6, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {totalJamKm} {t.km}
          </span>
        )}
      </div>

      {data.jams.length === 0 ? (
        <div style={{
          display:     'flex',
          alignItems:  'center',
          background:  col.cardBg,
          border:      `1px solid ${col.cardBorder}`,
          borderLeft:  '3px solid #22c55e',
          borderRadius: sp.cardRadius,
          padding:     sp.cardPad,
          flexShrink:  0,
        }}>
          <span style={{ fontSize: fs.sm, color: '#22c55e' }}>
            {t.noJams}
          </span>
        </div>
      ) : (
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           sp.listGap,
          overflow:      'hidden',
          flex:          1,
          minHeight:     0,
        }}>
          {data.jams.map((jam, i) => (
            <JamRow key={`${jam.road}-${jam.from}-${i}`} jam={jam} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
