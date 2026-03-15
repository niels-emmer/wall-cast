import type { WidgetConfig } from '../types/config'
import { WIDGET_REGISTRY } from './index'

interface Props {
  widget: WidgetConfig
}

export function WidgetRenderer({ widget }: Props) {
  const Component = WIDGET_REGISTRY[widget.type]

  if (!Component) {
    return (
      <div
        className="flex items-center justify-center h-full text-xs"
        style={{ color: 'var(--color-muted)', border: '1px dashed var(--color-border)', borderRadius: 8 }}
      >
        Unknown widget: {widget.type}
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-hidden"
      style={{ background: 'var(--color-panel)', borderRadius: 8 }}
    >
      <Component config={widget.config ?? {}} />
    </div>
  )
}
