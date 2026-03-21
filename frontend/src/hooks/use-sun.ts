import { useQuery } from '@tanstack/react-query'
import type { SunData } from '../types/api'

export function useSun() {
  return useQuery<SunData>({
    queryKey: ['sun'],
    queryFn: () => fetch('/api/sun').then(r => r.json()),
    refetchInterval: 6 * 60 * 60 * 1000,  // 6 h — sun times barely move
    staleTime:       6 * 60 * 60 * 1000,
  })
}
