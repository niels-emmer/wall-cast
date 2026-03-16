import { usePolestar } from '../../hooks/use-polestar'
import type { WidgetProps } from '../base-registry'

function socColor(soc: number): string {
  if (soc >= 60) return '#4caf50'   // green
  if (soc >= 25) return '#ff9800'   // amber
  return '#f44336'                  // red
}

function chargingLabel(status: string | null, connection: string | null): string {
  if (status === 'CHARGING') return 'Aan het laden'
  if (connection === 'CONNECTED') return 'Aangesloten'
  return 'Niet aangesloten'
}

function chargingIcon(status: string | null, connection: string | null): string {
  if (status === 'CHARGING') return '⚡'
  if (connection === 'CONNECTED') return '🔌'
  return '○'
}

export function PolestarWidget({ config: _config }: WidgetProps) {
  const { data, isError, isLoading } = usePolestar()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.75rem 0.85rem 0.6rem',
    boxSizing: 'border-box',
    gap: '0.4rem',
  }

  const header = (
    <div style={{
      color: 'var(--color-muted)',
      fontSize: 'clamp(0.7rem, 1.1vw, 0.85rem)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      Polestar
    </div>
  )

  if (isLoading) return <div style={shell}>{header}</div>

  if (isError || !data) return (
    <div style={shell}>
      {header}
      <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Autodata niet beschikbaar
      </span>
    </div>
  )

  const soc = data.soc ?? 0
  const color = socColor(soc)
  const isCharging = data.charging_status === 'CHARGING'

  return (
    <div style={shell}>
      {header}

      {/* SOC + range row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)',
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {soc}%
        </span>
        {data.range_km != null && (
          <span style={{
            fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)',
            color: 'var(--color-muted)',
          }}>
            {data.range_km} km
          </span>
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
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Charging status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.9rem' }}>
          {chargingIcon(data.charging_status, data.charging_connection_status)}
        </span>
        <span style={{
          color: isCharging ? '#4caf50' : 'var(--color-muted)',
          fontSize: 'clamp(0.7rem, 1.1vw, 0.85rem)',
        }}>
          {chargingLabel(data.charging_status, data.charging_connection_status)}
        </span>
        {isCharging && data.charging_time_min != null && (
          <span style={{
            color: 'var(--color-muted)',
            fontSize: 'clamp(0.65rem, 1vw, 0.8rem)',
            marginLeft: 'auto',
          }}>
            vol over {Math.round(data.charging_time_min / 60)}u{data.charging_time_min % 60 > 0 ? `${data.charging_time_min % 60}m` : ''}
          </span>
        )}
      </div>

      {/* Odometer */}
      {data.odometer_km != null && (
        <div style={{
          marginTop: 'auto',
          color: 'var(--color-muted)',
          fontSize: 'clamp(0.6rem, 0.95vw, 0.75rem)',
          opacity: 0.55,
        }}>
          {data.odometer_km.toLocaleString('nl-NL')} km
        </div>
      )}
    </div>
  )
}
