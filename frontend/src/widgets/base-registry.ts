import type { ComponentType } from 'react'
import { ClockWidget } from './clock/ClockWidget'
import { WeatherWidget } from './weather/WeatherWidget'
import { RainWidget } from './rain/RainWidget'
import { NewsTickerWidget } from './news/NewsTickerWidget'
import { InfoWidget } from './info/InfoWidget'
import { GarbageWidget } from './garbage/GarbageWidget'
import { PolestarWidget } from './polestar/PolestarWidget'
import { CalendarWidget } from './calendar/CalendarWidget'
import { TrafficWidget } from './traffic/TrafficWidget'
import { WarningsWidget } from './warnings/WarningsWidget'
import { BusWidget } from './bus/BusWidget'
import { NetworkWidget } from './network/NetworkWidget'
import { AirQualityWidget } from './airquality/AirQualityWidget'
import { MarketWidget } from './market/MarketWidget'
import { P2000Widget } from './p2000/P2000Widget'
import { TruthometerWidget } from './truthometer/TruthometerWidget'

export interface WidgetProps {
  config: Record<string, unknown>
  /** Called by a widget to signal it has no content — RotatorWidget skips it. */
  onSkip?: () => void
  /** Called by a widget to signal content is available again — RotatorWidget re-enables it. */
  onUnskip?: () => void
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
  traffic: TrafficWidget,
  warnings: WarningsWidget,
  bus: BusWidget,
  network:     NetworkWidget,
  airquality:  AirQualityWidget,
  market:       MarketWidget,
  p2000:        P2000Widget,
  truthometer:  TruthometerWidget,
}
