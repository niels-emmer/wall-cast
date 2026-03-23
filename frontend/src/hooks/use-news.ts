import { useQuery } from '@tanstack/react-query'
import type { NewsData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useNews(screen?: string) {
  const url = screen ? `/api/news?screen=${encodeURIComponent(screen)}` : '/api/news'
  return useQuery<NewsData>({
    queryKey: ['news', screen ?? ''],
    queryFn: () => apiFetch<NewsData>(url),
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime: 9 * 60 * 1000,
  })
}
