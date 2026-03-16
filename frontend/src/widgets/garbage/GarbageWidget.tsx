import { useGarbage } from '../../hooks/use-garbage'
import type { GarbageCollection } from '../../types/api'
import type { WidgetProps } from '../base-registry'

const CONTAINER_COLORS: Record<string, string> = {
  gft:        '#4caf50',   // green
  pmd:        '#ff9800',   // orange
  restafval:  '#9e9e9e',   // gray
}

const CONTAINER_ICONS: Record<string, string> = {
  gft:        '🌿',
  pmd:        '♻️',
  restafval:  '🗑️',
}

function dayLabel(days: number): string {
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  return `Over ${days} dagen`
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function CollectionRow({ item }: { item: GarbageCollection }) {
  const color = CONTAINER_COLORS[item.type] ?? 'var(--color-muted)'
  const isUrgent = item.days_until <= 1

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
    }}>
      {/* Colour dot */}
      <div style={{
        width: '0.55rem',
        height: '0.55rem',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }} />

      {/* Container name */}
      <span style={{
        color: 'var(--color-muted)',
        fontSize: 'clamp(0.7rem, 1.1vw, 0.85rem)',
        flex: 1,
        whiteSpace: 'nowrap',
      }}>
        {CONTAINER_ICONS[item.type]} {item.label}
      </span>

      {/* Days + date */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.05rem',
      }}>
        <span style={{
          color: isUrgent ? color : 'var(--color-text)',
          fontSize: 'clamp(0.75rem, 1.2vw, 0.9rem)',
          fontWeight: isUrgent ? 700 : 500,
        }}>
          {dayLabel(item.days_until)}
        </span>
        <span style={{
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.6rem, 0.95vw, 0.75rem)',
          opacity: 0.7,
        }}>
          {dateLabel(item.date)}
        </span>
      </div>
    </div>
  )
}

export function GarbageWidget({ config: _config }: WidgetProps) {
  const { data, isError, isLoading } = useGarbage()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.75rem 0.85rem 0.6rem',
    boxSizing: 'border-box',
    gap: '0.5rem',
  }

  const header = (
    <div style={{
      color: 'var(--color-muted)',
      fontSize: 'clamp(0.7rem, 1.1vw, 0.85rem)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      Afval — deze week
    </div>
  )

  if (isLoading) return (
    <div style={shell}>{header}</div>
  )

  if (isError || !data) return (
    <div style={shell}>
      {header}
      <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Ophaaldata niet beschikbaar
      </span>
    </div>
  )

  if (data.collections.length === 0) return (
    <div style={shell}>
      {header}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-muted)',
        fontSize: 'clamp(0.7rem, 1.1vw, 0.85rem)',
        opacity: 0.5,
      }}>
        Geen ophaling deze week
      </div>
    </div>
  )

  return (
    <div style={shell}>
      {header}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        minHeight: 0,
      }}>
        {data.collections.map(item => (
          <CollectionRow key={item.type} item={item} />
        ))}
      </div>
    </div>
  )
}
