import React from 'react'
import { useCalendar } from '../../hooks/use-calendar'
import { useLang } from '../../i18n/use-lang'
import type { CalendarEvent, CalendarDay } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { fs, sp, shellStyle, titleStyle, dividerStyle, sectionLabelStyle, cardBase } from '../styles'

const EMPTY_ACCENT    = 'rgba(255,255,255,0.1)'
const DEFAULT_ACCENT  = 'rgba(255,255,255,0.3)'

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
      ...cardBase,
      display:    'flex',
      alignItems: 'stretch',
      borderLeft: `4px solid ${accent}`,
      padding:    0,
      overflow:   'hidden',
    }}>
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        padding:       sp.cardPad,
        gap:           sp.innerGap,
        minWidth:      0,
        flex:          1,
      }}>
        <span style={{
          fontSize:     fs.md,
          fontWeight:   500,
          color:        'var(--color-text)',
          lineHeight:   1.2,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {ev.title}
        </span>
        <span style={{
          fontSize:   fs.sm,
          color:      'var(--color-muted)',
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
      ...cardBase,
      display:    'flex',
      alignItems: 'center',
      borderLeft: `4px solid ${EMPTY_ACCENT}`,
    }}>
      <span style={{
        fontSize: fs.sm,
        color:    'var(--color-muted)',
        opacity:  0.45,
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
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-end',
        flexShrink:    0,
        minWidth:      '3.6rem',
        paddingTop:    '0.4rem',
      }}>
        <span style={{
          fontSize:      fs.md,
          fontWeight:    600,
          color:         'var(--color-text)',
          lineHeight:    1.1,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {day.day_label}
        </span>
        <span style={{
          fontSize:   fs.sm,
          color:      'var(--color-muted)',
          lineHeight: 1.3,
        }}>
          {day.date_label}
        </span>
      </div>

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp.listGap, flex: 1, minWidth: 0 }}>
        {day.events.map(ev => (
          <EventCard key={ev.id} ev={ev} allDayLabel={allDayLabel} fallbackColor={fallbackColor} />
        ))}
      </div>
    </div>
  )
}

export function CalendarWidget({ config }: WidgetProps) {
  const t = useLang()
  const fallbackColor = (config.calendar_color as string) ?? DEFAULT_ACCENT
  const calendarIds = config.calendar_ids as string[] | undefined
  const { data, isError, isLoading } = useCalendar({ calendarIds, language: t.locale.split('-')[0] })

  const shell = shellStyle
  const divider = <div style={dividerStyle} />
  const title = <div style={titleStyle}>Calendar</div>

  const sectionLabel = (text: string, sub?: string): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexShrink: 0 }}>
      <span style={sectionLabelStyle}>{text}</span>
      {sub && (
        <span style={{ fontSize: fs.sm, color: 'var(--color-muted)', opacity: 0.6 }}>
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
      <span style={{ color: 'var(--color-muted)', fontSize: fs.md }}>
        {t.calendarUnavailable}
      </span>
    </div>
  )

  return (
    <div style={{ ...shell, overflow: 'hidden' }}>
      {title}
      {divider}

      {/* Today */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp.listGap, flexShrink: 0 }}>
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
            display:       'flex',
            flexDirection: 'column',
            gap:           sp.listGap,
            overflow:      'hidden',
            flex:          1,
            minHeight:     0,
          }}>
            {sectionLabel(t.upcomingDays)}
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '0.55rem',
              overflow:      'hidden',
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
