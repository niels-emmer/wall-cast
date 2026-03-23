import { useAirQuality } from '../../hooks/use-air-quality'
import type { PollenDay } from '../../hooks/use-air-quality'
import { useLang } from '../../i18n/use-lang'
import { fs, sp, shellStyle, titleStyle, dividerStyle, sectionLabelStyle } from '../styles'

// ── AQI colour bands ──────────────────────────────────────────────────────────

const AQI_BAND: Record<string, { color: string; bg: string; border: string }> = {
  good:           { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)'   },
  fair:           { color: '#84cc16', bg: 'rgba(132,204,22,0.12)',  border: 'rgba(132,204,22,0.35)'  },
  moderate:       { color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)'   },
  poor:           { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)'  },
  very_poor:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'   },
  extremely_poor: { color: '#b91c1c', bg: 'rgba(185,28,28,0.12)',   border: 'rgba(185,28,28,0.35)'   },
  unknown:        { color: 'var(--color-muted)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
}

// ── Pollen bar colours ────────────────────────────────────────────────────────

const POLLEN_COLOR: Record<string, string> = {
  none:      'rgba(255,255,255,0.08)',
  low:       '#22c55e',
  moderate:  '#eab308',
  high:      '#f97316',
  very_high: '#ef4444',
}

// Fraction of bar to fill per level (minimum visible nub for non-zero levels)
function barFill(day: PollenDay): number {
  if (day.max === null || day.max <= 0) return 0
  return Math.min(day.max / 200, 1)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PollutantChip({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  return (
    <div style={{
      display:      'flex',
      flexDirection: 'column',
      alignItems:   'center',
      gap:          '0.1rem',
      background:   'rgba(255,255,255,0.05)',
      border:       '1px solid rgba(255,255,255,0.09)',
      borderRadius: sp.cardRadius,
      padding:      '0.3rem 0.6rem',
      flexShrink:   0,
    }}>
      <span style={{ fontSize: fs.xs, color: 'var(--color-muted)', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: fs.sm, color: 'var(--color-text)', fontWeight: 500 }}>
        {Math.round(value)}
      </span>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function AirQualityWidget() {
  const t    = useLang()
  const { data, isLoading } = useAirQuality()

  if (isLoading || !data) {
    return (
      <div style={shellStyle}>
        <div style={titleStyle}>{t.airQualityTitle}</div>
        <div style={dividerStyle} />
        <span style={{ fontSize: fs.sm, color: 'var(--color-muted)' }}>{t.loading}</span>
      </div>
    )
  }

  const band = AQI_BAND[data.aqi_level] ?? AQI_BAND.unknown

  // Build day labels for pollen forecast
  const dayLabels = data.pollen[0]?.days.map((d, i) => {
    if (i === 0) return t.today
    const dt = new Date(d.date + 'T12:00:00')
    return dt.toLocaleDateString(t.locale, { weekday: 'short' })
  }) ?? []

  // Build species-labelled pollen rows
  const activePollen = data.pollen

  return (
    <div style={shellStyle}>
      <div style={titleStyle}>{t.airQualityTitle}</div>
      <div style={dividerStyle} />

      {/* ── AQI section ── */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '0.75rem',
        background:   band.bg,
        border:       `1px solid ${band.border}`,
        borderLeft:   `5px solid ${band.color}`,
        borderRadius: sp.cardRadius,
        padding:      sp.cardPad,
        flexShrink:   0,
      }}>
        {/* Big AQI number */}
        <span style={{
          fontSize:   fs.hero,
          fontWeight: 700,
          color:      band.color,
          lineHeight: 1,
          flexShrink: 0,
        }}>
          {data.current_aqi ?? '—'}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 0 }}>
          {/* Level label */}
          <span style={{
            fontSize:      fs.md,
            fontWeight:    600,
            color:         band.color,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            lineHeight:    1,
          }}>
            {t.airQualityLevel(data.aqi_level)}
          </span>
          <span style={{ fontSize: fs.xs, color: 'var(--color-muted)' }}>
            European AQI
          </span>
        </div>

        {/* Pollutant chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <PollutantChip label="PM2.5" value={data.pm2_5} />
          <PollutantChip label="PM10"  value={data.pm10} />
          <PollutantChip label="NO₂"   value={data.nitrogen_dioxide} />
          <PollutantChip label="O₃"    value={data.ozone} />
          {data.dust !== null && <PollutantChip label="Dust" value={data.dust} />}
        </div>
      </div>

      {/* ── Pollen section ── */}
      {activePollen.length > 0 && (
        <>
          <div style={dividerStyle} />
          <div style={{ ...sectionLabelStyle, marginBottom: '0.1rem' }}>{t.airQualityPollen}</div>

          <div style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           sp.listGap,
            flex:          1,
            minHeight:     0,
            overflow:      'hidden',
          }}>
            {activePollen.map(series => (
              <div key={series.species} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                {/* Species name column */}
                <div style={{
                  width:        '4.5rem',
                  flexShrink:   0,
                  fontSize:     fs.sm,
                  color:        'var(--color-muted)',
                  paddingBottom: '1.75rem',  // align with bar bottom
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  {t.pollenSpecies(series.species)}
                </div>

                {series.days.map((day, i) => (
                  <div key={day.date} style={{
                    flex:          1,
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    'center',
                    gap:           '0.25rem',
                  }}>
                    <div style={{
                      width:        '100%',
                      height:       '3rem',
                      background:   'rgba(255,255,255,0.05)',
                      borderRadius: 4,
                      overflow:     'hidden',
                      display:      'flex',
                      alignItems:   'flex-end',
                    }}>
                      <div style={{
                        width:      '100%',
                        height:     `${Math.max(barFill(day) * 100, day.level !== 'none' ? 6 : 0)}%`,
                        background: POLLEN_COLOR[day.level],
                        borderRadius: '3px 3px 0 0',
                      }} />
                    </div>
                    <span style={{
                      fontSize:   fs.xs,
                      color:      i === 0 ? 'var(--color-text)' : 'var(--color-muted)',
                      fontWeight: i === 0 ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}>
                      {dayLabels[i] ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {activePollen.length === 0 && (
        <span style={{ fontSize: fs.sm, color: 'var(--color-muted)' }}>
          {t.pollenLevel('none')}
        </span>
      )}
    </div>
  )
}
