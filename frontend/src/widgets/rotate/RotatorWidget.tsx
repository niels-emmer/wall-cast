import { useState, useEffect, useCallback, useRef } from 'react'
import { BASE_REGISTRY } from '../base-registry'
import type { WidgetProps } from '../base-registry'

interface SlotConfig {
  type: string
  config: Record<string, unknown>
  enabled?: boolean
}

/** Return the next index that is not in the skip set, wrapping around. */
function nextAvailable(current: number, total: number, skip: Set<number>): number {
  for (let d = 1; d < total; d++) {
    const candidate = (current + d) % total
    if (!skip.has(candidate)) return candidate
  }
  return current // all skipped — stay put
}

export function RotatorWidget({ config }: WidgetProps) {
  const allSlots = (config.widgets as SlotConfig[]) ?? []
  const slots = allSlots.filter(s => s.enabled !== false)
  const intervalSec = (config.interval_sec as number) ?? 30
  const [activeIdx, setActiveIdx] = useState(0)

  // skipSet is a ref so the setInterval effect never depends on it —
  // adding a skip does NOT reset the running timer.
  const skipSetRef = useRef<Set<number>>(new Set())
  // skipVersion triggers re-renders when skipSetRef changes.
  const [skipVersion, setSkipVersion] = useState(0)

  // Stable skip callbacks per slot index
  const skipCallbacks = useRef<Map<number, () => void>>(new Map())
  const getSkipCallback = useCallback((idx: number) => {
    if (!skipCallbacks.current.has(idx)) {
      skipCallbacks.current.set(idx, () => {
        if (skipSetRef.current.has(idx)) return
        const next = new Set(skipSetRef.current)
        next.add(idx)
        skipSetRef.current = next
        setSkipVersion(v => v + 1)
      })
    }
    return skipCallbacks.current.get(idx)!
  }, [])

  // If the currently active slot has been skipped, advance immediately.
  // Depends on skipVersion (not skipSetRef) so it re-runs on skip changes.
  useEffect(() => {
    if (skipSetRef.current.has(activeIdx) && slots.length > 0) {
      setActiveIdx(i => nextAvailable(i, slots.length, skipSetRef.current))
    }
  }, [skipVersion, activeIdx, slots.length])

  // Reset when slot count changes (e.g. config hot-reload)
  useEffect(() => {
    setActiveIdx(0)
    skipSetRef.current = new Set()
    skipCallbacks.current.clear()
    setSkipVersion(0)
  }, [slots.length])

  // Rotate on interval. Does NOT depend on skipSet — interval never resets
  // when a slot reports empty; instead the callback reads the ref directly.
  useEffect(() => {
    if (slots.length < 2) return
    const id = setInterval(() => {
      setActiveIdx(i => nextAvailable(i, slots.length, skipSetRef.current))
    }, intervalSec * 1000)
    return () => clearInterval(id)
  }, [slots.length, intervalSec])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {slots.map((slot, idx) => {
        const Component = BASE_REGISTRY[slot.type]
        if (!Component) return null
        const active = idx === activeIdx
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: active ? 1 : 0,
              transition: 'opacity var(--rotator-fade-duration, 0.8s) ease',
              pointerEvents: active ? 'auto' : 'none',
            }}
          >
            <Component
              config={slot.config ?? {}}
              onSkip={getSkipCallback(idx)}
            />
          </div>
        )
      })}
    </div>
  )
}
