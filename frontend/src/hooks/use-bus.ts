import { useQuery } from '@tanstack/react-query'
import type { BusData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useBus({ stopCode }: { stopCode?: string } = {}) {
  return useQuery<BusData>({
    queryKey: ['bus', stopCode ?? null],
    queryFn: () => {
      const params = new URLSearchParams()
      if (stopCode) params.set('stop_code', stopCode)
      const qs = params.toString()
      return apiFetch<BusData>(`/api/bus${qs ? `?${qs}` : ''}`)
    },
    refetchInterval: 30 * 1000,
    staleTime: 25 * 1000,
    retry: 1,
  })
}
