import React from 'react'
import { useCalendar } from '../../hooks/use-calendar'
import { useLang } from '../../i18n/use-lang'
import type { CalendarEvent, CalendarDay } from '../../types/api'
import type { WidgetProps } from '../base-registry'

const CARD_BG      = 'rgba(255,255,255,0.05)'
const CARD_BORDER  = 'rgba(255,255,255,0.09)'
const EMPTY_ACCENT = 'rgba(255,255,255,0.1)'
const DEFAULT_ACCENT = 'rgba(255,255,255,0.3)'

function EventCard({ ev, allDayLabel, fallbackColor }: {
  ev: CalendarEvent
  allDayLabel: string
  fallbackColor: string
}) {
  const timeStr = ev.all_day
    ? allDayLabel
    : `${ev.start_time}${ev.end_time ? '–' + ev.end_time : ''}`
  const accent = ev.color ?? fallbackColor

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderLeft: `4px solid ${accent}`,
      borderRadius: 8,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '0.5rem 0.75rem',
        gap: '0.15rem',
        minWidth: 0,
        flex: 1,
      }}>
        <span style={{
          fontSize: 'clamp(1.15rem, 2.1vw, 1.65rem)',
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
          fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)',
          color: 'var(--color-muted)',
          lineHeight: 1.2,
        }}>
          {timeStr}
        </span>
      </div>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderLeft: `4px solid ${EMPTY_ACCENT}`,
      borderRadius: 8,
      padding: '0.5rem 0.75rem',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 'clamp(1rem, 1.8vw, 1.4rem)',
        color: 'var(--color-muted)',
        opacity: 0.45,
      }}>
        {text}
      </span>
    </div>
  )
}

function DayBlock({ day, allDayLabel, fallbackColor }: {
  day: CalendarDay
  allDayLabel: string
  fallbackColor: string
}) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      {/* Day label — right-aligned, fixed width */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        flexShrink: 0,
        minWidth: '3.6rem',
        paddingTop: '0.45rem',
      }}>
        <span style={{
          fontSize: 'clamp(1.1rem, 2vw, 1.55rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {day.day_label}
        </span>
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
          color: 'var(--color-muted)',
          lineHeight: 1.3,
        }}>
          {day.date_label}
        </span>
      </div>

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 }}>
        {day.events.map(ev => (
          <EventCard key={ev.id} ev={ev} allDayLabel={allDayLabel} fallbackColor={fallbackColor} />
        ))}
      </div>
    </div>
  )
}

export function CalendarWidget({ config }: WidgetProps) {
  const t = useLang()
  // calendar_color in YAML lets you hardcode a fallback accent when events
  // have no individual colorId and the API can't resolve the calendar color.
  const fallbackColor = (config.calendar_color as string) ?? DEFAULT_ACCENT
  const { data, isError, isLoading } = useCalendar()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    boxSizing: 'border-box',
    gap: '0.65rem',
    overflow: 'hidden',
  }

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

  const sectionLabel = (text: string, sub?: string): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexShrink: 0 }}>
      <span style={{
        fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: 'var(--color-muted)',
      }}>
        {text}
      </span>
      {sub && (
        <span style={{
          fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)',
          color: 'var(--color-muted)',
          opacity: 0.6,
        }}>
          {sub}
        </span>
      )}
    </div>
  )

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}>
        {t.calendarUnavailable}
      </span>
    </div>
  )

  return (
    <div style={shell}>
      {title}
      {divider}

      {/* Today */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
        {sectionLabel(t.todaySection, data.today_label)}
        {data.today.length === 0
          ? <EmptyCard text={t.nothingScheduled} />
          : data.today.map(ev => <EventCard key={ev.id} ev={ev} allDayLabel={t.allDay} fallbackColor={fallbackColor} />)
        }
      </div>

      {/* This week */}
      {data.week.length > 0 && (
        <>
          {divider}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
          }}>
            {sectionLabel(t.upcomingDays)}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              overflow: 'hidden',
            }}>
              {data.week.map(day => (
                <DayBlock key={day.date} day={day} allDayLabel={t.allDay} fallbackColor={fallbackColor} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
