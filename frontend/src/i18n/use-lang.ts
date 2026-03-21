import { useQuery } from '@tanstack/react-query'
import type { WallConfig } from '../types/config'
import { apiFetch } from '../lib/api'
import { LANGUAGES, nl, type Lang } from './translations'

export function useLang() {
  const { data: config } = useQuery<WallConfig>({
    queryKey: ['config'],
    queryFn: () => apiFetch<WallConfig>('/api/config'),
    staleTime: Infinity,
  })
  const lang = (config?.language as Lang) ?? 'nl'
  return LANGUAGES[lang] ?? nl
}
