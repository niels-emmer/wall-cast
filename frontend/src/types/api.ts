// open-meteo response subset
export interface WeatherData {
  current_weather: {
    temperature: number
    windspeed: number
    weathercode: number
    time: string
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation_probability: number[]
    weathercode: number[]
    windspeed_10m: number[]
  }
  daily: {
    time: string[]
    weathercode: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
  }
}

export interface RainEntry {
  time: string
  mm_per_hour: number
}

export interface RainLevels {
  light: number
  moderate: number
  heavy: number
}

export interface RainData {
  forecast: RainEntry[]
  levels: RainLevels
  start_human: string
}

export interface NewsItem {
  source: string
  title: string
  link: string
  published: string
}

export interface NewsData {
  items: NewsItem[]
}

export interface GarbageCollection {
  type: 'gft' | 'pmd' | 'restafval'
  label: string
  date: string
  days_until: number
}

export interface GarbageData {
  collections: GarbageCollection[]
}

export interface PolestarData {
  soc: number | null
  range_km: number | null
  charging_status: string | null
  charging_connection_status: string | null
  charging_time_min: number | null
  charging_power_watts: number | null
  charging_current_amps: number | null
  odometer_km: number | null
  avg_consumption_kwh_per_100km: number | null
  avg_speed_kmh: number | null
  trip_auto_km: number | null
  trip_manual_km: number | null
  days_to_service: number | null
  distance_to_service_km: number | null
  service_warning: string | null
  brake_fluid_warning: string | null
  coolant_warning: string | null
  oil_warning: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  date: string
  color: string | null
  location: string | null
}

export interface CalendarDay {
  date: string
  day_label: string
  date_label: string
  events: CalendarEvent[]
}

export interface CalendarData {
  today: CalendarEvent[]
  week: CalendarDay[]
  today_label: string
}

export interface TrafficJam {
  road: string
  from: string
  to: string
  distance_km: number
  delay_min: number
  type: string
  on_route: boolean
}

export interface TrafficTravel {
  duration_min: number
  delay_min: number
  distance_km: number
}

export interface TrafficData {
  jams: TrafficJam[]
  travel: TrafficTravel | null
}

export interface KnmiWarning {
  level: 'geel' | 'oranje' | 'rood'
  phenomenon: string
  regions: string[]
  valid_from: string
  valid_until: string
  description: string
}

export interface WarningsData {
  warnings: KnmiWarning[]
}

export interface BusDeparture {
  line: string
  direction: string
  time: string        // HH:MM local time
  delay_min: number
  is_realtime: boolean
  cancelled: boolean
}

export interface BusData {
  stop: string
  city: string
  departures: BusDeparture[]
}

export interface SunData {
  sunrise: string
  sunset: string
  solar_noon: string
  golden_dawn_start: string
  golden_dawn_end: string
  golden_dusk_start: string
  golden_dusk_end: string
  day_length_h: number
  day_length_m: number
}
