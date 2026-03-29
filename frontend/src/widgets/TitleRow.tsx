import type { CSSProperties } from 'react'
import { fs, titleStyle } from './styles'

interface TitleRowProps {
  title: string
  /** Secondary label placed right after the title — rendered as-is, caller provides styling */
  titleSuffix?: React.ReactNode
  /** Data source name, e.g. "Open-Meteo" */
  source?: string
  /** Milliseconds epoch from TanStack Query dataUpdatedAt — hidden when 0 */
  dataUpdatedAt?: number
}

const metaStyle: CSSProperties = {
  fontSize:   fs.xs,
  color:      'var(--color-muted)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('nl', { hour: '2-digit', minute: '2-digit' })
}

export function TitleRow({ title, titleSuffix, source, dataUpdatedAt }: TitleRowProps) {
  const showMeta = source && dataUpdatedAt && dataUpdatedAt > 0

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexShrink: 0 }}>
      <span style={titleStyle}>{title}</span>
      {titleSuffix}
      {showMeta && <span style={{ flex: 1 }} />}
      {showMeta && (
        <span style={metaStyle}>
          {source} • {formatTime(dataUpdatedAt)}
        </span>
      )}
    </div>
  )
}
