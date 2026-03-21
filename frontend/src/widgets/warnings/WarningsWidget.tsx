import React, { useEffect } from 'react'
import { useWarnings } from '../../hooks/use-warnings'
import { useLang } from '../../i18n/use-lang'
import type { KnmiWarning } from '../../types/api'
import type { WidgetProps } from '../base-registry'

const DIVIDER = 'rgba(255,255,255,0.07)'
const CARD_BG  = 'rgba(255,255,255,0.04)'

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
  const color  = LEVEL_COLOR[warning.level] ?? '#eab308'
  const bg     = LEVEL_BG[warning.level]    ?? CARD_BG
  const border = LEVEL_BORDER[warning.level] ?? 'rgba(255,255,255,0.12)'
  const validUntil = formatValidUntil(warning.valid_until, t)
  const codeBadge  = t.warningsCodeLabel(warning.level)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      background: bg,
      border: `1px solid ${border}`,
      borderLeft: `5px solid ${color}`,
      borderRadius: 8,
      padding: '0.65rem 0.85rem',
      flexShrink: 0,
    }}>
      {/* Top row: phenomenon + code badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        <span style={{
          fontSize: 'clamp(1.15rem, 2.1vw, 1.7rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
          textTransform: 'capitalize',
          lineHeight: 1.1,
        }}>
          {warning.phenomenon}
        </span>
        <div style={{
          background: `${color}22`,
          border: `1px solid ${color}55`,
          borderRadius: 5,
          padding: '0.2rem 0.55rem',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 'clamp(0.7rem, 1.25vw, 0.95rem)',
            fontWeight: 700,
            color: color,
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
          fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
          color: 'var(--color-muted)',
          lineHeight: 1.3,
        }}>
          {warning.regions.join(' · ')}
        </span>
      )}

      {/* Description */}
      {warning.description && (
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
          color: 'var(--color-text)',
          opacity: 0.75,
          lineHeight: 1.4,
        }}>
          {warning.description}
        </span>
      )}

      {/* Valid until */}
      {validUntil && (
        <span style={{
          fontSize: 'clamp(0.75rem, 1.3vw, 1rem)',
          color: color,
          opacity: 0.8,
          marginTop: '0.1rem',
        }}>
          {validUntil}
        </span>
      )}
    </div>
  )
}

export function WarningsWidget({ onSkip }: WidgetProps) {
  const t = useLang()
  const { data, isLoading } = useWarnings()

  const hasWarnings = (data?.warnings?.length ?? 0) > 0

  // Signal the RotatorWidget to skip this slot when there are no warnings
  useEffect(() => {
    if (!isLoading && !hasWarnings) {
      onSkip?.()
    }
  }, [isLoading, hasWarnings, onSkip])

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    boxSizing: 'border-box',
    gap: '0.65rem',
    overflow: 'hidden',
  }

  const title = (
    <div style={{
      fontSize: 'clamp(1.35rem, 2.85vw, 2.25rem)',
      fontWeight: 300,
      textTransform: 'uppercase',
      letterSpacing: '0.25em',
      color: 'var(--color-text)',
      flexShrink: 0,
    }}>
      {t.warningsTitle}
    </div>
  )

  const divider = (
    <div style={{ height: 1, background: DIVIDER, flexShrink: 0 }} />
  )

  // Loading or no warnings: render nothing visible (RotatorWidget shows this
  // with opacity 0 while onSkip advances past it)
  if (isLoading || !hasWarnings) {
    return <div style={{ ...shell, opacity: 0 }}>{title}</div>
  }

  return (
    <div style={shell}>
      {title}
      {divider}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
      }}>
        {data!.warnings.map((w, i) => (
          <WarningCard key={i} warning={w} t={t} />
        ))}
      </div>
    </div>
  )
}
