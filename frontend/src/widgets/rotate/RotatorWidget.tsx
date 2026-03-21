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
  const [skipSet, setSkipSet] = useState<Set<number>>(new Set())

  // Stable skip callbacks per slot index, memoised to avoid re-renders
  const skipCallbacks = useRef<Map<number, () => void>>(new Map())
  const getSkipCallback = useCallback((idx: number) => {
    if (!skipCallbacks.current.has(idx)) {
      skipCallbacks.current.set(idx, () => {
        setSkipSet(prev => {
          if (prev.has(idx)) return prev
          const next = new Set(prev)
          next.add(idx)
          return next
        })
      })
    }
    return skipCallbacks.current.get(idx)!
  }, [])

  // If the currently active slot gets skipped, advance immediately
  useEffect(() => {
    if (skipSet.has(activeIdx) && slots.length > 0) {
      setActiveIdx(i => nextAvailable(i, slots.length, skipSet))
    }
  }, [skipSet, activeIdx, slots.length])

  // Reset when slot count changes (e.g. config hot-reload)
  useEffect(() => {
    setActiveIdx(0)
    setSkipSet(new Set())
    skipCallbacks.current.clear()
  }, [slots.length])

  // Rotate on interval, skipping empty slots
  useEffect(() => {
    const available = slots.length - skipSet.size
    if (available < 2) return
    const id = setInterval(() => {
      setActiveIdx(i => nextAvailable(i, slots.length, skipSet))
    }, intervalSec * 1000)
    return () => clearInterval(id)
  }, [slots.length, intervalSec, skipSet])

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
              transition: 'opacity 0.8s ease',
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
