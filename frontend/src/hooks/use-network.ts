import { useQuery } from '@tanstack/react-query'
import type { NetworkData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useNetwork() {
  return useQuery<NetworkData>({
    queryKey: ['network'],
    queryFn: () => apiFetch<NetworkData>('/api/network'),
    refetchInterval: 30 * 1000,
    staleTime: 25 * 1000,
  })
}
