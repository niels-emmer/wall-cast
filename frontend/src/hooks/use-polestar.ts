import { useQuery } from '@tanstack/react-query'
import type { PolestarData } from '../types/api'
import { apiFetch } from '../lib/api'

export function usePolestar() {
  return useQuery<PolestarData>({
    queryKey: ['polestar'],
    queryFn: () => apiFetch<PolestarData>('/api/polestar'),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
    retry: 1,
  })
}
