import { useWeather } from '../../hooks/use-weather'

interface Props {
  config: Record<string, unknown>
}

// WMO weather code → symbol + label
const WMO: Record<number, { symbol: string; label: string }> = {
  0:  { symbol: '☀',  label: 'Clear' },
  1:  { symbol: '🌤', label: 'Mostly clear' },
  2:  { symbol: '⛅', label: 'Partly cloudy' },
  3:  { symbol: '☁',  label: 'Overcast' },
  45: { symbol: '🌫', label: 'Fog' },
  48: { symbol: '🌫', label: 'Icy fog' },
  51: { symbol: '🌦', label: 'Light drizzle' },
  53: { symbol: '🌦', label: 'Drizzle' },
  55: { symbol: '🌧', label: 'Heavy drizzle' },
  61: { symbol: '🌧', label: 'Light rain' },
  63: { symbol: '🌧', label: 'Rain' },
  65: { symbol: '🌧', label: 'Heavy rain' },
  71: { symbol: '🌨', label: 'Light snow' },
  73: { symbol: '🌨', label: 'Snow' },
  75: { symbol: '❄',  label: 'Heavy snow' },
  80: { symbol: '🌦', label: 'Showers' },
  81: { symbol: '🌧', label: 'Showers' },
  82: { symbol: '⛈',  label: 'Heavy showers' },
  95: { symbol: '⛈',  label: 'Thunderstorm' },
  96: { symbol: '⛈',  label: 'Thunderstorm+hail' },
  99: { symbol: '⛈',  label: 'Thunderstorm+hail' },
}

function wmo(code: number) {
  return WMO[code] ?? { symbol: '?', label: 'Unknown' }
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SECTION = {
  fontSize: '0.7rem' as const,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--color-muted)',
}

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()
  const hourlyCount = (config.hourly_count as number) ?? 6
  const dailyCount  = (config.daily_count  as number) ?? 5

  if (isError) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-muted)' }}>
      Weather unavailable
    </div>
  )
  if (!data) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-muted)' }}>
      Loading...
    </div>
  )

  const now = new Date()
  const startIdx = Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= now))

  return (
    <div className="flex flex-col h-full p-4 gap-3">

      {/* ── Current condition ── */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <span style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)', lineHeight: 1 }}>
          {wmo(data.current_weather.weathercode).symbol}
        </span>
        <div className="flex flex-col">
          <span className="font-black tabular-nums leading-none"
                style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}>
            {Math.round(data.current_weather.temperature)}°
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(0.8rem, 1.4vw, 1.1rem)', marginTop: '0.1em' }}>
            {wmo(data.current_weather.weathercode).label}
            <span style={{ marginLeft: '0.8em', opacity: 0.7 }}>
              {Math.round(data.current_weather.windspeed)} km/h
            </span>
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0 }} />

      {/* ── Hourly ── */}
      {config.show_hourly !== false && (
        <div className="flex-shrink-0">
          <div style={SECTION} className="mb-2">Hour by hour</div>
          <div className="flex gap-2">
            {Array.from({ length: hourlyCount }, (_, i) => {
              const idx = startIdx + i
              const hour = new Date(data.hourly.time[idx]).getHours()
              const { symbol } = wmo(data.hourly.weathercode[idx])
              const temp = Math.round(data.hourly.temperature_2m[idx])
              const precip = data.hourly.precipitation_probability[idx]
              return (
                <div key={idx}
                  className="flex flex-col items-center gap-1 flex-1 min-w-0 rounded-md py-2"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)' }}>
                    {String(hour).padStart(2, '0')}:00
                  </span>
                  <span style={{ fontSize: 'clamp(1.2rem, 2.2vw, 1.8rem)', lineHeight: 1 }}>{symbol}</span>
                  <span className="font-bold tabular-nums"
                        style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.4rem)' }}>
                    {temp}°
                  </span>
                  <span style={{ color: precip > 40 ? 'var(--color-accent)' : 'var(--color-muted)',
                                 fontSize: 'clamp(0.65rem, 1.1vw, 0.85rem)' }}>
                    {precip}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0 }} />

      {/* ── Daily ── */}
      {config.show_daily !== false && (
        <div className="flex-1 flex flex-col">
          <div style={SECTION} className="mb-2">7-day forecast</div>
          <div className="flex gap-2 flex-1">
            {data.daily.time.slice(0, dailyCount).map((t, i) => {
              const d = new Date(t)
              const label = i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]
              const { symbol } = wmo(data.daily.weathercode[i])
              const hi = Math.round(data.daily.temperature_2m_max[i])
              const lo = Math.round(data.daily.temperature_2m_min[i])
              return (
                <div key={t}
                  className="flex flex-col items-center justify-center gap-1 flex-1 rounded-md py-2"
                  style={{ background: i === 0 ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: i === 0 ? 'var(--color-accent)' : 'var(--color-muted)',
                                 fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)', fontWeight: i === 0 ? 700 : 400 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 'clamp(1.1rem, 2vw, 1.6rem)', lineHeight: 1 }}>{symbol}</span>
                  <span className="font-bold tabular-nums"
                        style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.2rem)' }}>
                    {hi}°
                  </span>
                  <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)' }}>
                    {lo}°
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
