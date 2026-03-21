import { useQuery } from '@tanstack/react-query'
import type { TrafficData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useTraffic({
  home,
  work,
  routeRoads,
}: {
  home?: string
  work?: string
  routeRoads?: string
} = {}) {
  return useQuery<TrafficData>({
    queryKey: ['traffic', home ?? null, work ?? null, routeRoads ?? null],
    queryFn: () => {
      const params = new URLSearchParams()
      if (home) params.set('home', home)
      if (work) params.set('work', work)
      if (routeRoads) params.set('route_roads', routeRoads)
      const qs = params.toString()
      return apiFetch<TrafficData>(`/api/traffic${qs ? `?${qs}` : ''}`)
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime:       4 * 60 * 1000,
    retry: 1,
  })
}
