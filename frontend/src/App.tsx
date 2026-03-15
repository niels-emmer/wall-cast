import { useConfig } from './hooks/use-config'
import { WidgetRenderer } from './widgets/WidgetRenderer'
import type { WidgetConfig } from './types/config'

export default function App() {
  const { data: config, isLoading, isError } = useConfig()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full"
        style={{ color: 'var(--color-muted)', fontSize: '1rem', letterSpacing: '0.2em' }}>
        LOADING
      </div>
    )
  }

  if (isError || !config) {
    return (
      <div className="flex items-center justify-center w-full h-full"
        style={{ color: '#ff4444', fontSize: '0.9rem' }}>
        Cannot reach wall-cast backend
      </div>
    )
  }

  const cols = config.layout?.columns ?? 12
  const rows = config.layout?.rows ?? 8
  const widgets: WidgetConfig[] = config.widgets ?? []

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        width: '100vw',
        height: '100vh',
        gap: '0.5rem',
        padding: '0.5rem',
        background: 'var(--color-bg)',
      }}
    >
      {widgets.map((widget) => (
        <div
          key={widget.id}
          style={{
            gridColumn: `${widget.col} / span ${widget.col_span}`,
            gridRow: `${widget.row} / span ${widget.row_span}`,
          }}
        >
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  )
}
