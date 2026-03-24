import { useQuery } from '@tanstack/react-query'
import type { NetworkData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useNetwork() {
  return useQuery<NetworkData>({
    queryKey: ['network'],
    queryFn: () => apiFetch<NetworkData>('/api/network'),
    // Retry quickly while the backend is still initializing (wan not yet available)
    refetchInterval: (query) => (!query.state.data?.wan ? 5 * 1000 : 30 * 1000),
    staleTime: 25 * 1000,
  })
}
