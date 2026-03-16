import { useWeather } from '../../hooks/use-weather'
import { useSun } from '../../hooks/use-sun'
import type { SunData } from '../../types/api'

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
        fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)',
        color: accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 'clamp(1.8rem, 3.45vw, 2.85rem)', lineHeight: 1 }}>{symbol}</span>
      <span style={{
        fontSize: 'clamp(1.5rem, 2.85vw, 2.25rem)',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {hi}°
      </span>
      <span style={{
        fontSize: 'clamp(1.1rem, 1.95vw, 1.5rem)',
        color: 'var(--color-muted)',
        whiteSpace: 'nowrap',
      }}>
        {lo}°
      </span>
    </div>
  )
}

// ── Sun block — top-right of current weather row ──────────────────────────────
function SunBlock({ d }: { d: SunData }) {
  const muted = 'var(--color-muted)'
  const mono: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }

  const cols = [
    { emoji: '🌅', label: 'Opkomst',   time: d.sunrise },
    { emoji: '🌇', label: 'Ondergang', time: d.sunset  },
  ]

  return (
    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2em' }}>

      {/* Two columns: sunrise | sunset */}
      <div style={{ display: 'flex', gap: '1.6em', alignItems: 'flex-end' }}>
        {cols.map(({ emoji, label, time }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.05em' }}>
            <span style={{
              fontSize: 'clamp(0.65rem, 1.1vw, 0.85rem)',
              color: muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {emoji} {label}
            </span>
            <span style={{
              fontSize: 'clamp(1.25rem, 2.3vw, 1.85rem)',
              fontWeight: 700,
              color: 'var(--color-text)',
              ...mono,
            }}>
              {time}
            </span>
          </div>
        ))}
      </div>

      {/* Day length */}
      <span style={{
        fontSize: 'clamp(0.75rem, 1.2vw, 0.95rem)',
        color: muted,
        letterSpacing: '0.05em',
      }}>
        ☀ {d.day_length_h}h {String(d.day_length_m).padStart(2, '0')}m daglichttijd
      </span>

    </div>
  )
}

export function WeatherWidget({ config }: Props) {
  const { data, isError } = useWeather()
  const { data: sunData } = useSun()

  const center: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--color-muted)', fontSize: '1rem',
  }
  if (isError) return <div style={center}>Weer niet beschikbaar</div>
  if (!data)   return <div style={center}>Laden...</div>

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

      {/* ── Title + Current ── */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75em', flexShrink: 0 }}>
        <div style={{
          fontSize: 'clamp(1.35rem, 2.85vw, 2.25rem)',
          fontWeight: 300,
          textTransform: 'uppercase',
          letterSpacing: '0.25em',
          color: 'var(--color-text)',
          flexShrink: 0,
        }}>
          Weer
        </div>
        <span style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', lineHeight: 1 }}>{curSymbol}</span>
        <span style={{
          fontSize: 'clamp(2rem, 4vw, 3.2rem)',
          fontWeight: 900, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(cur.temperature)}°
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1em' }}>
          <span style={{ fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)', color: 'var(--color-text)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {curLabel}
          </span>
          <span style={{ fontSize: 'clamp(0.95rem, 1.8vw, 1.4rem)', color: 'var(--color-muted)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            Wind: {Math.round(cur.windspeed)} km/u
          </span>
        </div>
        {sunData && <SunBlock d={sunData} />}
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
