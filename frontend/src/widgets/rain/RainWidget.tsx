import { useRain } from '../../hooks/use-rain'
import type { RainEntry, RainLevels } from '../../types/api'

interface Props {
  config: Record<string, unknown>
}

const VW = 300   // SVG viewBox width (unitless)
const VH = 100   // SVG viewBox height

// Convert mm/h to SVG Y coordinate. Leave 6% padding at top and 4% at bottom.
const toY = (mm: number, maxMm: number) =>
  VH * 0.96 - (mm / maxMm) * VH * 0.90

function buildPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  return pts.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const prev = pts[i - 1]
    const cpx  = ((prev.x + p.x) / 2).toFixed(1)
    return `C ${cpx} ${prev.y.toFixed(1)}, ${cpx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
}

function RainChart({ forecast, levels }: { forecast: RainEntry[]; levels: RainLevels }) {
  const hasRain = forecast.some(f => f.mm_per_hour > 0)
  const maxMm   = Math.max(...forecast.map(f => f.mm_per_hour), levels.heavy * 1.2, 0.01)

  const pts = forecast.map((entry, i) => ({
    x: (i / (forecast.length - 1)) * VW,
    y: toY(entry.mm_per_hour, maxMm),
  }))

  const linePath = buildPath(pts)
  const floor    = toY(0, maxMm)
  const areaPath = hasRain ? `${linePath} L ${VW} ${floor} L 0 ${floor} Z` : ''

  const yLight    = toY(levels.light,    maxMm)
  const yModerate = toY(levels.moderate, maxMm)
  const yHeavy    = toY(levels.heavy,    maxMm)

  // Convert SVG viewBox Y → CSS % from top (for HTML overlay positioning)
  const pctLight    = (yLight    / VH) * 100
  const pctModerate = (yModerate / VH) * 100
  const pctHeavy    = (yHeavy    / VH) * 100

  // "Now" vertical line at x=0
  const nowX = pts[0]?.x ?? 0

  const labelStyle = (color: string): React.CSSProperties => ({
    position: 'absolute',
    left: '0.3rem',
    fontSize: 'clamp(0.675rem, 1.275vw, 0.975rem)',
    color,
    pointerEvents: 'none',
    lineHeight: 1,
    transform: 'translateY(-100%)',
    userSelect: 'none',
  })

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {/* SVG chart — stretched to fill, no text inside */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="rg-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#00d4ff" stopOpacity="0.5" />
            <stop offset="75%"  stopColor="#0066ff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rg-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#0088ff" />
          </linearGradient>
        </defs>

        {/* Floor baseline */}
        <line x1="0" y1={floor} x2={VW} y2={floor}
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.6"
              vectorEffect="non-scaling-stroke" />

        {/* Intensity threshold lines */}
        <line x1="0" y1={yLight} x2={VW} y2={yLight}
              stroke="rgba(0,212,255,0.2)" strokeWidth="0.7"
              strokeDasharray="4,4" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={yModerate} x2={VW} y2={yModerate}
              stroke="rgba(0,150,255,0.22)" strokeWidth="0.7"
              strokeDasharray="4,4" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={yHeavy} x2={VW} y2={yHeavy}
              stroke="rgba(255,80,80,0.2)" strokeWidth="0.7"
              strokeDasharray="4,4" vectorEffect="non-scaling-stroke" />

        {/* Filled area */}
        {hasRain && <path d={areaPath} fill="url(#rg-area)" />}

        {/* Smooth line */}
        <path d={linePath} fill="none"
              stroke={hasRain ? 'url(#rg-line)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round" strokeLinejoin="round" />

        {/* "Now" tick */}
        <line x1={nowX} y1={VH * 0.92} x2={nowX} y2={VH}
              stroke="var(--color-accent)" strokeWidth="1.5"
              vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>

      {/* Y-axis labels as HTML — not subject to SVG stretch distortion */}
      <span style={{ ...labelStyle('rgba(0,212,255,0.45)'), top: `${pctLight}%` }}>
        light
      </span>
      <span style={{ ...labelStyle('rgba(0,150,255,0.45)'), top: `${pctModerate}%` }}>
        mod.
      </span>
      <span style={{ ...labelStyle('rgba(255,80,80,0.45)'), top: `${pctHeavy}%` }}>
        heavy
      </span>

      {/* "No rain" overlay */}
      {!hasRain && (
        <span style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(1.05rem, 1.95vw, 1.5rem)',
          color: 'rgba(255,255,255,0.15)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          no rain expected
        </span>
      )}
    </div>
  )
}

function timeLabels(forecast: RainEntry[]): { label: string; i: number }[] {
  return forecast
    .map((f, i) => ({ label: f.time, i }))
    .filter(({ i }) => i % 6 === 0)
    .map(({ label, i }) => ({ label: i === 0 ? 'Nu' : label, i }))
}

const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

export function RainWidget({ config: _config }: Props) {
  const { data, isError } = useRain()

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0.85rem',
    gap: '0.55rem',
    boxSizing: 'border-box',
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
      Regen
    </div>
  )

  if (isError) return (
    <div style={shell}>
      {title}
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', marginTop: '0.3rem' }}>
        Niet beschikbaar
      </span>
    </div>
  )
  if (!data) return <div style={shell}>{title}</div>

  const { forecast, levels } = data
  const hasRain   = forecast.some(f => f.mm_per_hour > 0)
  const labels    = timeLabels(forecast)
  const currentMm = forecast[0]?.mm_per_hour ?? 0
  const peakMm    = Math.max(...forecast.map(f => f.mm_per_hour))

  return (
    <div style={shell}>

      {/* Title + status */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
        {title}
        <span style={{
          fontSize: 'clamp(1.1rem, 2.1vw, 1.65rem)',
          color: hasRain ? 'var(--color-accent)' : 'var(--color-muted)',
          fontWeight: hasRain ? 600 : 400,
        }}>
          {hasRain
            ? `${currentMm > 0 ? currentMm.toFixed(1) + ' mm/h · ' : ''}piek ${peakMm.toFixed(1)} mm/h`
            : 'Droog'}
        </span>
      </div>

      {divider}

      {/* Chart */}
      <RainChart forecast={forecast} levels={levels} />

      {/* Time axis */}
      <div style={{
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        {labels.map(({ label, i }) => (
          <span key={i} style={{
            color: i === 0 ? 'var(--color-accent)' : 'var(--color-muted)',
            fontSize: 'clamp(1.1rem, 1.95vw, 1.5rem)',
            fontWeight: i === 0 ? 700 : 400,
          }}>
            {label}
          </span>
        ))}
      </div>

      {/* Threshold legend */}
      <div style={{
        display: 'flex', flexDirection: 'row',
        gap: '0.7rem', flexShrink: 0,
        color: 'var(--color-muted)',
        fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
        opacity: 0.65,
      }}>
        <span><span style={{ color: 'rgba(0,212,255,0.7)' }}>—</span> {levels.light}</span>
        <span><span style={{ color: 'rgba(0,150,255,0.8)' }}>—</span> {levels.moderate}</span>
        <span><span style={{ color: 'rgba(255,80,80,0.7)' }}>—</span> {levels.heavy} mm/u</span>
      </div>

    </div>
  )
}
