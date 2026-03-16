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
  odometer_km: number | null
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
