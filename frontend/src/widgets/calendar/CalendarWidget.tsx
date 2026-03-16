import { useCalendar } from '../../hooks/use-calendar'
import type { CalendarEvent, CalendarDay } from '../../types/api'
import type { WidgetProps } from '../base-registry'

const DEFAULT_DOT_COLOR = 'rgba(255,255,255,0.3)'

function Dot({ color }: { color: string | null }) {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: color ?? DEFAULT_DOT_COLOR,
      flexShrink: 0,
      marginTop: '0.2em',
    }} />
  )
}

function EventRow({ ev, showDate = false }: { ev: CalendarEvent; showDate?: boolean }) {
  const timeStr = ev.all_day
    ? 'Hele dag'
    : `${ev.start_time}${ev.end_time ? '–' + ev.end_time : ''}`

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.55rem',
    }}>
      <Dot color={ev.color} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{
          fontSize: 'clamp(1rem, 1.85vw, 1.4rem)',
          fontWeight: 500,
          color: 'var(--color-text)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {ev.title}
        </span>
        <span style={{
          fontSize: 'clamp(0.8rem, 1.4vw, 1.05rem)',
          color: 'var(--color-muted)',
          lineHeight: 1.2,
        }}>
          {showDate && ev.date ? `${ev.date.slice(5).replace('-', '/')} · ` : ''}{timeStr}
        </span>
      </div>
    </div>
  )
}

function DayBlock({ day }: { day: CalendarDay }) {
  return (
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
      {/* Day label column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        flexShrink: 0,
        minWidth: '3.2rem',
        paddingTop: '0.05rem',
      }}>
        <span style={{
          fontSize: 'clamp(0.95rem, 1.7vw, 1.3rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {day.day_label}
        </span>
        <span style={{
          fontSize: 'clamp(0.75rem, 1.3vw, 1rem)',
          color: 'var(--color-muted)',
          lineHeight: 1.2,
        }}>
          {day.date_label}
        </span>
      </div>

      {/* Events column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: 0 }}>
        {day.events.map(ev => (
          <EventRow key={ev.id} ev={ev} />
        ))}
      </div>
    </div>
  )
}

export function CalendarWidget({ config: _config }: WidgetProps) {
  const { data, isError, isLoading } = useCalendar()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    boxSizing: 'border-box',
    gap: '0.6rem',
    overflow: 'hidden',
  }

  const sectionLabel = (text: string, sub?: string): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexShrink: 0 }}>
      <span style={{
        fontSize: 'clamp(0.75rem, 1.3vw, 1rem)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: 'var(--color-muted)',
      }}>
        {text}
      </span>
      {sub && (
        <span style={{
          fontSize: 'clamp(0.75rem, 1.3vw, 1rem)',
          color: 'var(--color-muted)',
          opacity: 0.6,
        }}>
          {sub}
        </span>
      )}
    </div>
  )

  const divider = (
    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
  )

  const title = (
    <div style={{
      fontSize: 'clamp(1.35rem, 2.85vw, 2.25rem)',
      fontWeight: 300,
      textTransform: 'uppercase',
      letterSpacing: '0.25em',
      color: 'var(--color-text)',
      flexShrink: 0,
    }}>
      Family
    </div>
  )

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}>
        Agenda niet beschikbaar
      </span>
    </div>
  )

  return (
    <div style={shell}>
      {title}
      {divider}

      {/* Today section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flexShrink: 0 }}>
        {sectionLabel('Vandaag', data.today_label)}
        {data.today.length === 0 ? (
          <span style={{
            fontSize: 'clamp(0.95rem, 1.7vw, 1.3rem)',
            color: 'var(--color-muted)',
            opacity: 0.55,
            paddingLeft: '1.1rem',
          }}>
            Niets gepland
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.today.map(ev => (
              <EventRow key={ev.id} ev={ev} />
            ))}
          </div>
        )}
      </div>

      {/* Week section */}
      {data.week.length > 0 && (
        <>
          {divider}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
          }}>
            {sectionLabel('Deze week')}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
              overflow: 'hidden',
            }}>
              {data.week.map(day => (
                <DayBlock key={day.date} day={day} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
