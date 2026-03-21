import { useQuery } from '@tanstack/react-query'
import type { CalendarData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useCalendar({ calendarIds }: { calendarIds?: string[] } = {}) {
  return useQuery<CalendarData>({
    queryKey: ['calendar', ...(calendarIds ?? [])],
    queryFn: () => {
      const params = new URLSearchParams()
      if (calendarIds?.length) {
        calendarIds.forEach(id => params.append('calendar_ids', id))
      }
      const qs = params.toString()
      return apiFetch<CalendarData>(`/api/calendar${qs ? `?${qs}` : ''}`)
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime:        9 * 60 * 1000,
    retry: 1,
  })
}
