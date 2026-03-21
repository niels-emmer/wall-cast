import { useQuery } from '@tanstack/react-query'
import type { WarningsData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useWarnings() {
  return useQuery<WarningsData>({
    queryKey: ['warnings'],
    queryFn: () => apiFetch<WarningsData>('/api/warnings'),
    refetchInterval: 15 * 60 * 1000, // 15 minutes
    staleTime:       14 * 60 * 1000,
    retry: 1,
  })
}
