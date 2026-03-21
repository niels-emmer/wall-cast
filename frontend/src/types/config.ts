// ── Display config (merged single-screen view returned by GET /api/config) ──────

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

// ── Admin config (raw unmerged, returned by GET /api/admin/config) ───────────

export interface Person {
  id: string
  name: string
  family?: boolean
  calendar_ids?: string[]
}

export interface SharedSection {
  location?: Location
  language?: string
  layout?: { columns: number; rows: number }
  widgets?: WidgetConfig[]
  people?: Person[]
}

export interface ScreenSection {
  id: string
  name?: string
  chromecast_ip?: string
  layout?: { columns: number; rows: number }
  location?: Location
  language?: string
  widgets?: WidgetConfig[]
  people?: string[]  // person IDs
}

/** Multi-screen format (new) */
export interface MultiScreenConfig {
  shared: SharedSection
  screens: ScreenSection[]
}

/** Flat single-screen format (old, still valid) */
export interface FlatConfig {
  location?: Location
  language?: string
  layout?: { columns: number; rows: number }
  widgets?: WidgetConfig[]
}

export type AdminConfig = MultiScreenConfig | FlatConfig

export function isMultiScreen(cfg: AdminConfig): cfg is MultiScreenConfig {
  return 'screens' in cfg
}
