import { useWeather } from '../../hooks/use-weather'

interface Props {
  config: Record<string, unknown>
}

// WMO weather code to human-readable label and emoji-free icon char
const WMO_LABELS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

function wmoLabel(code: number) {
  return WMO_LABELS[code] ?? 'Unknown'
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()
  const hourlyCount = (config.hourly_count as number) ?? 6
  const dailyCount = (config.daily_count as number) ?? 5

  if (isError) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-muted)' }}>Weather unavailable</div>
  }

  if (!data) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-muted)' }}>Loading...</div>
  }

  const now = new Date()
  const currentHourIndex = data.hourly.time.findIndex(t => new Date(t) >= now)
  const startIdx = currentHourIndex >= 0 ? currentHourIndex : 0

  const hourlySlice = data.hourly.time.slice(startIdx, startIdx + hourlyCount)

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Current */}
      <div className="flex items-end gap-4">
        <span className="font-black leading-none" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
          {Math.round(data.current_weather.temperature)}°
        </span>
        <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem', paddingBottom: '0.2rem' }}>
          {wmoLabel(data.current_weather.weathercode)}
        </span>
      </div>

      {/* Hourly */}
      {config.show_hourly !== false && (
        <div className="flex gap-3 overflow-hidden">
          {hourlySlice.map((time, i) => {
            const idx = startIdx + i
            const hour = new Date(time).getHours()
            return (
              <div key={time} className="flex flex-col items-center gap-1 flex-1 min-w-0"
                style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--color-text)' }}>{String(hour).padStart(2, '0')}:00</span>
                <span className="font-bold" style={{ fontSize: '0.95rem', color: 'var(--color-text)' }}>
                  {Math.round(data.hourly.temperature_2m[idx])}°
                </span>
                <span>{data.hourly.precipitation_probability[idx]}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Daily */}
      {config.show_daily !== false && (
        <div className="flex gap-3 overflow-hidden flex-1">
          {data.daily.time.slice(0, dailyCount).map((time, i) => {
            const d = new Date(time)
            const label = i === 0 ? 'Today' : DAYS[d.getDay()]
            return (
              <div key={time} className="flex flex-col items-center gap-1 flex-1 min-w-0"
                style={{ fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span className="font-bold" style={{ fontSize: '0.9rem' }}>
                  {Math.round(data.daily.temperature_2m_max[i])}°
                </span>
                <span style={{ color: 'var(--color-muted)' }}>
                  {Math.round(data.daily.temperature_2m_min[i])}°
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
