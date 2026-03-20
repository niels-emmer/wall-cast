import { useQuery } from '@tanstack/react-query'
import type { TrafficData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useTraffic() {
  return useQuery<TrafficData>({
    queryKey: ['traffic'],
    queryFn: () => apiFetch<TrafficData>('/api/traffic'),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime:       4 * 60 * 1000,
    retry: 1,
  })
}
