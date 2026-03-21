import { useState, useEffect } from 'react'

export interface NtfyMessage {
  id: string
  time: number
  message: string
  title?: string
}

/**
 * Subscribes to an ntfy topic via SSE and returns the latest message.
 * Reconnects automatically on error with 5s backoff.
 */
export function useNtfy(url?: string, topic?: string): NtfyMessage | null {
  const [latest, setLatest] = useState<NtfyMessage | null>(null)

  useEffect(() => {
    if (!url || !topic) return

    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const connect = () => {
      if (cancelled) return

      // ntfy SSE endpoint: GET /<topic>/sse
      es = new EventSource(`${url}/${topic}/sse`)

      // ntfy sends `event: message` for real messages
      es.addEventListener('message', (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string)
          // JSON payload also has an `event` field — filter keepalive/open
          if (msg.event === 'message') {
            setLatest({
              id:      msg.id      ?? '',
              time:    msg.time    ?? Date.now() / 1000,
              message: msg.message ?? '',
              title:   msg.title,
            })
          }
        } catch {
          // ignore malformed payloads
        }
      })

      es.onerror = () => {
        es?.close()
        if (!cancelled) {
          timer = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      es?.close()
      if (timer) clearTimeout(timer)
    }
  }, [url, topic])

  return latest
}
