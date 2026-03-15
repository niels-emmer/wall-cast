import { useEffect, useRef } from 'react'
import { useNews } from '../../hooks/use-news'

interface Props {
  config: Record<string, unknown>
}

export function NewsTickerWidget({ config }: Props) {
  const { data, isError } = useNews()
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation | null>(null)

  const speedPx = (config.scroll_speed_px_per_sec as number) ?? 80

  useEffect(() => {
    const track = trackRef.current
    if (!track || !data?.items.length) return

    // Cancel previous animation
    animRef.current?.cancel()

    const trackWidth = track.scrollWidth
    const duration = (trackWidth / speedPx) * 1000

    animRef.current = track.animate(
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(-${trackWidth / 2}px)` },
      ],
      {
        duration,
        iterations: Infinity,
        easing: 'linear',
      },
    )

    return () => {
      animRef.current?.cancel()
    }
  }, [data, speedPx])

  if (isError || !data) {
    return (
      <div className="flex items-center h-full px-4" style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
        {isError ? 'News unavailable' : 'Loading news...'}
      </div>
    )
  }

  // Duplicate items for seamless loop
  const items = [...data.items, ...data.items]

  return (
    <div
      className="flex items-center h-full overflow-hidden"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <div ref={trackRef} className="flex items-center gap-0 whitespace-nowrap" style={{ willChange: 'transform' }}>
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-3" style={{ padding: '0 2rem', fontSize: '0.8rem' }}>
            <span
              style={{
                color: 'var(--color-accent)',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {item.source}
            </span>
            <span style={{ color: 'var(--color-text)' }}>{item.title}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
