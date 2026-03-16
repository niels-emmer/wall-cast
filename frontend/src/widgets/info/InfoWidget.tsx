import type { WidgetProps } from '../index'

export function InfoWidget({ config: _config }: WidgetProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0.75rem 0.85rem 0.55rem',
      boxSizing: 'border-box',
    }} />
  )
}
