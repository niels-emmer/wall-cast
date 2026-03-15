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

// Shared column style — always exactly 1/7th width
const COL: React.CSSProperties = {
  width: 'calc(100% / 7)',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.4em 0',
  gap: '0.2em',
}

const DIVIDER = <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0 }} />

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()

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
  const cur = data.current_weather
  const { symbol: curSymbol, label: curLabel } = wmo(cur.weathercode)

  // Font sizes — temperature is the anchor; label and wind are ~half
  const tempSize  = 'clamp(2.2rem, 5vw, 4rem)'
  const infoSize  = 'clamp(1rem, 2.2vw, 1.8rem)'   // ~half of tempSize
  const hourLabel = 'clamp(0.65rem, 1.1vw, 0.85rem)'
  const hourSymbol = 'clamp(1.1rem, 2vw, 1.6rem)'
  const hourTemp  = 'clamp(0.85rem, 1.6vw, 1.25rem)'
  const hourRain  = 'clamp(0.65rem, 1.1vw, 0.85rem)'

  return (
    <div className="flex flex-col h-full p-3" style={{ gap: '0.5em' }}>

      {/* ── Line 1: current condition ── */}
      <div className="flex items-center flex-shrink-0" style={{ gap: '0.5em' }}>
        {/* Symbol */}
        <span style={{ fontSize: tempSize, lineHeight: 1 }}>{curSymbol}</span>

        {/* Temperature — large anchor */}
        <span className="font-black tabular-nums" style={{ fontSize: tempSize, lineHeight: 1 }}>
          {Math.round(cur.temperature)}°
        </span>

        {/* Label + wind — ~half size, vertically centred with the temp */}
        <div className="flex flex-col justify-center" style={{ gap: '0.05em' }}>
          <span style={{ fontSize: infoSize, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {curLabel}
          </span>
          <span style={{ fontSize: infoSize, color: 'var(--color-muted)', lineHeight: 1.1 }}>
            Wind: {Math.round(cur.windspeed)} km/h
          </span>
        </div>
      </div>

      {DIVIDER}

      {/* ── Line 2: hourly — 7 equal columns ── */}
      {config.show_hourly !== false && (
        <div className="flex flex-shrink-0" style={{ width: '100%' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const idx = startIdx + i
            const hour = new Date(data.hourly.time[idx]).getHours()
            const { symbol } = wmo(data.hourly.weathercode[idx])
            const temp   = Math.round(data.hourly.temperature_2m[idx])
            const precip = data.hourly.precipitation_probability[idx]
            const isNow  = i === 0
            return (
              <div key={idx} style={{
                ...COL,
                background: isNow ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.03)',
                borderRadius: 6,
              }}>
                {/* time */}
                <span style={{ fontSize: hourLabel, color: isNow ? 'var(--color-accent)' : 'var(--color-muted)',
                               fontWeight: isNow ? 700 : 400 }}>
                  {String(hour).padStart(2, '0')}:00
                </span>
                {/* symbol + temp on one line */}
                <span style={{ fontSize: hourSymbol, lineHeight: 1 }}>
                  {symbol}{' '}
                  <span className="tabular-nums font-bold" style={{ fontSize: hourTemp }}>
                    {temp}°
                  </span>
                </span>
                {/* rain chance */}
                <span style={{
                  fontSize: hourRain,
                  color: precip > 40 ? 'var(--color-accent)' : 'var(--color-muted)',
                }}>
                  {precip}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {DIVIDER}

      {/* ── Line 3: daily — 7 equal columns ── */}
      {config.show_daily !== false && (
        <div className="flex flex-1 min-h-0" style={{ width: '100%' }}>
          {data.daily.time.slice(0, 7).map((t, i) => {
            const d = new Date(t)
            const label = i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]
            const { symbol } = wmo(data.daily.weathercode[i])
            const hi = Math.round(data.daily.temperature_2m_max[i])
            const lo = Math.round(data.daily.temperature_2m_min[i])
            return (
              <div key={t} style={{
                ...COL,
                flex: 1,
                background: i === 0 ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.03)',
                borderRadius: 6,
              }}>
                {/* day label */}
                <span style={{ fontSize: hourLabel, color: i === 0 ? 'var(--color-accent)' : 'var(--color-muted)',
                               fontWeight: i === 0 ? 700 : 400 }}>
                  {label}
                </span>
                {/* symbol + hi on one line */}
                <span style={{ fontSize: hourSymbol, lineHeight: 1 }}>
                  {symbol}{' '}
                  <span className="tabular-nums font-bold" style={{ fontSize: hourTemp }}>
                    {hi}°
                  </span>
                </span>
                {/* lo temp */}
                <span style={{ fontSize: hourRain, color: 'var(--color-muted)' }}>
                  {lo}°
                </span>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
