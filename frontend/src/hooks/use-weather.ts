import { useQuery } from '@tanstack/react-query'
import type { WeatherData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useWeather() {
  return useQuery<WeatherData>({
    queryKey: ['weather'],
    queryFn: () => apiFetch<WeatherData>('/api/weather'),
    refetchInterval: 15 * 60 * 1000, // 15 minutes
    staleTime: 14 * 60 * 1000,
  })
}
