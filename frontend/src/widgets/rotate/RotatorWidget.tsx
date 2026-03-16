import { useState, useEffect } from 'react'
import { BASE_REGISTRY } from '../base-registry'
import type { WidgetProps } from '../base-registry'

interface SlotConfig {
  type: string
  config: Record<string, unknown>
}

export function RotatorWidget({ config }: WidgetProps) {
  const slots = (config.widgets as SlotConfig[]) ?? []
  const intervalSec = (config.interval_sec as number) ?? 30
  const [activeIdx, setActiveIdx] = useState(0)

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
        return (
          <div
            key={idx}
            style={{
              display: idx === activeIdx ? 'block' : 'none',
              width: '100%',
              height: '100%',
            }}
          >
            <Component config={slot.config ?? {}} />
          </div>
        )
      })}
    </div>
  )
}
