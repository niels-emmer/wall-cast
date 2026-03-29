import type { CSSProperties } from 'react'
import { shellStyle, dividerStyle } from './styles'
import { TitleRow } from './TitleRow'

interface WidgetShellProps {
  /** Widget title — omit to hide the title row entirely */
  title?: string
  /** Secondary label placed right after the title (e.g. stop name, region) */
  titleSuffix?: React.ReactNode
  /** Data source name shown on the title row, e.g. "Open-Meteo" */
  source?: string
  /** Milliseconds epoch from TanStack Query dataUpdatedAt */
  dataUpdatedAt?: number
  /** Show divider below title row — default true */
  showDivider?: boolean
  /** Extra styles merged onto the outer container (e.g. opacity: 0 for hidden rotator slots) */
  containerStyle?: CSSProperties
  children: React.ReactNode
}

export function WidgetShell({
  title,
  titleSuffix,
  source,
  dataUpdatedAt,
  showDivider = true,
  containerStyle,
  children,
}: WidgetShellProps) {
  return (
    <div style={containerStyle ? { ...shellStyle, ...containerStyle } : shellStyle}>
      {title !== undefined && (
        <TitleRow
          title={title}
          titleSuffix={titleSuffix}
          source={source}
          dataUpdatedAt={dataUpdatedAt}
        />
      )}
      {title !== undefined && showDivider && <div style={dividerStyle} />}
      {children}
    </div>
  )
}
