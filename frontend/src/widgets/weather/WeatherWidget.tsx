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

const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

// ── Hourly column — fills available height, content distributed evenly ────────
function HourlyCol({ hour, symbol, temp, precip, accent = false }: {
  hour: string; symbol: string; temp: number; precip: number; accent?: boolean
}) {
  return (
    <div style={{
      flex: '1 1 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      padding: '0.4em 0.2em',
      background: accent ? 'rgba(0,212,255,0.09)' : 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      minWidth: 0,
      minHeight: 0,
    }}>
      <span style={{
        fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)',
        color: accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
      }}>
        {hour}
      </span>
      <span style={{ fontSize: 'clamp(1.8rem, 3.45vw, 2.85rem)', lineHeight: 1 }}>{symbol}</span>
      <span style={{
        fontSize: 'clamp(1.5rem, 2.85vw, 2.25rem)',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {temp}°
      </span>
      <span style={{
        fontSize: 'clamp(1.1rem, 1.95vw, 1.5rem)',
        color: precip > 40 ? 'var(--color-accent)' : 'var(--color-muted)',
      }}>
        {precip}%
      </span>
    </div>
  )
}

// ── Daily column — fills available height, content distributed evenly ─────────
function DailyCol({ label, symbol, hi, lo, accent = false }: {
  label: string; symbol: string; hi: number; lo: number; accent?: boolean
}) {
  return (
    <div style={{
      flex: '1 1 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-evenly',  // distributes 4 items through full height
      padding: '0.4em 0.2em',
      background: accent ? 'rgba(0,212,255,0.09)' : 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      minWidth: 0,
      minHeight: 0,
    }}>
      <span style={{
        fontSize: 'clamp(1.275rem, 2.25vw, 1.8rem)',
        color: accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 'clamp(2.7rem, 5.25vw, 4.2rem)', lineHeight: 1 }}>{symbol}</span>
      <span style={{
        fontSize: 'clamp(1.95rem, 3.75vw, 3rem)',
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {hi}°
      </span>
      <span style={{
        fontSize: 'clamp(1.275rem, 2.25vw, 1.8rem)',
        color: 'var(--color-muted)',
        whiteSpace: 'nowrap',
      }}>
        {lo}°
      </span>
    </div>
  )
}

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()

  const center: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--color-muted)', fontSize: '1rem',
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
      gap: '0.55rem',
      boxSizing: 'border-box',
    }}>

      {/* ── Current ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.45em',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', lineHeight: 1 }}>{curSymbol}</span>
        <span style={{
          fontSize: 'clamp(2rem, 4vw, 3.2rem)',
          fontWeight: 900, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(cur.temperature)}°
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1em', marginLeft: '0.2em' }}>
          <span style={{ fontSize: 'clamp(1.5rem, 3vw, 2.4rem)', color: 'var(--color-text)', lineHeight: 1 }}>
            {curLabel}
          </span>
          <span style={{ fontSize: 'clamp(1.275rem, 2.55vw, 2rem)', color: 'var(--color-muted)', lineHeight: 1 }}>
            Wind: {Math.round(cur.windspeed)} km/h
          </span>
        </div>
      </div>

      {divider}

      {/* ── Hourly ── */}
      {config.show_hourly !== false && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.3rem', flex: 1, minHeight: 0 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const idx  = startIdx + i
            const hour = `${String(new Date(data.hourly.time[idx]).getHours()).padStart(2, '0')}:00`
            const { symbol } = wmo(data.hourly.weathercode[idx])
            return (
              <HourlyCol
                key={idx}
                hour={hour}
                symbol={symbol}
                temp={Math.round(data.hourly.temperature_2m[idx])}
                precip={data.hourly.precipitation_probability[idx]}
                accent={i === 0}
              />
            )
          })}
        </div>
      )}

      {divider}

      {/* ── Daily ── */}
      {config.show_daily !== false && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.3rem', flex: 1, minHeight: 0 }}>
          {data.daily.time.slice(0, 7).map((t, i) => {
            const d = new Date(t)
            return (
              <DailyCol
                key={t}
                label={i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]}
                symbol={wmo(data.daily.weathercode[i]).symbol}
                hi={Math.round(data.daily.temperature_2m_max[i])}
                lo={Math.round(data.daily.temperature_2m_min[i])}
                accent={i === 0}
              />
            )
          })}
        </div>
      )}

    </div>
  )
}
