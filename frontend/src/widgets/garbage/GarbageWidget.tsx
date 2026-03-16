import { useGarbage } from '../../hooks/use-garbage'
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

const CONTAINER_NAMES: Record<string, string> = {
  gft:       'GFT',
  pmd:       'PMD',
  restafval: 'Restafval',
}

const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

function dayLabel(days: number): string {
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  return `Over ${days} dagen`
}

function dateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Horizontal card — mirrors HourlyCol / DailyCol layout but as a row
function CollectionCard({ item }: { item: GarbageCollection }) {
  const accent = item.days_until <= 1
  const color  = CONTAINER_COLORS[item.type] ?? 'var(--color-muted)'

  return (
    <div style={{
      flex: '1 1 0',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.55em',
      padding: '0.4em 0.65em',
      background: accent ? 'rgba(0,212,255,0.09)' : 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      borderLeft: `3px solid ${color}`,
      minHeight: 0,
      overflow: 'hidden',
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
        {CONTAINER_NAMES[item.type]}
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
          {dayLabel(item.days_until)}
        </span>
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
          color: 'var(--color-muted)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
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
      Afval
    </div>
  )

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', marginTop: '0.3rem' }}>
        Niet beschikbaar
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
        Geen ophaling deze week
      </div>
    </div>
  )

  return (
    <div style={shell}>
      {title}
      {divider}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        minHeight: 0,
      }}>
        {data.collections.map(item => (
          <CollectionCard key={item.type} item={item} />
        ))}
      </div>
    </div>
  )
}
