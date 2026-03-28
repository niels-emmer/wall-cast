import { useWeather } from '../../hooks/use-weather'
import { useSun } from '../../hooks/use-sun'
import { useLang } from '../../i18n/use-lang'
import type { SunData } from '../../types/api'
import type { Translations } from '../../i18n/translations'
import { fs, sp, col, shellStyle, titleStyle, dividerStyle } from '../styles'
import { WeatherIcon, SunriseIcon, SunsetIcon, DaylightIcon } from './WeatherIcons'

interface Props {
  config: Record<string, unknown>
}

function wmo(code: number, t: Translations) {
  return { label: t.wmoLabels[code] ?? '?' }
}

const divider = <div style={dividerStyle} />

// ── Hourly column — fills available height, content distributed evenly ────────
function HourlyCol({ hour, code, temp, precip, accent = false }: {
  hour: string; code: number; temp: number; precip: number; accent?: boolean
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
      <span style={{ fontSize: fs.icon, lineHeight: 1 }}><WeatherIcon code={code} /></span>
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
function DailyCol({ label, code, hi, lo, accent = false }: {
  label: string; code: number; hi: number; lo: number; accent?: boolean
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
      <span style={{ fontSize: fs.icon, lineHeight: 1 }}><WeatherIcon code={code} /></span>
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
    { Icon: SunriseIcon, label: t.sunrise, time: d.sunrise },
    { Icon: SunsetIcon,  label: t.sunset,  time: d.sunset  },
  ]

  return (
    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2em' }}>
      {/* Two columns: sunrise | sunset */}
      <div style={{ display: 'flex', gap: '1.6em', alignItems: 'flex-end' }}>
        {cols.map(({ Icon, label, time }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp.innerGap }}>
            <span style={{
              fontSize:      fs.xs,
              color:         muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              <Icon /> {label}
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
        <DaylightIcon /> {d.day_length_h}h {String(d.day_length_m).padStart(2, '0')}m {t.daylight}
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
  const { label: curLabel } = wmo(cur.weathercode, t)

  const curPrecip = data.hourly.precipitation_probability[startIdx] ?? 0

  return (
    <div style={shellStyle}>

      {/* ── Title ── */}
      <div style={titleStyle}>{t.weatherTitle}</div>

      {divider}

      {/* ── Current conditions ── */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75em', flexShrink: 0 }}>
        <span style={{ fontSize: fs.hero, lineHeight: 1 }}><WeatherIcon code={cur.weathercode} /></span>
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
          <span style={{ fontSize: fs.sm, color: curPrecip > 40 ? 'var(--color-accent)' : 'var(--color-muted)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {curPrecip}%
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
            return (
              <HourlyCol
                key={idx}
                hour={hour}
                code={data.hourly.weathercode[idx]}
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
                code={data.daily.weathercode[i]}
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
