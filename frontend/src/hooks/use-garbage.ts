import { useQuery } from '@tanstack/react-query'
import type { GarbageData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useGarbage() {
  return useQuery<GarbageData>({
    queryKey: ['garbage'],
    queryFn: () => apiFetch<GarbageData>('/api/garbage'),
    refetchInterval: 60 * 60 * 1000, // 1 hour
    staleTime: 55 * 60 * 1000,
  })
}
