import { useBus } from '../../hooks/use-bus'
import { useLang } from '../../i18n/use-lang'
import type { WidgetProps } from '../base-registry'
import type { BusDeparture } from '../../types/api'
import { fs, sp } from '../styles'
import { WidgetShell } from '../WidgetShell'

function delayColor(delay_min: number): string {
  if (delay_min <= 0) return 'var(--color-muted)'
  if (delay_min <= 3) return '#ff9800'
  return '#f44336'
}

function DelayBadge({ delay_min, t }: { delay_min: number; t: ReturnType<typeof useLang> }) {
  if (delay_min <= 0) return null
  return (
    <span style={{
      color: delayColor(delay_min),
      fontSize: fs.xs,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {t.busDelay(delay_min)}
    </span>
  )
}

function DepartureRow({ dep, t }: { dep: BusDeparture; t: ReturnType<typeof useLang> }) {
  const muted = 'var(--color-muted)'
  const dimmed = dep.cancelled ? 0.4 : 1
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp.listGap,
      minHeight: 0,
      flexShrink: 0,
      opacity: dimmed,
    }}>
      {/* Line number */}
      <span style={{
        fontSize: fs.md,
        fontWeight: 700,
        color: dep.cancelled ? muted : 'var(--color-text)',
        minWidth: '2.2em',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        textDecoration: dep.cancelled ? 'line-through' : 'none',
      }}>
        {dep.line}
      </span>

      {/* Direction */}
      <span style={{
        fontSize: fs.sm,
        color: dep.cancelled ? muted : 'var(--color-text)',
        flex: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        textDecoration: dep.cancelled ? 'line-through' : 'none',
      }}>
        {dep.direction}
      </span>

      {/* Cancelled badge or delay badge */}
      {dep.cancelled ? (
        <span style={{
          color: '#f44336',
          fontSize: fs.xs,
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {t.busCancelled}
        </span>
      ) : (
        <DelayBadge delay_min={dep.delay_min} t={t} />
      )}

      {/* Departure time */}
      <span style={{
        fontSize: fs.md,
        fontWeight: 600,
        color: dep.cancelled ? muted : dep.delay_min > 0 ? '#ff9800' : 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        textDecoration: dep.cancelled ? 'line-through' : 'none',
      }}>
        {dep.time}
      </span>

      {/* Realtime indicator dot — hidden for cancelled */}
      {!dep.cancelled && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dep.is_realtime ? '#4caf50' : muted,
          flexShrink: 0,
          opacity: dep.is_realtime ? 1 : 0.35,
        }} />
      )}
    </div>
  )
}

export function BusWidget({ config }: WidgetProps) {
  const t = useLang()
  const stopCity = config.stop_city as string | undefined
  const stopName = config.stop_name as string | undefined
  const { data, isError, isLoading } = useBus({ stopCity, stopName })

  if (isLoading) return <WidgetShell title={t.busTitle}>{null}</WidgetShell>

  if (isError || !data) return (
    <WidgetShell title={t.busTitle}>
      <span style={{ color: 'var(--color-muted)', fontSize: fs.sm, marginTop: '0.3rem' }}>
        {t.busUnavailable}
      </span>
    </WidgetShell>
  )

  const stopSuffix = (
    <span style={{
      fontSize: fs.xs,
      color: 'var(--color-muted)',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }}>
      {data.stop}
    </span>
  )

  return (
    <WidgetShell title={t.busTitle} titleSuffix={stopSuffix}>
      {data.departures.length === 0 ? (
        <span style={{ color: 'var(--color-muted)', fontSize: fs.sm, marginTop: '0.3rem' }}>
          {t.busNoDepartures}
        </span>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          gap: sp.listGap,
          overflow: 'hidden',
        }}>
          {data.departures.map((dep, i) => (
            <DepartureRow key={`${dep.line}-${dep.time}-${i}`} dep={dep} t={t} />
          ))}
        </div>
      )}
    </WidgetShell>
  )
}
