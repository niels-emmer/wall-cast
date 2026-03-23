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
  fade_speed?: number
}

// ── Admin config (raw unmerged, returned by GET /api/admin/config) ───────────

export interface PersonTraffic {
  home_address?: string
  work_address?: string
  route_roads?: string
}

export interface PersonBus {
  stop_city?: string
  stop_name?: string
}

export interface PersonRssFeed {
  url: string
  label?: string
}

export interface Person {
  id: string
  name: string
  family?: boolean
  calendar_ids?: string[]
  rss_feeds?: PersonRssFeed[]
  traffic?: PersonTraffic
  bus?: PersonBus
}

export interface GarbageConfig {
  postcode?: string
  huisnummer?: string
}

export interface NetworkConfig {
  router_url?: string
  router_username?: string
  // router_password is NOT stored in YAML — set ROUTER_PASSWORD in .env
}

export interface AssistantNotifyConfig {
  ntfy_url?: string
  ntfy_topic?: string
}

export interface AssistantAiConfig {
  provider?: 'none' | 'ollama' | 'openai'
  ollama_url?: string
  ollama_model?: string
  openai_model?: string
  // openai_api_key — set OPENAI_API_KEY in .env, never stored in YAML
}

export interface AssistantRulesConfig {
  garbage_notify_hours_before?: number
  bus_delay_threshold_min?: number
  traffic_delay_threshold_pct?: number
  calendar_reminder_min?: number
}

export interface AssistantConfig {
  enabled?: boolean
  check_interval?: number
  backend_url?: string
  notify?: AssistantNotifyConfig
  ai?: AssistantAiConfig
  rules?: AssistantRulesConfig
}

export interface SharedSection {
  location?: Location
  language?: string
  layout?: { columns: number; rows: number }
  widgets?: WidgetConfig[]
  people?: Person[]
  garbage?: GarbageConfig
  network?: NetworkConfig
  assistant?: AssistantConfig
  fade_speed?: number
}

export interface ScreenSection {
  id: string
  name?: string
  enabled?: boolean   // undefined / true = active; false = disabled (no casting)
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
  garbage?: GarbageConfig
}

export type AdminConfig = MultiScreenConfig | FlatConfig

export function isMultiScreen(cfg: AdminConfig): cfg is MultiScreenConfig {
  return 'screens' in cfg
}
