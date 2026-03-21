import { useQuery } from '@tanstack/react-query'
import type { RainData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useRain() {
  return useQuery<RainData>({
    queryKey: ['rain'],
    queryFn: () => apiFetch<RainData>('/api/rain'),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
  })
}
