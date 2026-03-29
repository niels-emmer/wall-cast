import type { WidgetProps } from '../base-registry'
import { WidgetShell } from '../WidgetShell'

interface InfoItem {
  label: string
  value: string
}

export function InfoWidget({ config }: WidgetProps) {
  const title = config.title as string | undefined
  const items = (config.items as InfoItem[]) ?? []

  return (
    <WidgetShell title={title} showDivider={!!title}>
      {items.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.65rem, 1vw, 0.8rem)',
          opacity: 0.5,
        }}>
          No items configured
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          minHeight: 0,
        }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}>
              <span style={{
                color: 'var(--color-muted)',
                fontSize: 'clamp(0.65rem, 1vw, 0.8rem)',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </span>
              <span style={{
                color: 'var(--color-text)',
                fontSize: 'clamp(0.75rem, 1.2vw, 0.95rem)',
                fontWeight: 500,
                textAlign: 'right',
              }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}
