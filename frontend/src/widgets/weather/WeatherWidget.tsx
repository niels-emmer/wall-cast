import { useWeather } from '../../hooks/use-weather'
import { useSun } from '../../hooks/use-sun'
import { useLang } from '../../i18n/use-lang'
import type { SunData } from '../../types/api'
import type { Translations } from '../../i18n/translations'

interface Props {
  config: Record<string, unknown>
}

const WMO_SYMBOLS: Record<number, string> = {
  0:  '☀',  1:  '🌤', 2:  '⛅', 3:  '☁',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '❄',
  80: '🌦', 81: '🌧', 82: '⛈',
  95: '⛈', 96: '⛈', 99: '⛈',
}
function wmo(code: number, t: Translations) {
  return { symbol: WMO_SYMBOLS[code] ?? '?', label: t.wmoLabels[code] ?? '?' }
}

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
function SunBlock({ d, t }: { d: SunData; t: Translations }) {
  const muted = 'var(--color-muted)'
  const mono: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }

  const cols = [
    { emoji: '🌅', label: t.sunrise, time: d.sunrise },
    { emoji: '🌇', label: t.sunset,  time: d.sunset  },
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
        ☀ {d.day_length_h}h {String(d.day_length_m).padStart(2, '0')}m {t.daylight}
      </span>

    </div>
  )
}

export function WeatherWidget({ config }: Props) {
  const t = useLang()
  const { data, isError } = useWeather()
  const { data: sunData } = useSun()

  const center: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--color-muted)', fontSize: '1rem',
  }
  if (isError) return <div style={center}>{t.weatherUnavailable}</div>
  if (!data)   return <div style={center}>{t.weatherLoading}</div>

  const now = new Date()
  const startIdx = Math.max(0, data.hourly.time.findIndex(ts => new Date(ts) >= now))
  const cur = data.current_weather
  const { symbol: curSymbol, label: curLabel } = wmo(cur.weathercode, t)

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
          {t.weatherTitle}
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
            {t.wind} {Math.round(cur.windspeed)} km/u
          </span>
        </div>
        {sunData && <SunBlock d={sunData} t={t} />}
      </div>

      {divider}

      {/* ── Hourly ── */}
      {config.show_hourly !== false && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.3rem', flex: 1, minHeight: 0 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const idx  = startIdx + i
            const hour = `${String(new Date(data.hourly.time[idx]).getHours()).padStart(2, '0')}:00`
            const { symbol } = wmo(data.hourly.weathercode[idx], t)
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
          {data.daily.time.slice(0, 7).map((ts, i) => {
            const d = new Date(ts)
            return (
              <DailyCol
                key={ts}
                label={i === 0 ? t.today : t.daysShort[d.getDay()]}
                symbol={wmo(data.daily.weathercode[i], t).symbol}
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
