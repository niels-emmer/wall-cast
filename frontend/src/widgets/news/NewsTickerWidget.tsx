import { useEffect, useRef } from 'react'
import { useNews } from '../../hooks/use-news'

interface Props {
  config: Record<string, unknown>
}

export function NewsTickerWidget({ config }: Props) {
  const { data, isError } = useNews()
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<Animation | null>(null)

  const speedPx = (config.scroll_speed_px_per_sec as number) ?? 90

  useEffect(() => {
    const track = trackRef.current
    if (!track || !data?.items.length) return

    animRef.current?.cancel()

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
      <div style={{
        display: 'flex', alignItems: 'center', height: '100%', padding: '0 1.5rem',
        borderTop: '1px solid var(--color-border)',
        color: 'var(--color-muted)', fontSize: '1.1rem',
      }}>
        {isError ? 'News unavailable' : 'Loading news...'}
      </div>
    )
  }

  const items = [...data.items, ...data.items]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      overflow: 'hidden',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          willChange: 'transform',
          flexShrink: 0,
        }}
      >
        {items.map((item, i) => (
          <span key={i} style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0 2.5rem',
          }}>
            <span style={{
              color: 'var(--color-accent)',
              fontSize: 'clamp(1.2rem, 2.25vw, 1.65rem)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {item.source}
            </span>
            <span style={{
              color: 'var(--color-text)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 400,
            }}>
              {item.title}
            </span>
            <span style={{ color: 'var(--color-border)', fontSize: '1.2em', flexShrink: 0 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
