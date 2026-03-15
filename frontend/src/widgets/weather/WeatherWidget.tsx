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

const divider = <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0 }} />

// Sizes calibrated for a small (720p) screen
const SZ = {
  curTemp:    'clamp(2.8rem, 5.5vw, 5rem)',
  curInfo:    'clamp(1.1rem, 2.2vw, 1.8rem)',
  colLabel:   'clamp(0.75rem, 1.4vw, 1.1rem)',
  colSymbol:  'clamp(1.3rem, 2.4vw, 2rem)',
  colTemp:    'clamp(1rem, 1.9vw, 1.5rem)',
  colBot:     'clamp(0.75rem, 1.4vw, 1.1rem)',
}

interface ColProps {
  top: string
  symbol: string
  temp: string
  bot: string
  accent?: boolean
  botColor?: string
}

function ForecastCol({ top, symbol, temp, bot, accent = false, botColor }: ColProps) {
  return (
    <div style={{
      flex: '1 1 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',   // top-aligned, no stretching
      paddingTop: '0.5em',
      paddingBottom: '0.4em',
      gap: '0.3em',
      background: accent ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      minWidth: 0,
    }}>
      {/* day / hour label */}
      <span style={{
        fontSize: SZ.colLabel,
        color: accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
        whiteSpace: 'nowrap',
      }}>
        {top}
      </span>

      {/* weather symbol */}
      <span style={{ fontSize: SZ.colSymbol, lineHeight: 1 }}>{symbol}</span>

      {/* temperature */}
      <span style={{
        fontSize: SZ.colTemp,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {temp}
      </span>

      {/* rain % or lo temp */}
      <span style={{
        fontSize: SZ.colBot,
        color: botColor ?? 'var(--color-muted)',
        whiteSpace: 'nowrap',
      }}>
        {bot}
      </span>
    </div>
  )
}

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()

  const center: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--color-muted)',
  }
  if (isError) return <div style={center}>Weather unavailable</div>
  if (!data)   return <div style={center}>Loading...</div>

  const now = new Date()
  const startIdx = Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= now))
  const cur = data.current_weather
  const { symbol: curSymbol, label: curLabel } = wmo(cur.weathercode)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0.85rem',
      gap: '0.6rem',
      boxSizing: 'border-box',
    }}>

      {/* ── Current condition ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.5em',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: SZ.curTemp, lineHeight: 1 }}>{curSymbol}</span>
        <span style={{ fontSize: SZ.curTemp, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(cur.temperature)}°
        </span>
        <span style={{ fontSize: SZ.curInfo, color: 'var(--color-text)', lineHeight: 1.1 }}>
          {curLabel}
        </span>
        <span style={{ fontSize: SZ.curInfo, color: 'var(--color-muted)', lineHeight: 1.1 }}>
          Wind: {Math.round(cur.windspeed)} km/h
        </span>
      </div>

      {divider}

      {/* ── Hourly ── */}
      {config.show_hourly !== false && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.35rem', flexShrink: 0 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const idx    = startIdx + i
            const hour   = new Date(data.hourly.time[idx]).getHours()
            const { symbol } = wmo(data.hourly.weathercode[idx])
            const temp   = Math.round(data.hourly.temperature_2m[idx])
            const precip = data.hourly.precipitation_probability[idx]
            return (
              <ForecastCol
                key={idx}
                top={`${String(hour).padStart(2, '0')}:00`}
                symbol={symbol}
                temp={`${temp}°`}
                bot={`${precip}%`}
                botColor={precip > 40 ? 'var(--color-accent)' : undefined}
                accent={i === 0}
              />
            )
          })}
        </div>
      )}

      {divider}

      {/* ── Daily ── */}
      {config.show_daily !== false && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.35rem', flex: 1, minHeight: 0 }}>
          {data.daily.time.slice(0, 7).map((t, i) => {
            const d   = new Date(t)
            const label = i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]
            const { symbol } = wmo(data.daily.weathercode[i])
            const hi  = Math.round(data.daily.temperature_2m_max[i])
            const lo  = Math.round(data.daily.temperature_2m_min[i])
            return (
              <ForecastCol
                key={t}
                top={label}
                symbol={symbol}
                temp={`${hi}°`}
                bot={`${lo}°`}
                accent={i === 0}
              />
            )
          })}
        </div>
      )}

    </div>
  )
}
