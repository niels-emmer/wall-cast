export interface Location {
  lat: number
  lon: number
  name: string
}

export interface WidgetConfig {
  id: string
  type: string
  col: number
  row: number
  col_span: number
  row_span: number
  config: Record<string, unknown>
}

export interface WallConfig {
  location: Location
  layout: {
    columns: number
    rows: number
  }
  language?: string
  widgets: WidgetConfig[]
}
