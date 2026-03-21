import { useQuery } from '@tanstack/react-query'
import type { GarbageData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useGarbage({
  daysAhead = 7,
  postcode,
  huisnummer,
}: {
  daysAhead?: number
  postcode?: string
  huisnummer?: string
} = {}) {
  return useQuery<GarbageData>({
    queryKey: ['garbage', daysAhead, postcode ?? null, huisnummer ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ days_ahead: String(daysAhead) })
      if (postcode) params.set('postcode', postcode)
      if (huisnummer) params.set('huisnummer', huisnummer)
      return apiFetch<GarbageData>(`/api/garbage?${params.toString()}`)
    },
    refetchInterval: 60 * 60 * 1000,
    staleTime: 55 * 60 * 1000,
  })
}
