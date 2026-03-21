import { useRef, useLayoutEffect, useState } from 'react'
import { useGarbage } from '../../hooks/use-garbage'
import { useLang } from '../../i18n/use-lang'
import type { GarbageCollection } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { fs, sp, col, shellStyle, titleStyle, dividerStyle } from '../styles'

const CONTAINER_COLORS: Record<string, string> = {
  gft:       '#4caf50',
  pmd:       '#ff9800',
  restafval: '#9e9e9e',
}

function ContainerIcon({ type }: { type: string }) {
  const color = CONTAINER_COLORS[type] ?? 'var(--color-muted)'
  const svg = { display: 'block' as const, flexShrink: 0 as const }

  if (type === 'gft') return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" style={svg}>
      <path d="M21 3C19 8 16 11 12 13 9 15 7 18 6 21 9 18 13 16 16 14 19 12 21 8 21 3Z" fill={color}/>
      <path d="M6 21C7 18 9 15 11 13" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </svg>
  )

  if (type === 'pmd') return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" style={svg}>
      {/* three recycling arrows at 0°, 120°, 240° */}
      <g fill={color}>
        <path d="M12 2 9 7h2v4l-4 7h10l-4-7V7h2z"/>
        <path d="M9 7H5l-2 4 1.7 1 1.3-3h3z" transform="rotate(120 12 12)"/>
        <path d="M9 7H5l-2 4 1.7 1 1.3-3h3z" transform="rotate(240 12 12)"/>
      </g>
    </svg>
  )

  // restafval and fallback — inline SVG trash bin, no emoji font needed
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={svg}>
      <line x1="4" y1="7" x2="20" y2="7"/>
      <path d="M10 3h4a1 1 0 011 1v3H9V4a1 1 0 011-1z"/>
      <path d="M6 7l1.5 13h9L18 7"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  )
}

const divider = <div style={dividerStyle} />

function dateLabel(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

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
      display:       'flex',
      flexDirection: 'row',
      alignItems:    'center',
      gap:           '0.55em',
      padding:       sp.cardPad,
      background:    accent ? 'rgba(0,212,255,0.09)' : col.cardBgDim,
      borderRadius:  sp.cardRadius,
      borderLeft:    `3px solid ${color}`,
      overflow:      'hidden',
      flexShrink:    0,
    }}>
      {/* Big icon */}
      <span style={{ fontSize: fs.icon, lineHeight: 1, flexShrink: 0 }}>
        <ContainerIcon type={item.type} />
      </span>

      {/* Name */}
      <span style={{
        fontSize:     fs.md,
        fontWeight:   500,
        color:        'var(--color-text)',
        flex:         1,
        minWidth:     0,
        overflow:     'hidden',
        whiteSpace:   'nowrap',
        textOverflow: 'ellipsis',
      }}>
        {containerName}
      </span>

      {/* Day + date — right-aligned */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-end',
        flexShrink:    0,
        gap:           sp.innerGap,
      }}>
        <span style={{
          fontSize:   fs.md,
          fontWeight: accent ? 700 : 500,
          color:      accent ? 'var(--color-accent)' : 'var(--color-text)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {dayLbl}
        </span>
        <span style={{
          fontSize:   fs.sm,
          color:      'var(--color-muted)',
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
  const daysAhead  = (config.days_ahead as number) ?? 7
  const postcode   = config.postcode as string | undefined
  const huisnummer = config.huisnummer as string | undefined
  const { data, isError, isLoading } = useGarbage({ daysAhead, postcode, huisnummer })
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
      const gap = parseFloat(sp.listGap) * 16
      const containerH = list.getBoundingClientRect().height
      setMaxItems(Math.max(1, Math.floor(containerH / (cardH + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [data?.collections.length])

  const shell = shellStyle
  const title = <div style={titleStyle}>{t.garbageTitle}</div>

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: fs.md, marginTop: '0.3rem' }}>
        {t.unavailable}
      </span>
    </div>
  )

  if (data.collections.length === 0) return (
    <div style={shell}>
      {title}
      {divider}
      <div style={{
        flex:            1,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           'var(--color-muted)',
        fontSize:        fs.md,
        opacity:         0.5,
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
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           sp.listGap,
        minHeight:     0,
        overflow:      'hidden',
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
