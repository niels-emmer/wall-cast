import { usePolestar } from '../../hooks/use-polestar'
import type { WidgetProps } from '../base-registry'

function socColor(soc: number): string {
  if (soc >= 60) return '#4caf50'   // green
  if (soc >= 25) return '#ff9800'   // amber
  return '#f44336'                  // red
}

// Polestar enum names come in as e.g. "CHARGING_STATUS_CHARGING", "CHARGING_STATUS_IDLE"
function isActivelyCharging(status: string | null): boolean {
  return status?.includes('CHARGING') === true && !status?.includes('IDLE') && !status?.includes('DONE') && !status?.includes('FAULT')
}
function isConnected(connection: string | null): boolean {
  return connection?.includes('CONNECTED') === true && !connection?.includes('DISCONNECTED')
}

function chargingLabel(status: string | null, connection: string | null): string {
  if (isActivelyCharging(status)) return 'Aan het laden'
  if (isConnected(connection)) return 'Aangesloten'
  return 'Niet aangesloten'
}

function chargingIcon(status: string | null, _connection: string | null): string {
  if (isActivelyCharging(status)) return '⚡'
  return '🔌'
}

function chargingIconOpacity(status: string | null, connection: string | null): number {
  if (isActivelyCharging(status) || isConnected(connection)) return 1
  return 0.25
}

function serviceLabel(warning: string | null): string | null {
  if (!warning) return null
  if (warning.includes('OVERDUE')) return 'Service achterstallig'
  if (warning.includes('TIME_FOR_SERVICE')) return 'Tijd voor service'
  if (warning.includes('ALMOST')) return 'Service bijna nodig'
  if (warning.includes('REQUIRED')) return 'Service vereist'
  return 'Service melding'
}

function fluidLabel(warning: string | null, fluid: 'brake' | 'coolant' | 'oil'): string | null {
  if (!warning) return null
  const name = { brake: 'Remvloeistof', coolant: 'Koelvloeistof', oil: 'Olie' }[fluid]
  if (warning.includes('TOO_LOW')) return `${name} te laag`
  if (warning.includes('TOO_HIGH')) return `${name} te hoog`
  if (warning.includes('SERVICE_REQUIRED')) return `${name}: service vereist`
  return `${name}: controleer`
}

export function PolestarWidget({ config: _config }: WidgetProps) {
  const { data, isError, isLoading } = usePolestar()

  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    boxSizing: 'border-box',
    gap: '0.55rem',
  }

  const title = (
    <div style={{
      fontSize: 'clamp(1.35rem, 2.85vw, 2.25rem)',
      fontWeight: 300,
      textTransform: 'uppercase',
      letterSpacing: '0.25em',
      color: 'var(--color-text)',
      flexShrink: 0,
    }}>
      Polestar
    </div>
  )

  if (isLoading) return <div style={shell}>{title}</div>

  if (isError || !data) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', marginTop: '0.3rem' }}>
        Niet beschikbaar
      </span>
    </div>
  )

  const soc = data.soc ?? 0
  const color = socColor(soc)
  const isCharging = isActivelyCharging(data.charging_status)
  const serviceMsg = serviceLabel(data.service_warning)
  const fluidAlerts = [
    fluidLabel(data.brake_fluid_warning, 'brake'),
    fluidLabel(data.coolant_warning, 'coolant'),
    fluidLabel(data.oil_warning, 'oil'),
  ].filter(Boolean) as string[]
  const capKw = data.charging_power_watts != null ? (data.charging_power_watts / 1000).toFixed(1) : null
  const capA  = data.charging_current_amps

  return (
    <div style={shell}>
      {title}
      {divider}

      {/* SOC + range */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.55rem',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'clamp(2rem, 4.5vw, 3.6rem)',
          fontWeight: 900,
          color,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {soc}%
        </span>
        {data.range_km != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1em' }}>
            <span style={{
              fontSize: 'clamp(1.5rem, 2.85vw, 2.25rem)',
              fontWeight: 700,
              color: 'var(--color-text)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {data.range_km} km
            </span>
            <span style={{
              fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
              color: 'var(--color-muted)',
              lineHeight: 1,
            }}>
              bereik
            </span>
          </div>
        )}
      </div>

      {/* Battery bar */}
      <div style={{
        height: '6px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '3px',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${soc}%`,
          background: color,
          borderRadius: '3px',
        }} />
      </div>

      {/* Charging status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)', lineHeight: 1, opacity: chargingIconOpacity(data.charging_status, data.charging_connection_status) }}>
          {chargingIcon(data.charging_status, data.charging_connection_status)}
        </span>
        <span style={{
          color: isCharging ? '#4caf50' : 'var(--color-muted)',
          fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)',
          lineHeight: 1,
        }}>
          {chargingLabel(data.charging_status, data.charging_connection_status)}
        </span>
        {isCharging && (capKw || capA) && (
          <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', marginLeft: '0.2rem' }}>
            {capKw && `${capKw} kW`}{capKw && capA ? ' · ' : ''}{capA ? `${capA} A` : ''}
          </span>
        )}
        {isCharging && data.charging_time_min != null && data.charging_time_min > 0 && (
          <span style={{
            color: 'var(--color-muted)',
            fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
            marginLeft: 'auto',
          }}>
            vol over {Math.floor(data.charging_time_min / 60)}u{data.charging_time_min % 60 > 0 ? `${data.charging_time_min % 60}m` : ''}
          </span>
        )}
      </div>

      {/* Stats: consumption + avg speed */}
      {(data.avg_consumption_kwh_per_100km != null || data.avg_speed_kmh != null) && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexShrink: 0,
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
        }}>
          {data.avg_consumption_kwh_per_100km != null && (
            <span>{data.avg_consumption_kwh_per_100km.toFixed(1)} kWh/100km</span>
          )}
          {data.avg_speed_kmh != null && (
            <span>gem. {data.avg_speed_kmh} km/u</span>
          )}
        </div>
      )}

      {/* Trip meters */}
      {(data.trip_auto_km != null || data.trip_manual_km != null) && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexShrink: 0,
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
        }}>
          {data.trip_auto_km != null && (
            <span>rit A: {data.trip_auto_km.toFixed(1)} km</span>
          )}
          {data.trip_manual_km != null && (
            <span>rit B: {data.trip_manual_km.toFixed(1)} km</span>
          )}
        </div>
      )}

      {/* Service warning tag — only shown when active */}
      {serviceMsg && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4em',
          padding: '0.3em 0.65em',
          background: 'rgba(255,152,0,0.12)',
          border: '1px solid rgba(255,152,0,0.35)',
          borderRadius: 6,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}>
          <span style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)' }}>⚠</span>
          <span style={{ color: '#ff9800', fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', fontWeight: 500 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
          {fluidAlerts.map(msg => (
            <div key={msg} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4em',
              padding: '0.3em 0.65em',
              background: 'rgba(244,67,54,0.12)',
              border: '1px solid rgba(244,67,54,0.35)',
              borderRadius: 6,
              alignSelf: 'flex-start',
            }}>
              <span style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)' }}>⚠</span>
              <span style={{ color: '#f44336', fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', fontWeight: 500 }}>
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
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
          opacity: 0.55,
        }}>
          {data.odometer_km.toLocaleString('nl-NL')} km
        </div>
      )}
    </div>
  )
}
