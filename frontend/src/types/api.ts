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
