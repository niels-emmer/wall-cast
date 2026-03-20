import { useRef, useLayoutEffect, useState } from 'react'
import { useGarbage } from '../../hooks/use-garbage'
import { useLang } from '../../i18n/use-lang'
import type { GarbageCollection } from '../../types/api'
import type { WidgetProps } from '../base-registry'

const CONTAINER_COLORS: Record<string, string> = {
  gft:       '#4caf50',
  pmd:       '#ff9800',
  restafval: '#9e9e9e',
}

const CONTAINER_ICONS: Record<string, string> = {
  gft:       '🌿',
  pmd:       '♻️',
  restafval: '🗑️',
}

const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

function dateLabel(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

// Horizontal card — mirrors HourlyCol / DailyCol layout but as a row
function CollectionCard({ item, dayLbl, dateLbl, containerName }: {
  item: GarbageCollection
  dayLbl: string
  dateLbl: string
  containerName: string
}) {
  const accent = item.days_until <= 1
  const color  = CONTAINER_COLORS[item.type] ?? 'var(--color-muted)'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.55em',
      padding: '0.4em 0.65em',
      background: accent ? 'rgba(0,212,255,0.09)' : 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      borderLeft: `3px solid ${color}`,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Big icon */}
      <span style={{
        fontSize: 'clamp(1.8rem, 3.45vw, 2.85rem)',
        lineHeight: 1,
        flexShrink: 0,
      }}>
        {CONTAINER_ICONS[item.type]}
      </span>

      {/* Name */}
      <span style={{
        fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)',
        fontWeight: 500,
        color: 'var(--color-text)',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}>
        {containerName}
      </span>

      {/* Day + date — right-aligned */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        flexShrink: 0,
        gap: '0.05em',
      }}>
        <span style={{
          fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)',
          fontWeight: accent ? 700 : 500,
          color: accent ? 'var(--color-accent)' : 'var(--color-text)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {dayLbl}
        </span>
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
          color: 'var(--color-muted)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {dateLbl}
        </span>
      </div>
    </div>
  )
}

export function GarbageWidget({ config }: WidgetProps) {
  const daysAhead = (config.days_ahead as number) ?? 7
  const { data, isError, isLoading } = useGarbage(daysAhead)
  const t = useLang()

  // Fit-to-box: measure container and first card to calculate visible count
  const listRef = useRef<HTMLDivElement>(null)
  const [maxItems, setMaxItems] = useState(10)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const first = list.children[0] as HTMLElement | undefined
      if (!first) return
      const cardH = first.getBoundingClientRect().height
      if (cardH <= 0) return
      const gap = 4.8 // ~0.3rem
      const containerH = list.getBoundingClientRect().height
      setMaxItems(Math.max(1, Math.floor(containerH / (cardH + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [data?.collections.length])

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    boxSizing: 'border-box',
    gap: '0.55rem',
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
      {t.garbageTitle}
    </div>
  )

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', marginTop: '0.3rem' }}>
        {t.unavailable}
      </span>
    </div>
  )

  if (data.collections.length === 0) return (
    <div style={shell}>
      {title}
      {divider}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-muted)',
        fontSize: 'clamp(1.1rem, 2vw, 1.5rem)',
        opacity: 0.5,
      }}>
        {t.noCollection}
      </div>
    </div>
  )

  const visible = data.collections.slice(0, maxItems)

  return (
    <div style={shell}>
      {title}
      {divider}
      <div ref={listRef} style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {visible.map(item => (
          <CollectionCard
            key={item.type}
            item={item}
            dayLbl={t.dayLabel(item.days_until)}
            dateLbl={dateLabel(item.date, t.locale)}
            containerName={t.containerNames[item.type] ?? item.label}
          />
        ))}
      </div>
    </div>
  )
}
