import { useRain } from '../../hooks/use-rain'

interface Props {
  config: Record<string, unknown>
}

export function RainWidget({ config: _config }: Props) {
  const { data, isError } = useRain()

  if (isError) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-muted)' }}>Rain data unavailable</div>
  }

  if (!data) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-muted)' }}>Loading...</div>
  }

  const forecast = data.forecast.slice(0, 24) // 2h, 5-min intervals
  const maxMm = Math.max(...forecast.map(f => f.mm_per_hour), 1)
  const hasRain = forecast.some(f => f.mm_per_hour > 0)

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-muted)' }}>
        Rain — next 2 hours
      </div>
      {!hasRain ? (
        <div className="flex-1 flex items-center" style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          No rain expected
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-px">
          {forecast.map((entry, i) => {
            const heightPct = Math.max((entry.mm_per_hour / maxMm) * 100, entry.mm_per_hour > 0 ? 4 : 0)
            const isNow = i === 0
            return (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <div
                  style={{
                    height: `${heightPct}%`,
                    background: isNow ? 'var(--color-accent)' : 'rgba(0,212,255,0.4)',
                    borderRadius: 2,
                    minHeight: entry.mm_per_hour > 0 ? 3 : 0,
                    transition: 'height 0.3s ease',
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
      {/* Time labels at start and end */}
      <div className="flex justify-between" style={{ color: 'var(--color-muted)', fontSize: '0.7rem' }}>
        <span>Now</span>
        {forecast[forecast.length - 1] && <span>{forecast[forecast.length - 1].time}</span>}
      </div>
    </div>
  )
}
