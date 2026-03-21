import { useWeather } from '../../hooks/use-weather'
import { useSun } from '../../hooks/use-sun'
import { useLang } from '../../i18n/use-lang'
import type { SunData } from '../../types/api'
import type { Translations } from '../../i18n/translations'
import { fs, sp, col, shellStyle, titleStyle, dividerStyle } from '../styles'

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

const divider = <div style={dividerStyle} />

// ── Hourly column — fills available height, content distributed evenly ────────
function HourlyCol({ hour, symbol, temp, precip, accent = false }: {
  hour: string; symbol: string; temp: number; precip: number; accent?: boolean
}) {
  return (
    <div style={{
      flex:           '1 1 0',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'space-evenly',
      padding:        sp.cardPad,
      background:     accent ? 'rgba(0,212,255,0.09)' : col.cardBgDim,
      borderRadius:   sp.cardRadius,
      minWidth:       0,
      minHeight:      0,
    }}>
      <span style={{
        fontSize:   fs.sm,
        color:      accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
      }}>
        {hour}
      </span>
      <span style={{ fontSize: fs.icon, lineHeight: 1 }}>{symbol}</span>
      <span style={{
        fontSize:           fs.lg,
        fontWeight:         700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight:         1,
      }}>
        {temp}°
      </span>
      <span style={{
        fontSize: fs.sm,
        color:    precip > 40 ? 'var(--color-accent)' : 'var(--color-muted)',
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
      flex:           '1 1 0',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'space-evenly',
      padding:        sp.cardPad,
      background:     accent ? 'rgba(0,212,255,0.09)' : col.cardBgDim,
      borderRadius:   sp.cardRadius,
      minWidth:       0,
      minHeight:      0,
    }}>
      <span style={{
        fontSize:   fs.sm,
        color:      accent ? 'var(--color-accent)' : 'var(--color-muted)',
        fontWeight: accent ? 700 : 400,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{ fontSize: fs.icon, lineHeight: 1 }}>{symbol}</span>
      <span style={{
        fontSize:           fs.lg,
        fontWeight:         700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight:         1,
      }}>
        {hi}°
      </span>
      <span style={{
        fontSize:   fs.sm,
        color:      'var(--color-muted)',
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
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp.innerGap }}>
            <span style={{
              fontSize:      fs.xs,
              color:         muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {emoji} {label}
            </span>
            <span style={{
              fontSize:   fs.md,
              fontWeight: 700,
              color:      'var(--color-text)',
              ...mono,
            }}>
              {time}
            </span>
          </div>
        ))}
      </div>

      {/* Day length */}
      <span style={{
        fontSize:      fs.xs,
        color:         muted,
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
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    color:          'var(--color-muted)',
    fontSize:       fs.sm,
  }
  if (isError) return <div style={center}>{t.weatherUnavailable}</div>
  if (!data)   return <div style={center}>{t.weatherLoading}</div>

  const now      = new Date()
  const startIdx = Math.max(0, data.hourly.time.findIndex(ts => new Date(ts) >= now))
  const cur      = data.current_weather
  const { symbol: curSymbol, label: curLabel } = wmo(cur.weathercode, t)

  return (
    <div style={shellStyle}>

      {/* ── Title + Current ── */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75em', flexShrink: 0 }}>
        <div style={titleStyle}>{t.weatherTitle}</div>
        <span style={{ fontSize: fs.hero, lineHeight: 1 }}>{curSymbol}</span>
        <span style={{
          fontSize:           fs.hero,
          fontWeight:         900,
          lineHeight:         1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(cur.temperature)}°
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp.innerGap }}>
          <span style={{ fontSize: fs.md, color: 'var(--color-text)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {curLabel}
          </span>
          <span style={{ fontSize: fs.sm, color: 'var(--color-muted)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {t.wind} {Math.round(cur.windspeed)} km/u
          </span>
        </div>
        {sunData && <SunBlock d={sunData} t={t} />}
      </div>

      {divider}

      {/* ── Hourly ── */}
      {config.show_hourly !== false && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: sp.listGap, flex: 1, minHeight: 0 }}>
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
        <div style={{ display: 'flex', flexDirection: 'row', gap: sp.listGap, flex: 1, minHeight: 0 }}>
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
