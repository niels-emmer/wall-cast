import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface PollenDay {
  date:  string
  max:   number | null
  level: 'none' | 'low' | 'moderate' | 'high' | 'very_high'
}

export interface PollenSeries {
  species: 'birch' | 'grass' | 'alder' | 'mugwort' | 'ragweed'
  days:    PollenDay[]
}

export interface AirQualityData {
  current_aqi:       number | null
  aqi_level:         'good' | 'fair' | 'moderate' | 'poor' | 'very_poor' | 'extremely_poor' | 'unknown'
  pm2_5:             number | null
  pm10:              number | null
  nitrogen_dioxide:  number | null
  ozone:             number | null
  dust:              number | null
  pollen:            PollenSeries[]
}

export function useAirQuality() {
  return useQuery<AirQualityData>({
    queryKey: ['airquality'],
    queryFn: () => apiFetch<AirQualityData>('/api/airquality'),
    refetchInterval: 60 * 60 * 1000, // 1 hour
    staleTime:       55 * 60 * 1000,
  })
}
