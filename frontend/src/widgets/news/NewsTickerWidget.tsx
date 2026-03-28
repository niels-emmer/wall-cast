import { useEffect, useRef } from 'react'
import { useNews } from '../../hooks/use-news'
import { useNtfy, type NtfyMessage } from '../../hooks/use-ntfy'
import { useP2000 } from '../../hooks/use-p2000'
import type { P2000Incident } from '../../types/api'

interface Props {
  config: Record<string, unknown>
}

// ── Breaking-news item renderer ────────────────────────────────────────────────
function BreakingItem({ msg }: { msg: NtfyMessage }) {
  const hasTitle = msg.title && msg.title !== msg.message

  return (
    <span style={{
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.7rem',
      padding: '0 2.5rem',
    }}>
      {/* Blinking red dot */}
      <span style={{
        display: 'inline-block',
        width: '0.55em',
        height: '0.55em',
        borderRadius: '50%',
        background: '#e00',
        flexShrink: 0,
        animation: 'breaking-blink 1s step-start infinite',
      }} />

      {/* BREAKING badge */}
      <span style={{
        background: '#cc0000',
        color: '#fff',
        fontSize: 'clamp(1.1rem, 2.1vw, 1.55rem)',
        fontWeight: 900,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '0.08em 0.45em 0.1em',
        borderRadius: 4,
        flexShrink: 0,
        lineHeight: 1.2,
      }}>
        Breaking
      </span>

      {/* Optional title (in amber) if ntfy message has a distinct title */}
      {hasTitle && (
        <span style={{
          color: 'rgba(255, 200, 60, 1)',
          fontSize: 'clamp(1.875rem, 3.75vw, 2.8rem)',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {msg.title}
        </span>
      )}
      {hasTitle && (
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1em', flexShrink: 0 }}>—</span>
      )}

      {/* Message body */}
      <span style={{
        color: '#ffffff',
        fontSize: 'clamp(1.875rem, 3.75vw, 2.8rem)',
        fontWeight: 400,
      }}>
        {msg.message}
      </span>

      {/* Separator */}
      <span style={{ color: '#cc0000', fontSize: '1.2em', flexShrink: 0 }}>·</span>
    </span>
  )
}

// ── Normal news item renderer ──────────────────────────────────────────────────
function NewsItem({ source, title }: { source: string; title: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0 2.5rem',
    }}>
      <span style={{
        color: 'var(--color-accent)',
        fontSize: 'clamp(1.5rem, 2.8vw, 2.05rem)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {source}
      </span>
      <span style={{
        color: 'var(--color-text)',
        fontSize: 'clamp(1.875rem, 3.75vw, 2.8rem)',
        fontWeight: 400,
      }}>
        {title}
      </span>
      <span style={{ color: 'var(--color-border)', fontSize: '1.2em', flexShrink: 0 }}>·</span>
    </span>
  )
}

// ── P2000 alert item renderer ──────────────────────────────────────────────────
const DISC_ICON: Record<string, string> = {
  Brandweerdiensten: '🚒',
  Ambulancediensten: '🚑',
  Politiediensten:   '🚔',
}

function P2000TickerItem({ incident }: { incident: P2000Incident }) {
  const icon = DISC_ICON[incident.discipline] ?? '🚨'

  return (
    <span style={{
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.7rem',
      padding: '0 2.5rem',
    }}>
      {/* P2000 badge */}
      <span style={{
        background: '#ea580c',
        color: '#fff',
        fontSize: 'clamp(1.1rem, 2.1vw, 1.55rem)',
        fontWeight: 900,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '0.08em 0.45em 0.1em',
        borderRadius: 4,
        flexShrink: 0,
        lineHeight: 1.2,
      }}>
        P2000
      </span>

      {/* Discipline icon */}
      <span style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.9rem)', flexShrink: 0, lineHeight: 1 }}>
        {icon}
      </span>

      {/* Message */}
      <span style={{
        color: '#ffffff',
        fontSize: 'clamp(1.875rem, 3.75vw, 2.8rem)',
        fontWeight: 400,
      }}>
        {incident.message}
      </span>

      {/* Separator */}
      <span style={{ color: '#ea580c', fontSize: '1.2em', flexShrink: 0 }}>·</span>
    </span>
  )
}

// ── Main widget ────────────────────────────────────────────────────────────────
export function NewsTickerWidget({ config }: Props) {
  // Pass the screen ID so the backend can include personal feeds for assigned people
  const screen = new URLSearchParams(window.location.search).get('screen') ?? undefined
  const { data, isError } = useNews(screen)
  const breaking = useNtfy(
    config.ntfy_url  as string | undefined,
    config.ntfy_topic as string | undefined,
  )
  const p2000Enabled = !!(config.p2000_ticker as boolean | undefined)
  const { data: p2000Data } = useP2000(p2000Enabled)
  const p2000Alert = p2000Enabled ? (p2000Data?.incidents[0] ?? null) : null

  const trackRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<Animation | null>(null)

  const speedPx = (config.scroll_speed_px_per_sec as number) ?? 90

  // Restart animation whenever displayed content changes
  useEffect(() => {
    const track = trackRef.current
    if (!track || !data?.items.length) return

    animRef.current?.cancel()

    // offsetWidth alone is unreliable right after DOM change — measure after paint
    requestAnimationFrame(() => {
      if (!track) return
      const halfWidth = track.scrollWidth / 2
      if (halfWidth <= 0) return
      const duration = (halfWidth / speedPx) * 1000

      animRef.current = track.animate(
        [
          { transform: 'translateX(0)' },
          { transform: `translateX(-${halfWidth}px)` },
        ],
        { duration, iterations: Infinity, easing: 'linear' },
      )
    })

    return () => { animRef.current?.cancel() }
  }, [data, breaking, p2000Alert, speedPx])

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

  const newsItems = data.items

  // When breaking news is active, interleave it every ~3 news items so it
  // stays visible throughout the ticker rather than only at the very start.
  // freq = how many news items between each breaking insertion (min 1).
  const freq = breaking ? Math.max(1, Math.floor(newsItems.length / 3)) : Infinity

  // P2000 alerts inject every 2 items, max 3 times per half-cycle.
  const P2000_FREQ = 2
  const P2000_MAX  = 3

  const buildHalf = (prefix: string) => {
    let p2000Count = 0
    return newsItems.flatMap((item, i) => {
      const els = []
      if (breaking && i % freq === 0) {
        els.push(<BreakingItem key={`${prefix}-br-${i}`} msg={breaking} />)
      }
      if (p2000Alert && i % P2000_FREQ === 0 && p2000Count < P2000_MAX) {
        els.push(<P2000TickerItem key={`${prefix}-p2k-${i}`} incident={p2000Alert} />)
        p2000Count++
      }
      els.push(<NewsItem key={`${prefix}-n-${i}`} source={item.source} title={item.title} />)
      return els
    })
  }

  return (
    <>
      {/* Keyframe for blinking dot — injected once as a style tag */}
      <style>{`@keyframes breaking-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

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
          {/* Two identical passes for seamless infinite scroll */}
          {buildHalf('a')}
          {buildHalf('b')}
        </div>
      </div>
    </>
  )
}
