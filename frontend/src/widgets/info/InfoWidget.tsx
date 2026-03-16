import type { WidgetProps } from '../base-registry'

interface InfoItem {
  label: string
  value: string
}

export function InfoWidget({ config }: WidgetProps) {
  const title = config.title as string | undefined
  const items = (config.items as InfoItem[]) ?? []

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0.75rem 0.85rem 0.55rem',
      boxSizing: 'border-box',
      gap: '0.5rem',
    }}>
      {title && (
        <div style={{
          fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)',
          fontWeight: 600,
          color: 'var(--color-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: '0.4rem',
        }}>
          {title}
        </div>
      )}

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
    </div>
  )
}
