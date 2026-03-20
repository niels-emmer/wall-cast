import { useState, useEffect } from 'react'
import { BASE_REGISTRY } from '../base-registry'
import type { WidgetProps } from '../base-registry'

interface SlotConfig {
  type: string
  config: Record<string, unknown>
  enabled?: boolean
}

export function RotatorWidget({ config }: WidgetProps) {
  const allSlots = (config.widgets as SlotConfig[]) ?? []
  const slots = allSlots.filter(s => s.enabled !== false)
  const intervalSec = (config.interval_sec as number) ?? 30
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    setActiveIdx(0)
  }, [slots.length])

  useEffect(() => {
    if (slots.length < 2) return
    const id = setInterval(() => {
      setActiveIdx(i => (i + 1) % slots.length)
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
              transition: 'opacity 0.8s ease',
              pointerEvents: active ? 'auto' : 'none',
            }}
          >
            <Component config={slot.config ?? {}} />
          </div>
        )
      })}
    </div>
  )
}
