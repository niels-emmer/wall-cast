import type { ComponentType } from 'react'
import { ClockWidget } from './clock/ClockWidget'
import { WeatherWidget } from './weather/WeatherWidget'
import { RainWidget } from './rain/RainWidget'
import { NewsTickerWidget } from './news/NewsTickerWidget'
import { InfoWidget } from './info/InfoWidget'
import { GarbageWidget } from './garbage/GarbageWidget'
import { PolestarWidget } from './polestar/PolestarWidget'
import { CalendarWidget } from './calendar/CalendarWidget'

export interface WidgetProps {
  config: Record<string, unknown>
}

// Base registry — no RotatorWidget here to avoid a circular import.
// RotatorWidget imports this file; index.ts adds rotate on top.
export const BASE_REGISTRY: Record<string, ComponentType<WidgetProps>> = {
  clock: ClockWidget,
  weather: WeatherWidget,
  rain: RainWidget,
  news: NewsTickerWidget,
  info: InfoWidget,
  garbage: GarbageWidget,
  polestar: PolestarWidget,
  calendar: CalendarWidget,
}
