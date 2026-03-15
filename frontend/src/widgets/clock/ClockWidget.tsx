import { useEffect, useState } from 'react'

interface Props {
  config: Record<string, unknown>
}

const DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

export function ClockWidget({ config }: Props) {
  const showSeconds = config.show_seconds !== false
  const showDate    = config.show_date !== false

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  const hours   = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())
  const dayName = DAYS[now.getDay()]
  const dateNum = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '0.6em',
      padding: '0.75rem',
      boxSizing: 'border-box',
    }}>
      {/* Time */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'baseline',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 900,
        lineHeight: 1,
        fontSize: 'clamp(3.5rem, 7.5vw, 6.5rem)',
        letterSpacing: '-0.02em',
      }}>
        <span>{hours}</span>
        <span style={{ opacity: 0.2, margin: '0 0.06em' }}>:</span>
        <span>{minutes}</span>
        {showSeconds && (
          <span style={{
            fontSize: '0.64em',
            opacity: 0.3,
            marginLeft: '0.4em',
            fontWeight: 300,
            letterSpacing: 0,
            alignSelf: 'flex-end',
            paddingBottom: '0.15em',
          }}>
            {seconds}
          </span>
        )}
      </div>

      {/* Accent separator */}
      {showDate && (
        <div style={{
          width: '2.5rem',
          height: 2,
          background: 'var(--color-accent)',
          borderRadius: 2,
          opacity: 0.6,
          flexShrink: 0,
        }} />
      )}

      {/* Date */}
      {showDate && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.25em',
        }}>
          <span style={{
            fontSize: 'clamp(1.35rem, 2.85vw, 2.25rem)',
            fontWeight: 300,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            color: 'var(--color-muted)',
          }}>
            {dayName}
          </span>
          <span style={{
            fontSize: 'clamp(1.575rem, 3.3vw, 2.625rem)',
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: 'var(--color-text)',
          }}>
            {dateNum}
          </span>
        </div>
      )}
    </div>
  )
}
