import type { WidgetConfig } from '../types/config'
import { WIDGET_REGISTRY } from './index'

interface Props {
  widget: WidgetConfig
}

export function WidgetRenderer({ widget }: Props) {
  const Component = WIDGET_REGISTRY[widget.type]

  const shell: React.CSSProperties = {
    height: '100%',
    overflow: 'hidden',
    background: 'var(--color-panel)',
    borderRadius: 8,
    boxSizing: 'border-box',
  }

  if (!Component) {
    return (
      <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', color: 'var(--color-muted)',
                    border: '1px dashed var(--color-border)' }}>
        Unknown widget: {widget.type}
      </div>
    )
  }

  return (
    <div style={shell}>
      <Component config={widget.config ?? {}} />
    </div>
  )
}
