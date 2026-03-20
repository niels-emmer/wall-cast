import { useQuery } from '@tanstack/react-query'
import type { GarbageData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useGarbage(daysAhead: number = 7) {
  return useQuery<GarbageData>({
    queryKey: ['garbage', daysAhead],
    queryFn: () => apiFetch<GarbageData>(`/api/garbage?days_ahead=${daysAhead}`),
    refetchInterval: 60 * 60 * 1000, // 1 hour
    staleTime: 55 * 60 * 1000,
  })
}
