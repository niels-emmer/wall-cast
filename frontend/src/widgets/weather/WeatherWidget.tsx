import { useWeather } from '../../hooks/use-weather'

interface Props {
  config: Record<string, unknown>
}

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
function wmo(code: number) { return WMO[code] ?? { symbol: '?', label: 'Unknown' } }

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const divider = (
  <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0 }} />
)

interface ColProps {
  top: string
  mid: string
  bot: string
  midSize: string
  accent?: boolean
}
function ForecastCol({ top, mid, bot, midSize, accent = false }: ColProps) {
  return (
    <div style={{
      flex: '1 1 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0.4em 0.2em',
      gap: '0.25em',
      background: accent ? 'rgba(0,212,255,0.07)' : 'rgba(255,255,255,0.03)',
      borderRadius: 6,
    }}>
      <span style={{
        fontSize: 'clamp(0.6rem, 1.1vw, 0.85rem)',
        color: accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
        whiteSpace: 'nowrap',
      }}>
        {top}
      </span>
      <span style={{ fontSize: midSize, lineHeight: 1.1, textAlign: 'center' }}>
        {mid}
      </span>
      <span style={{
        fontSize: 'clamp(0.6rem, 1.1vw, 0.85rem)',
        color: 'var(--color-muted)',
        whiteSpace: 'nowrap',
      }}>
        {bot}
      </span>
    </div>
  )
}

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()

  if (isError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-muted)' }}>
      Weather unavailable
    </div>
  )
  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-muted)' }}>
      Loading...
    </div>
  )

  const now = new Date()
  const startIdx = Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= now))
  const cur = data.current_weather
  const { symbol: curSymbol, label: curLabel } = wmo(cur.weathercode)

  const tempSize = 'clamp(2rem, 4.5vw, 3.5rem)'
  const infoSize = 'clamp(0.9rem, 2vw, 1.5rem)'   // ~half of tempSize
  const midSize  = 'clamp(0.85rem, 1.6vw, 1.2rem)'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0.75rem',
      gap: '0.5rem',
      boxSizing: 'border-box',
    }}>

      {/* ── Line 1: all on one horizontal row ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.5em',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: tempSize, lineHeight: 1 }}>{curSymbol}</span>
        <span style={{ fontSize: tempSize, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(cur.temperature)}°
        </span>
        <span style={{ fontSize: infoSize, color: 'var(--color-text)', lineHeight: 1 }}>
          {curLabel}
        </span>
        <span style={{ fontSize: infoSize, color: 'var(--color-muted)', lineHeight: 1 }}>
          Wind: {Math.round(cur.windspeed)} km/h
        </span>
      </div>

      {divider}

      {/* ── Line 2: hourly ── */}
      {config.show_hourly !== false && (
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.3rem',
          flexShrink: 0,
        }}>
          {Array.from({ length: 7 }, (_, i) => {
            const idx = startIdx + i
            const hour = new Date(data.hourly.time[idx]).getHours()
            const { symbol } = wmo(data.hourly.weathercode[idx])
            const temp   = Math.round(data.hourly.temperature_2m[idx])
            const precip = data.hourly.precipitation_probability[idx]
            return (
              <ForecastCol
                key={idx}
                top={`${String(hour).padStart(2, '0')}:00`}
                mid={`${symbol} ${temp}°`}
                bot={`${precip}%`}
                midSize={midSize}
                accent={i === 0}
              />
            )
          })}
        </div>
      )}

      {divider}

      {/* ── Line 3: daily ── */}
      {config.show_daily !== false && (
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '0.3rem',
          flex: 1,
          minHeight: 0,
        }}>
          {data.daily.time.slice(0, 7).map((t, i) => {
            const d = new Date(t)
            const label = i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]
            const { symbol } = wmo(data.daily.weathercode[i])
            const hi = Math.round(data.daily.temperature_2m_max[i])
            const lo = Math.round(data.daily.temperature_2m_min[i])
            return (
              <ForecastCol
                key={t}
                top={label}
                mid={`${symbol} ${hi}°`}
                bot={`${lo}°`}
                midSize={midSize}
                accent={i === 0}
              />
            )
          })}
        </div>
      )}

    </div>
  )
}
