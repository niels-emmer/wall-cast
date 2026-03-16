import type { ComponentType } from 'react'
import { BASE_REGISTRY } from './base-registry'
import { RotatorWidget } from './rotate/RotatorWidget'

export type { WidgetProps } from './base-registry'

export const WIDGET_REGISTRY: Record<string, ComponentType<{ config: Record<string, unknown> }>> = {
  ...BASE_REGISTRY,
  rotate: RotatorWidget,
}
