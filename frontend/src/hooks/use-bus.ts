import { useQuery } from '@tanstack/react-query'
import type { BusData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useBus({ stopCity, stopName }: { stopCity?: string; stopName?: string } = {}) {
  return useQuery<BusData>({
    queryKey: ['bus', stopCity ?? null, stopName ?? null],
    queryFn: () => {
      const params = new URLSearchParams()
      if (stopCity) params.set('stop_city', stopCity)
      if (stopName) params.set('stop_name', stopName)
      const qs = params.toString()
      return apiFetch<BusData>(`/api/bus${qs ? `?${qs}` : ''}`)
    },
    refetchInterval: 30 * 1000,
    staleTime: 25 * 1000,
    retry: 1,
  })
}
