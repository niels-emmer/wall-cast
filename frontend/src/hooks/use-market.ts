import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { MarketData } from '../types/api'

export function useMarket() {
  return useQuery<MarketData>({
    queryKey: ['market'],
    queryFn:  () => apiFetch<MarketData>('/api/market'),
    refetchInterval: 5 * 60 * 1000,
    staleTime:       4 * 60 * 1000,
    retry: 1,
  })
}
