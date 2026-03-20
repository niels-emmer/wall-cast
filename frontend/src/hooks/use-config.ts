import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WallConfig } from '../types/config'
import { apiFetch } from '../lib/api'

// Persists for the lifetime of the page — survives React re-renders.
// null = not yet received; any string = known startup ID.
let _knownStartupId: string | null = null

export function useConfig() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource('/api/config/stream')

    // Detect backend restarts: reload the page when the startup ID changes.
    // This ensures the Chromecast always runs the latest frontend build.
    source.addEventListener('server-hello', (e) => {
      const { startup_id } = JSON.parse(e.data) as { startup_id: string }
      if (_knownStartupId !== null && _knownStartupId !== startup_id) {
        console.info('[wall-cast] Backend restarted — reloading for fresh assets.')
        window.location.reload()
      }
      _knownStartupId = startup_id
    })

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
