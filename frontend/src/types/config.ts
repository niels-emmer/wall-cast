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

export interface PersonNotify {
  ntfy_topic?: string
  matrix_room_id?: string
}

export interface Person {
  id: string
  name: string
  family?: boolean
  calendar_ids?: string[]
  rss_feeds?: PersonRssFeed[]
  traffic?: PersonTraffic
  bus?: PersonBus
  notify?: PersonNotify
  rules?: Rule[]
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

export interface P2000Config {
  widget_enabled?: boolean
}

export interface AssistantNotifyNtfyConfig {
  enabled?: boolean
  url?: string
}

export interface AssistantNotifyMatrixConfig {
  enabled?: boolean
  homeserver?: string
  room_id?: string
}

export interface AssistantNotifyConfig {
  ntfy?: AssistantNotifyNtfyConfig
  matrix?: AssistantNotifyMatrixConfig
}

export interface AssistantAiConfig {
  provider?: 'none' | 'ollama' | 'openai'
  ollama_url?: string
  ollama_model?: string
  openai_model?: string
  // openai_api_key — set OPENAI_API_KEY in .env, never stored in YAML
}

export interface RuleCondition {
  variable: string          // e.g. "bus.delay_minutes"
  operator: string          // ">=" | "<=" | ">" | "<" | "==" | "in"
  value: number | string | boolean | string[]
  unit?: string | null      // "min" | "h" | "%" | null
}

export interface Rule {
  id: string
  title: string
  description?: string
  enabled: boolean
  condition?: RuleCondition        // LEGACY — single condition (still in YAML for old rules)
  conditions?: RuleCondition[]     // NEW — 1–3 conditions
  condition_logic?: 'and' | 'or'   // used when conditions.length > 1, default 'and'
}

/** Catalogue entry returned by GET /api/admin/rule-variables */
export interface RuleVariable {
  id: string
  label: string
  api_endpoint: string
  requires_person: boolean
  type: 'number' | 'boolean' | 'enum'
  default_unit: string | null
  operators: string[]
  enum_values?: string[]
}

export interface AssistantConfig {
  enabled?: boolean
  check_interval?: number
  backend_url?: string
  notify?: AssistantNotifyConfig
  ai?: AssistantAiConfig
  rules?: Rule[]
}

export interface SharedSection {
  location?: Location
  language?: string
  layout?: { columns: number; rows: number }
  widgets?: WidgetConfig[]
  people?: Person[]
  garbage?: GarbageConfig
  network?: NetworkConfig
  p2000?: P2000Config
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
  p2000?: P2000Config
}

export type AdminConfig = MultiScreenConfig | FlatConfig

export function isMultiScreen(cfg: AdminConfig): cfg is MultiScreenConfig {
  return 'screens' in cfg
}
