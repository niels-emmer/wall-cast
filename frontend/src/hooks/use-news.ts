import { useQuery } from '@tanstack/react-query'
import type { NewsData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useNews() {
  return useQuery<NewsData>({
    queryKey: ['news'],
    queryFn: () => apiFetch<NewsData>('/api/news'),
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime: 9 * 60 * 1000,
  })
}
