import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WallConfig } from '../types/config'
import { apiFetch } from '../lib/api'

export function useConfig() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource('/api/config/stream')

    source.addEventListener('config-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
    })

    source.onerror = () => {
      // SSE auto-reconnects; log silently
      console.warn('[wall-cast] SSE connection lost, reconnecting...')
    }

    return () => source.close()
  }, [queryClient])

  return useQuery<WallConfig>({
    queryKey: ['config'],
    queryFn: () => apiFetch<WallConfig>('/api/config'),
    staleTime: Infinity, // SSE handles invalidation
  })
}
