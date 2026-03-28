import { useQuery } from '@tanstack/react-query'
import type { P2000Data } from '../types/api'
import { apiFetch } from '../lib/api'

/**
 * Fetches P2000 emergency alert data from /api/p2000.
 * Backend derives the region from shared.location and returns filtered,
 * deduplicated incidents for the past 6 hours.
 *
 * Pass enabled=false to skip fetching (e.g. when feature is toggled off).
 */
export function useP2000(enabled = true) {
  return useQuery<P2000Data>({
    queryKey: ['p2000'],
    queryFn:  () => apiFetch<P2000Data>('/api/p2000'),
    enabled,
    refetchInterval: 30_000,
    staleTime:       25_000,
    retry: 1,
  })
}
