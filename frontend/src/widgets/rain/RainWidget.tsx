import { useRain } from '../../hooks/use-rain'

interface Props {
  config: Record<string, unknown>
}

// Colour ramp: dry → light → moderate → heavy
function barColor(mm: number, levels: { light: number; moderate: number; heavy: number }) {
  if (mm <= 0)             return 'rgba(255,255,255,0.08)'
  if (mm < levels.light)   return 'rgba(0,212,255,0.35)'
  if (mm < levels.moderate) return 'rgba(0,212,255,0.65)'
  if (mm < levels.heavy)   return 'rgba(0,150,255,0.85)'
  return '#ff4444'
}

export function RainWidget({ config: _config }: Props) {
  const { data, isError } = useRain()

  if (isError) return (
    <div className="flex flex-col items-start justify-center h-full p-4 gap-1">
      <span style={{ color: 'var(--color-muted)', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Rain — next 2 hours
      </span>
      <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Unavailable</span>
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-start justify-center h-full p-4 gap-1">
      <span style={{ color: 'var(--color-muted)', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Rain — next 2 hours
      </span>
      <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Loading...</span>
    </div>
  )

  const forecast = data.forecast as Array<{ time: string; mm_per_hour: number }>
  const levels = (data.levels as { light: number; moderate: number; heavy: number }) ??
                 { light: 0.25, moderate: 1, heavy: 2.5 }

  const hasRain = forecast.some(f => f.mm_per_hour > 0)
  // Scale to at least 2.5 mm/h so a heavy bar fills fully
  const maxMm = Math.max(...forecast.map(f => f.mm_per_hour), levels.heavy)

  // Show every 6th time label (every 30 min)
  const timeLabels = forecast.filter((_, i) => i % 6 === 0).map(f => f.time)

  return (
    <div className="flex flex-col h-full p-3 gap-1">
      {/* Header */}
      <div className="flex justify-between items-baseline flex-shrink-0">
        <span style={{ color: 'var(--color-muted)', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Rain — next 2 hours
        </span>
        {!hasRain && (
          <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>None expected</span>
        )}
      </div>

      {/* Bar chart */}
      <div className="flex-1 flex items-end gap-px min-h-0">
        {forecast.map((entry, i) => {
          const heightPct = entry.mm_per_hour > 0
            ? Math.max((entry.mm_per_hour / maxMm) * 100, 6)
            : 0
          return (
            <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}>
              <div
                style={{
                  height: `${heightPct}%`,
                  minHeight: entry.mm_per_hour > 0 ? 4 : 0,
                  background: barColor(entry.mm_per_hour, levels),
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.4s ease',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Time axis */}
      <div className="flex justify-between flex-shrink-0"
           style={{ color: 'var(--color-muted)', fontSize: '0.65rem' }}>
        {timeLabels.map((t, i) => (
          <span key={i}>{i === 0 ? 'Now' : t}</span>
        ))}
      </div>

      {/* Legend */}
      {hasRain && (
        <div className="flex gap-3 flex-shrink-0" style={{ color: 'var(--color-muted)', fontSize: '0.6rem' }}>
          <span style={{ color: 'rgba(0,212,255,0.65)' }}>■</span> light
          <span style={{ color: 'rgba(0,150,255,0.85)' }}>■</span> moderate
          <span style={{ color: '#ff4444' }}>■</span> heavy
        </div>
      )}
    </div>
  )
}
