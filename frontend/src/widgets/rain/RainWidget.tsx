import { useRain } from '../../hooks/use-rain'
import type { RainEntry, RainLevels } from '../../types/api'

interface Props {
  config: Record<string, unknown>
}

// SVG viewBox dimensions (unitless — scales to container)
const VW = 300
const VH = 80

function buildPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  // Smooth bezier curve through points
  return pts.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const prev = pts[i - 1]
    const cpx = ((prev.x + p.x) / 2).toFixed(1)
    return `C ${cpx} ${prev.y.toFixed(1)}, ${cpx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
}

interface ChartProps {
  forecast: RainEntry[]
  levels: RainLevels
}

function RainChart({ forecast, levels }: ChartProps) {
  const maxMm = Math.max(...forecast.map(f => f.mm_per_hour), levels.heavy * 1.25, 0.01)

  const toY = (mm: number) => VH - (mm / maxMm) * VH * 0.92  // 8% bottom margin

  const pts = forecast.map((entry, i) => ({
    x: (i / (forecast.length - 1)) * VW,
    y: toY(entry.mm_per_hour),
  }))

  const linePath = buildPath(pts)
  const areaPath = `${linePath} L ${VW} ${VH} L 0 ${VH} Z`

  // Reference lines for rain intensity thresholds
  const yLight    = toY(levels.light)
  const yModerate = toY(levels.moderate)
  const yHeavy    = toY(levels.heavy)

  const hasRain = forecast.some(f => f.mm_per_hour > 0)

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      style={{ width: '100%', flex: 1, minHeight: 0, display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="rainAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00d4ff" stopOpacity={hasRain ? 0.55 : 0.08} />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity={hasRain ? 0.04 : 0.02} />
        </linearGradient>
        <linearGradient id="rainLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#00d4ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#0099ff" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Horizontal threshold lines */}
      <line x1="0" y1={yLight}    x2={VW} y2={yLight}
            stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"
            strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1={yModerate} x2={VW} y2={yModerate}
            stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"
            strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1={yHeavy}    x2={VW} y2={yHeavy}
            stroke="rgba(255,100,100,0.25)" strokeWidth="0.8"
            strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />

      {/* Filled area */}
      <path d={areaPath} fill="url(#rainAreaGrad)" />

      {/* Line on top */}
      {hasRain && (
        <path d={linePath} fill="none"
              stroke="url(#rainLineGrad)" strokeWidth="2"
              vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

// Time label positions: every 30 min = every 6th entry (5-min intervals)
function timeLabels(forecast: RainEntry[]): { label: string; pct: number }[] {
  return forecast
    .map((f, i) => ({ label: f.time, pct: (i / (forecast.length - 1)) * 100, i }))
    .filter(({ i }) => i % 6 === 0)
    .map(({ label, pct, i }) => ({ label: i === 0 ? 'Now' : label, pct }))
}

const HEADER: React.CSSProperties = {
  color: 'var(--color-muted)',
  fontSize: 'clamp(0.65rem, 1.1vw, 0.85rem)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

export function RainWidget({ config: _config }: Props) {
  const { data, isError } = useRain()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.75rem 0.85rem 0.5rem',
    gap: '0.4rem',
    boxSizing: 'border-box',
  }

  if (isError) return (
    <div style={shell}>
      <span style={HEADER}>Rain — next 2 hours</span>
      <span style={{ color: 'var(--color-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>Unavailable</span>
    </div>
  )

  if (!data) return (
    <div style={shell}>
      <span style={HEADER}>Rain — next 2 hours</span>
      <span style={{ color: 'var(--color-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>Loading...</span>
    </div>
  )

  const { forecast, levels } = data
  const hasRain = forecast.some(f => f.mm_per_hour > 0)
  const labels  = timeLabels(forecast)

  // Current and peak mm/h for the status line
  const currentMm = forecast[0]?.mm_per_hour ?? 0
  const peakMm    = Math.max(...forecast.map(f => f.mm_per_hour))

  return (
    <div style={shell}>

      {/* Header row */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <span style={HEADER}>Rain — next 2 hours</span>
        <span style={{
          fontSize: 'clamp(0.75rem, 1.4vw, 1rem)',
          color: hasRain ? 'var(--color-accent)' : 'var(--color-muted)',
          fontWeight: hasRain ? 600 : 400,
        }}>
          {hasRain
            ? `${currentMm > 0 ? currentMm.toFixed(1) + ' mm/h now · ' : ''}peak ${peakMm.toFixed(1)} mm/h`
            : 'None expected'}
        </span>
      </div>

      {/* SVG chart — takes all remaining space */}
      <RainChart forecast={forecast} levels={levels} />

      {/* Time axis */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'relative',
      }}>
        {labels.map(({ label, pct }, i) => (
          <span key={i} style={{
            color: i === 0 ? 'var(--color-accent)' : 'var(--color-muted)',
            fontSize: 'clamp(0.6rem, 1vw, 0.8rem)',
            fontWeight: i === 0 ? 600 : 400,
          }}>
            {label}
          </span>
        ))}
      </div>

      {/* Intensity legend */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '1rem',
        flexShrink: 0,
        color: 'var(--color-muted)',
        fontSize: 'clamp(0.55rem, 0.95vw, 0.75rem)',
        alignItems: 'center',
        opacity: 0.7,
      }}>
        <span><span style={{ color: 'rgba(0,212,255,0.6)' }}>—</span> light ({levels.light} mm/h)</span>
        <span><span style={{ color: 'rgba(0,150,255,0.85)' }}>—</span> moderate ({levels.moderate} mm/h)</span>
        <span><span style={{ color: 'rgba(255,100,100,0.7)' }}>—</span> heavy ({levels.heavy} mm/h)</span>
      </div>

    </div>
  )
}
