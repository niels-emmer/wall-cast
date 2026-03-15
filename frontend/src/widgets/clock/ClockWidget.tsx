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
      gap: '0.5em',
      padding: '0.5rem',
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
        <span style={{ opacity: 0.25, margin: '0 0.06em' }}>:</span>
        <span>{minutes}</span>
        {showSeconds && (
          <span style={{
            fontSize: '0.35em',
            opacity: 0.35,
            marginLeft: '0.35em',
            fontWeight: 300,
            letterSpacing: 0,
          }}>
            {seconds}
          </span>
        )}
      </div>

      {/* Date */}
      {showDate && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2em',
        }}>
          <span style={{
            fontSize: 'clamp(0.85rem, 1.8vw, 1.4rem)',
            fontWeight: 300,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            color: 'var(--color-muted)',
          }}>
            {dayName}
          </span>
          <span style={{
            fontSize: 'clamp(1rem, 2.1vw, 1.7rem)',
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
