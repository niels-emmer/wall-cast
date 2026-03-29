import { usePolestar } from '../../hooks/use-polestar'
import { useLang } from '../../i18n/use-lang'
import type { WidgetProps } from '../base-registry'
import type { Translations } from '../../i18n/translations'
import { fs, sp } from '../styles'
import { WidgetShell } from '../WidgetShell'

function socColor(soc: number): string {
  if (soc >= 60) return '#4caf50'
  if (soc >= 25) return '#ff9800'
  return '#f44336'
}

function isActivelyCharging(status: string | null): boolean {
  return status?.includes('CHARGING') === true && !status?.includes('IDLE') && !status?.includes('DONE') && !status?.includes('FAULT')
}
function isConnected(connection: string | null): boolean {
  return connection?.includes('CONNECTED') === true && !connection?.includes('DISCONNECTED')
}

function chargingIcon(status: string | null, _connection: string | null): string {
  if (isActivelyCharging(status)) return '⚡'
  return '🔌'
}

function chargingIconOpacity(status: string | null, connection: string | null): number {
  if (isActivelyCharging(status) || isConnected(connection)) return 1
  return 0.25
}

function serviceLabel(warning: string | null, t: Translations): string | null {
  if (!warning) return null
  if (warning.includes('OVERDUE')) return t.serviceOverdue
  if (warning.includes('TIME_FOR_SERVICE')) return t.timeForService
  if (warning.includes('ALMOST')) return t.serviceAlmostNeeded
  if (warning.includes('REQUIRED')) return t.serviceRequired
  return t.serviceNotification
}

function fluidLabel(warning: string | null, fluid: 'brake' | 'coolant' | 'oil', t: Translations): string | null {
  if (!warning) return null
  const name = { brake: t.brakeFluid, coolant: t.coolant, oil: t.oil }[fluid]
  if (warning.includes('TOO_LOW')) return `${name} ${t.fluidTooLow}`
  if (warning.includes('TOO_HIGH')) return `${name} ${t.fluidTooHigh}`
  if (warning.includes('SERVICE_REQUIRED')) return `${name}: ${t.fluidServiceRequired}`
  return `${name}: ${t.fluidCheck}`
}

function chargingLabel(status: string | null, connection: string | null, t: Translations): string {
  if (isActivelyCharging(status)) return t.charging
  if (isConnected(connection)) return t.connected
  return t.notConnected
}

export function PolestarWidget({ config: _config }: WidgetProps) {
  const t = useLang()
  const { data, isError, isLoading } = usePolestar()

  if (isLoading) return <WidgetShell title="Polestar">{null}</WidgetShell>

  if (isError || !data) return (
    <WidgetShell title="Polestar">
      <span style={{ color: 'var(--color-muted)', fontSize: fs.md, marginTop: '0.3rem' }}>
        {t.polestarUnavailable}
      </span>
    </WidgetShell>
  )

  const soc        = data.soc ?? 0
  const color      = socColor(soc)
  const isCharging = isActivelyCharging(data.charging_status)
  const serviceMsg = serviceLabel(data.service_warning, t)
  const fluidAlerts = [
    fluidLabel(data.brake_fluid_warning, 'brake', t),
    fluidLabel(data.coolant_warning, 'coolant', t),
    fluidLabel(data.oil_warning, 'oil', t),
  ].filter(Boolean) as string[]
  const capKw = data.charging_power_watts != null ? (data.charging_power_watts / 1000).toFixed(1) : null
  const capA  = data.charging_current_amps

  return (
    <WidgetShell title="Polestar">

      {/* SOC + range */}
      <div style={{
        display:    'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap:        '0.55rem',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize:           fs.hero,
          fontWeight:         900,
          color,
          lineHeight:         1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {soc}%
        </span>
        {data.range_km != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp.innerGap }}>
            <span style={{
              fontSize:           fs.lg,
              fontWeight:         700,
              color:              'var(--color-text)',
              lineHeight:         1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {data.range_km} km
            </span>
            <span style={{ fontSize: fs.sm, color: 'var(--color-muted)', lineHeight: 1 }}>
              {t.range}
            </span>
          </div>
        )}
      </div>

      {/* Battery bar */}
      <div style={{
        height:       '6px',
        background:   'rgba(255,255,255,0.08)',
        borderRadius: '3px',
        flexShrink:   0,
        overflow:     'hidden',
      }}>
        <div style={{
          height:       '100%',
          width:        `${soc}%`,
          background:   color,
          borderRadius: '3px',
        }} />
      </div>

      {/* Charging status */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '0.5rem',
        flexShrink: 0,
        marginTop:  '0.35rem',
      }}>
        <span style={{
          fontSize:  fs.md,
          lineHeight: 1,
          opacity:   chargingIconOpacity(data.charging_status, data.charging_connection_status),
        }}>
          {chargingIcon(data.charging_status, data.charging_connection_status)}
        </span>
        <span style={{
          color:      isCharging ? '#4caf50' : 'var(--color-muted)',
          fontSize:   fs.md,
          lineHeight: 1,
        }}>
          {chargingLabel(data.charging_status, data.charging_connection_status, t)}
        </span>
        {isCharging && (capKw || capA) && (
          <span style={{ color: 'var(--color-muted)', fontSize: fs.sm, marginLeft: '0.2rem' }}>
            {capKw && `${capKw} kW`}{capKw && capA ? ' · ' : ''}{capA ? `${capA} A` : ''}
          </span>
        )}
        {isCharging && data.charging_time_min != null && data.charging_time_min > 0 && (
          <span style={{
            color:       'var(--color-muted)',
            fontSize:    fs.sm,
            marginLeft:  'auto',
          }}>
            {t.fullIn(Math.floor(data.charging_time_min / 60), data.charging_time_min % 60)}
          </span>
        )}
      </div>

      {/* Stats: consumption + avg speed */}
      {(data.avg_consumption_kwh_per_100km != null || data.avg_speed_kmh != null) && (
        <div style={{
          display:    'flex',
          gap:        '1rem',
          flexShrink: 0,
          color:      'var(--color-muted)',
          fontSize:   fs.sm,
        }}>
          {data.avg_consumption_kwh_per_100km != null && (
            <span>{data.avg_consumption_kwh_per_100km.toFixed(1)} kWh/100km</span>
          )}
          {data.avg_speed_kmh != null && (
            <span>{t.avg} {data.avg_speed_kmh} km/u</span>
          )}
        </div>
      )}

      {/* Trip meters */}
      {(data.trip_auto_km != null || data.trip_manual_km != null) && (
        <div style={{
          display:    'flex',
          gap:        '1rem',
          flexShrink: 0,
          color:      'var(--color-muted)',
          fontSize:   fs.sm,
        }}>
          {data.trip_auto_km != null && (
            <span>{t.tripA}: {data.trip_auto_km.toFixed(1)} km</span>
          )}
          {data.trip_manual_km != null && (
            <span>{t.tripB}: {data.trip_manual_km.toFixed(1)} km</span>
          )}
        </div>
      )}

      {/* Service warning tag — only shown when active */}
      {serviceMsg && (
        <div style={{
          display:     'inline-flex',
          alignItems:  'center',
          gap:         '0.4em',
          padding:     sp.cardPad,
          background:  'rgba(255,152,0,0.12)',
          border:      '1px solid rgba(255,152,0,0.35)',
          borderRadius: sp.cardRadius,
          flexShrink:  0,
          alignSelf:   'flex-start',
        }}>
          <span style={{ fontSize: fs.sm }}>⚠</span>
          <span style={{ color: '#ff9800', fontSize: fs.sm, fontWeight: 500 }}>
            {serviceMsg}
            {(data.days_to_service != null || data.distance_to_service_km != null) && (
              <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>
                {data.days_to_service != null ? ` · ${data.days_to_service}d` : ''}
                {data.distance_to_service_km != null ? ` · ${data.distance_to_service_km.toLocaleString('nl-NL')} km` : ''}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Fluid warnings — only shown when active */}
      {fluidAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp.listGap, flexShrink: 0 }}>
          {fluidAlerts.map(msg => (
            <div key={msg} style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          '0.4em',
              padding:      sp.cardPad,
              background:   'rgba(244,67,54,0.12)',
              border:       '1px solid rgba(244,67,54,0.35)',
              borderRadius: sp.cardRadius,
              alignSelf:    'flex-start',
            }}>
              <span style={{ fontSize: fs.sm }}>⚠</span>
              <span style={{ color: '#f44336', fontSize: fs.sm, fontWeight: 500 }}>
                {msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Odometer */}
      {data.odometer_km != null && (
        <div style={{
          marginTop: 'auto',
          color:     'var(--color-muted)',
          fontSize:  fs.sm,
          opacity:   0.55,
        }}>
          {data.odometer_km.toLocaleString('nl-NL')} km
        </div>
      )}
    </WidgetShell>
  )
}
