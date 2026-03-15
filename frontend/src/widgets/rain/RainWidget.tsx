import { useRain } from '../../hooks/use-rain'

interface Props {
  config: Record<string, unknown>
}

function barColor(mm: number, levels: { light: number; moderate: number; heavy: number }) {
  if (mm <= 0)              return 'rgba(255,255,255,0.07)'
  if (mm < levels.light)    return 'rgba(0,212,255,0.35)'
  if (mm < levels.moderate) return 'rgba(0,212,255,0.65)'
  if (mm < levels.heavy)    return 'rgba(0,150,255,0.85)'
  return '#ff4444'
}

const LABEL: React.CSSProperties = {
  color: 'var(--color-muted)',
  fontSize: 'clamp(0.6rem, 1vw, 0.8rem)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

export function RainWidget({ config: _config }: Props) {
  const { data, isError } = useRain()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.75rem',
    gap: '0.4rem',
    boxSizing: 'border-box',
  }

  if (isError) return (
    <div style={shell}>
      <span style={LABEL}>Rain — next 2 hours</span>
      <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Unavailable</span>
    </div>
  )

  if (!data) return (
    <div style={shell}>
      <span style={LABEL}>Rain — next 2 hours</span>
      <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Loading...</span>
    </div>
  )

  const { forecast, levels } = data
  const hasRain = forecast.some(f => f.mm_per_hour > 0)
  const maxMm   = Math.max(...forecast.map(f => f.mm_per_hour), levels.heavy)

  // Time labels at 0, 30, 60, 90, 120 min (every 6th entry at 5-min intervals)
  const timeLabels = forecast.filter((_, i) => i % 6 === 0).map(f => f.time)

  return (
    <div style={shell}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <span style={LABEL}>Rain — next 2 hours</span>
        {!hasRain && (
          <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(0.75rem, 1.4vw, 1rem)' }}>
            None expected
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        flex: 1,
        minHeight: 0,
      }}>
        {forecast.map((entry, i) => {
          const h = entry.mm_per_hour > 0
            ? Math.max((entry.mm_per_hour / maxMm) * 100, 5)
            : 0
          return (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{
                height: `${h}%`,
                minHeight: entry.mm_per_hour > 0 ? 3 : 0,
                background: barColor(entry.mm_per_hour, levels),
                borderRadius: '2px 2px 0 0',
                transition: 'height 0.4s ease',
              }} />
            </div>
          )
        })}
      </div>

      {/* Time axis */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexShrink: 0,
        color: 'var(--color-muted)',
        fontSize: 'clamp(0.55rem, 0.9vw, 0.75rem)',
      }}>
        {timeLabels.map((t, i) => <span key={i}>{i === 0 ? 'Now' : t}</span>)}
      </div>

      {/* Legend — only when there's rain */}
      {hasRain && (
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.8rem',
          flexShrink: 0,
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.55rem, 0.9vw, 0.7rem)',
          alignItems: 'center',
        }}>
          <span><span style={{ color: 'rgba(0,212,255,0.65)' }}>■</span> light</span>
          <span><span style={{ color: 'rgba(0,150,255,0.85)' }}>■</span> moderate</span>
          <span><span style={{ color: '#ff4444' }}>■</span> heavy</span>
        </div>
      )}
    </div>
  )
}
