import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { TruthometerData } from '../types/api'

export function useTruthometer() {
  return useQuery<TruthometerData>({
    queryKey:       ['truthometer'],
    queryFn:        () => apiFetch<TruthometerData>('/api/truthometer'),
    refetchInterval: 5 * 60 * 1000,
    staleTime:       4 * 60 * 1000,
    retry: 1,
  })
}
