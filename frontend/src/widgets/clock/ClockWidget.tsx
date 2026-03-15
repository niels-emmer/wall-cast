import { useEffect, useState } from 'react'

interface Props {
  config: Record<string, unknown>
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

export function ClockWidget({ config }: Props) {
  const showSeconds = config.show_seconds !== false
  const showDate = config.show_date !== false

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())
  const dateStr = `${DAYS[now.getDay()]}`
  const dateNum = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      {/* Time */}
      <div className="tabular-nums font-black leading-none flex items-baseline"
           style={{ fontSize: 'clamp(3.5rem, 7vw, 6rem)' }}>
        <span>{hours}</span>
        <span style={{ opacity: 0.35, margin: '0 0.05em' }}>:</span>
        <span>{minutes}</span>
        {showSeconds && (
          <span style={{ fontSize: '0.4em', opacity: 0.4, marginLeft: '0.25em', fontWeight: 300 }}>
            {seconds}
          </span>
        )}
      </div>

      {/* Date */}
      {showDate && (
        <div className="flex flex-col items-center" style={{ gap: '0.1em' }}>
          <span className="font-light uppercase tracking-widest"
                style={{ fontSize: 'clamp(0.8rem, 1.8vw, 1.4rem)', color: 'var(--color-muted)' }}>
            {dateStr}
          </span>
          <span className="font-bold"
                style={{ fontSize: 'clamp(0.9rem, 2vw, 1.6rem)', color: 'var(--color-text)', letterSpacing: '0.04em' }}>
            {dateNum}
          </span>
        </div>
      )}
    </div>
  )
}
