import type { ComponentType } from 'react'
import { ClockWidget } from './clock/ClockWidget'
import { WeatherWidget } from './weather/WeatherWidget'
import { RainWidget } from './rain/RainWidget'
import { NewsTickerWidget } from './news/NewsTickerWidget'

export interface WidgetProps {
  config: Record<string, unknown>
}

export const WIDGET_REGISTRY: Record<string, ComponentType<WidgetProps>> = {
  clock: ClockWidget,
  weather: WeatherWidget,
  rain: RainWidget,
  news: NewsTickerWidget,
}
