import { useEffect, useState } from 'react'

interface Props {
  config: Record<string, unknown>
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const day = DAYS[now.getDay()]
  const date = `${day}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div className="flex flex-col justify-center h-full px-4">
      <div className="tabular-nums font-black leading-none" style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}>
        {hours}<span style={{ opacity: 0.4 }}>:</span>{minutes}
        {showSeconds && (
          <span style={{ fontSize: '0.5em', opacity: 0.5, marginLeft: '0.2em' }}>{seconds}</span>
        )}
      </div>
      {showDate && (
        <div className="mt-2 font-light tracking-widest uppercase" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.25rem)', color: 'var(--color-muted)' }}>
          {date}
        </div>
      )}
    </div>
  )
}
