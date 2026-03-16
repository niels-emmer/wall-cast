import { useQuery } from '@tanstack/react-query'
import type { CalendarData } from '../types/api'
import { apiFetch } from '../lib/api'

export function useCalendar() {
  return useQuery<CalendarData>({
    queryKey: ['calendar'],
    queryFn: () => apiFetch<CalendarData>('/api/calendar'),
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime:        9 * 60 * 1000,
    retry: 1,
  })
}
