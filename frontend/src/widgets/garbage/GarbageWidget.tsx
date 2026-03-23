import { useRef, useLayoutEffect, useState } from 'react'
import { Leaf, Recycle, TrashSimple } from '@phosphor-icons/react'
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
  const style = { display: 'block' as const, flexShrink: 0 as const }

  if (type === 'gft')       return <Leaf       size="1em" weight="fill"   color={color} style={style} />
  if (type === 'pmd')       return <Recycle     size="1em" weight="fill"   color={color} style={style} />
  return                           <TrashSimple size="1em" weight="regular" color={color} style={style} />
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
