import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WallConfig } from '../types/config'
import { apiFetch } from '../lib/api'

// Persists for the lifetime of the page — survives React re-renders.
// null = not yet received; any string = known startup ID.
let _knownStartupId: string | null = null

// Read the ?screen= param once at module load — it never changes during a page session.
function getScreenId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('screen')
}

const SCREEN_ID = getScreenId()

export function useConfig() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // SSE stream: all screens share one stream. On config-updated each screen
    // re-fetches its own /api/config?screen=<id>.
    const source = new EventSource('/api/config/stream')

    source.addEventListener('server-hello', (e) => {
      const { startup_id } = JSON.parse(e.data) as { startup_id: string }
      if (_knownStartupId !== null && _knownStartupId !== startup_id) {
        console.info('[wall-cast] Backend restarted — reloading for fresh assets.')
        window.location.reload()
      }
      _knownStartupId = startup_id
    })

    source.addEventListener('config-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['config', SCREEN_ID] })
      queryClient.invalidateQueries({ queryKey: ['news'] })
    })

    source.onerror = () => {
      console.warn('[wall-cast] SSE connection lost, reconnecting...')
    }

    return () => source.close()
  }, [queryClient])

  return useQuery<WallConfig>({
    queryKey: ['config', SCREEN_ID],
    queryFn: () => {
      const url = SCREEN_ID
        ? `/api/config?screen=${encodeURIComponent(SCREEN_ID)}`
        : '/api/config'
      return apiFetch<WallConfig>(url)
    },
    staleTime: Infinity, // SSE handles invalidation
  })
}
