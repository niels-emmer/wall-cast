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
      gap: '0.4em',
    }}>
      {/* Time */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'baseline',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 900,
        lineHeight: 1,
        fontSize: 'clamp(3rem, 6.5vw, 5.5rem)',
      }}>
        <span>{hours}</span>
        <span style={{ opacity: 0.3, margin: '0 0.05em' }}>:</span>
        <span>{minutes}</span>
        {showSeconds && (
          <span style={{ fontSize: '0.38em', opacity: 0.4, marginLeft: '0.3em', fontWeight: 300 }}>
            {seconds}
          </span>
        )}
      </div>

      {/* Date — two lines, stacked */}
      {showDate && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.15em',
        }}>
          <span style={{
            fontSize: 'clamp(0.7rem, 1.5vw, 1.2rem)',
            fontWeight: 300,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'var(--color-muted)',
          }}>
            {dayName}
          </span>
          <span style={{
            fontSize: 'clamp(0.85rem, 1.8vw, 1.4rem)',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--color-text)',
          }}>
            {dateNum}
          </span>
        </div>
      )}
    </div>
  )
}
