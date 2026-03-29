import { useEffect } from 'react'
import { useWarnings } from '../../hooks/use-warnings'
import { useLang } from '../../i18n/use-lang'
import type { KnmiWarning } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { fs, sp } from '../styles'
import { WidgetShell } from '../WidgetShell'

const LEVEL_COLOR: Record<string, string> = {
  geel:   '#eab308',
  oranje: '#f97316',
  rood:   '#ef4444',
}

const LEVEL_BG: Record<string, string> = {
  geel:   'rgba(234,179,8,0.07)',
  oranje: 'rgba(249,115,22,0.07)',
  rood:   'rgba(239,68,68,0.07)',
}

const LEVEL_BORDER: Record<string, string> = {
  geel:   'rgba(234,179,8,0.25)',
  oranje: 'rgba(249,115,22,0.25)',
  rood:   'rgba(239,68,68,0.25)',
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatValidUntil(iso: string, t: ReturnType<typeof useLang>): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    const time = formatTime(iso)
    if (isToday) return `${t.warningsValidUntil} ${time}`
    const day = d.toLocaleDateString('nl-NL', { weekday: 'short' })
    return `${t.warningsValidUntil} ${day} ${time}`
  } catch {
    return ''
  }
}

function WarningCard({
  warning,
  t,
}: {
  warning: KnmiWarning
  t: ReturnType<typeof useLang>
}) {
  const color       = LEVEL_COLOR[warning.level]  ?? '#eab308'
  const bg          = LEVEL_BG[warning.level]     ?? 'rgba(255,255,255,0.04)'
  const border      = LEVEL_BORDER[warning.level] ?? 'rgba(255,255,255,0.12)'
  const validUntil  = formatValidUntil(warning.valid_until, t)
  const codeBadge   = t.warningsCodeLabel(warning.level)

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           sp.listGap,
      background:    bg,
      border:        `1px solid ${border}`,
      borderLeft:    `5px solid ${color}`,
      borderRadius:  sp.cardRadius,
      padding:       sp.cardPad,
      flexShrink:    0,
    }}>
      {/* Top row: phenomenon + code badge */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '0.5rem',
      }}>
        <span style={{
          fontSize:      fs.md,
          fontWeight:    600,
          color:         'var(--color-text)',
          textTransform: 'capitalize',
          lineHeight:    1.1,
        }}>
          {t.warningsPhenomenon(warning.phenomenon)}
        </span>
        <div style={{
          background:   `${color}22`,
          border:       `1px solid ${color}55`,
          borderRadius: 5,
          padding:      '0.2rem 0.5rem',
          flexShrink:   0,
        }}>
          <span style={{
            fontSize:      fs.xs,
            fontWeight:    700,
            color:         color,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            {codeBadge}
          </span>
        </div>
      </div>

      {/* Regions */}
      {warning.regions.length > 0 && (
        <span style={{
          fontSize:   fs.sm,
          color:      'var(--color-muted)',
          lineHeight: 1.3,
        }}>
          {warning.regions.join(' · ')}
        </span>
      )}

      {/* Description */}
      {warning.description && (
        <span style={{
          fontSize:   fs.sm,
          color:      'var(--color-text)',
          opacity:    0.75,
          lineHeight: 1.4,
        }}>
          {warning.description}
        </span>
      )}

      {/* Valid until */}
      {validUntil && (
        <span style={{
          fontSize:   fs.xs,
          color:      color,
          opacity:    0.8,
          marginTop:  '0.05rem',
        }}>
          {validUntil}
        </span>
      )}
    </div>
  )
}

export function WarningsWidget({ config, onSkip, onUnskip }: WidgetProps) {
  const t = useLang()
  const { data, isLoading, dataUpdatedAt } = useWarnings()
  const region = (config.region as string | undefined) ?? 'all'

  const warnings = (data?.warnings ?? []).filter(w =>
    region === 'all' || w.regions.length === 0 || w.regions.includes(region)
  )
  const hasWarnings = warnings.length > 0

  // Skip slot when no warnings; re-enable it when warnings return
  useEffect(() => {
    if (isLoading) return
    if (hasWarnings) {
      onUnskip?.()
    } else {
      onSkip?.()
    }
  }, [isLoading, hasWarnings, onSkip, onUnskip])

  // Loading or no warnings: render nothing visible (RotatorWidget shows this
  // with opacity 0 while onSkip advances past it)
  if (isLoading || !hasWarnings) {
    return (
      <WidgetShell
        title={t.warningsTitle}
        source="MeteoAlarm"
        dataUpdatedAt={dataUpdatedAt}
        containerStyle={{ opacity: 0 }}
      >
        {null}
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title={t.warningsTitle} source="MeteoAlarm" dataUpdatedAt={dataUpdatedAt}>
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           sp.listGap,
        overflow:      'hidden',
        flex:          1,
        minHeight:     0,
      }}>
        {warnings.map((w, i) => (
          <WarningCard key={i} warning={w} t={t} />
        ))}
      </div>
    </WidgetShell>
  )
}
