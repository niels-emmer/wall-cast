import { useEffect, useRef } from 'react'
import { useNews } from '../../hooks/use-news'

interface Props {
  config: Record<string, unknown>
}

const SEPARATOR = '·'

export function NewsTickerWidget({ config }: Props) {
  const { data, isError } = useNews()
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<Animation | null>(null)

  const speedPx = (config.scroll_speed_px_per_sec as number) ?? 100

  useEffect(() => {
    const track = trackRef.current
    if (!track || !data?.items.length) return

    animRef.current?.cancel()

    // Use half the scroll width because we duplicate items for seamless loop
    const halfWidth = track.scrollWidth / 2
    const duration  = (halfWidth / speedPx) * 1000

    animRef.current = track.animate(
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(-${halfWidth}px)` },
      ],
      { duration, iterations: Infinity, easing: 'linear' },
    )

    return () => { animRef.current?.cancel() }
  }, [data, speedPx])

  if (isError || !data) {
    return (
      <div className="flex items-center h-full px-6"
           style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-muted)', fontSize: '1rem' }}>
        {isError ? 'News unavailable' : 'Loading news...'}
      </div>
    )
  }

  // Duplicate for seamless loop
  const items = [...data.items, ...data.items]

  return (
    <div className="flex items-center h-full overflow-hidden"
         style={{ borderTop: '1px solid var(--color-border)' }}>
      <div ref={trackRef}
           className="flex items-center whitespace-nowrap"
           style={{ willChange: 'transform', gap: 0 }}>
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center"
                style={{ padding: '0 2.5rem', gap: '0.8rem' }}>
            <span style={{
              color: 'var(--color-accent)',
              fontSize: 'clamp(0.75rem, 1.4vw, 1rem)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {item.source}
            </span>
            <span style={{
              color: 'var(--color-text)',
              fontSize: 'clamp(0.9rem, 1.8vw, 1.3rem)',
              fontWeight: 400,
            }}>
              {item.title}
            </span>
            <span style={{ color: 'var(--color-border)', fontSize: '1.2em', flexShrink: 0 }}>
              {SEPARATOR}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
