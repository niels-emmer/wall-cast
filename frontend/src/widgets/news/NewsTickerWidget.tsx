import { useCallback, useEffect, useRef, useState } from 'react'
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

// ── Segment types ──────────────────────────────────────────────────────────────

type SegmentItem =
  | { kind: 'news';     source: string; title: string;  key: string }
  | { kind: 'breaking'; msg: NtfyMessage;               key: string }
  | { kind: 'p2000';    incident: P2000Incident;        key: string }

const P2000_FREQ  = 2
const P2000_MAX   = 3
const BREAK_TIMES = 5  // how many times breaking item appears per ntfy message

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

  // Current rendered segment — changing this triggers a new animation pass
  const [segment, setSegment] = useState<SegmentItem[]>([])

  // Refs to avoid stale closures in animation callbacks
  const dataRef         = useRef(data)
  const p2000Ref        = useRef(p2000Alert)
  const pendingBreakRef = useRef<NtfyMessage | null>(null)
  const seenBreakIdRef  = useRef<string | null>(null)
  const newsOffsetRef   = useRef(0)          // rotation position in news array
  const hasSegmentRef   = useRef(false)      // prevents double-build on first data load

  const speedPx = (config.scroll_speed_px_per_sec as number) ?? 90

  // Keep live values accessible from callbacks without stale closures
  useEffect(() => { p2000Ref.current = p2000Alert }, [p2000Alert])

  // When a new ntfy message arrives, queue it — do NOT restart the animation
  useEffect(() => {
    if (!breaking) return
    if (breaking.id === seenBreakIdRef.current) return  // already seen this message
    seenBreakIdRef.current = breaking.id
    pendingBreakRef.current = breaking
  }, [breaking])

  // Build the next segment. Called on animation end (onfinish) and on first data load.
  // All data is read from refs so this callback stays stable for the animation lifecycle.
  const buildNextSegment = useCallback(() => {
    const news = dataRef.current?.items ?? []
    if (news.length === 0) return

    const p2000   = p2000Ref.current
    const pending = pendingBreakRef.current
    let items: SegmentItem[]

    if (pending) {
      // Breaking segment: [breaking, news] × BREAK_TIMES
      pendingBreakRef.current = null
      items = []
      for (let i = 0; i < BREAK_TIMES; i++) {
        items.push({ kind: 'breaking', msg: pending, key: `br-${i}` })
        const ni = newsOffsetRef.current % news.length
        newsOffsetRef.current = (newsOffsetRef.current + 1) % news.length
        items.push({ kind: 'news', source: news[ni].source, title: news[ni].title, key: `nb-${ni}-${i}` })
      }
    } else {
      // Normal segment: all news items, starting from current offset, with P2000 interleaved
      items = []
      let p2000Count = 0
      const start = newsOffsetRef.current
      for (let i = 0; i < news.length; i++) {
        const idx = (start + i) % news.length
        if (p2000 && i % P2000_FREQ === 0 && p2000Count < P2000_MAX) {
          items.push({ kind: 'p2000', incident: p2000, key: `p2k-${idx}-${i}` })
          p2000Count++
        }
        items.push({ kind: 'news', source: news[idx].source, title: news[idx].title, key: `n-${idx}-${i}` })
      }
      // Advance offset by 1 so consecutive normal segments rotate through the news list
      newsOffsetRef.current = (start + 1) % news.length
    }

    hasSegmentRef.current = true
    setSegment(items)
  }, [])

  // Seed the first segment when news data arrives
  useEffect(() => {
    dataRef.current = data
    if (!data?.items.length) return
    if (!hasSegmentRef.current) buildNextSegment()
  }, [data, buildNextSegment])

  // Run a single-pass animation for the current segment; wire onfinish → buildNextSegment
  useEffect(() => {
    const track = trackRef.current
    if (!track || segment.length === 0) return

    animRef.current?.cancel()

    // Measure after paint so scrollWidth reflects the new DOM
    requestAnimationFrame(() => {
      if (!track) return
      const halfWidth = track.scrollWidth / 2
      if (halfWidth <= 0) return
      const duration = (halfWidth / speedPx) * 1000

      const anim = track.animate(
        [
          { transform: 'translateX(0)' },
          { transform: `translateX(-${halfWidth}px)` },
        ],
        { duration, iterations: 1, easing: 'linear' },
      )
      // When this pass ends, build the next segment (checks pendingBreakRef)
      anim.onfinish = buildNextSegment
      animRef.current = anim
    })

    return () => { animRef.current?.cancel() }
  }, [segment, speedPx, buildNextSegment])

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

  const renderItem = (item: SegmentItem, prefix: string) => {
    const key = `${prefix}-${item.key}`
    switch (item.kind) {
      case 'news':     return <NewsItem          key={key} source={item.source} title={item.title} />
      case 'breaking': return <BreakingItem      key={key} msg={item.msg} />
      case 'p2000':    return <P2000TickerItem   key={key} incident={item.incident} />
    }
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
          {/* Two identical passes — seamless scroll within a segment */}
          {segment.map(item => renderItem(item, 'a'))}
          {segment.map(item => renderItem(item, 'b'))}
        </div>
      </div>
    </>
  )
}
