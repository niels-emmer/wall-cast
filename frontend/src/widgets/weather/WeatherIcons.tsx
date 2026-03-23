// Custom SVG weather icons — avoids emoji rendering failures on Chromecast/Android

import React from 'react'

// ── Color palette (dark-theme optimised) ──────────────────────────────────────
const SUN    = '#FFD700' // amber gold
const CLOUD  = '#90CAF9' // soft blue-gray (legible on dark bg)
const DCLOUD = '#546E7A' // dark blue-gray (storm / heavy rain)
const RAIN   = '#29B6F6' // vivid sky blue
const SNOW   = '#E0F7FA' // near-white light blue
const BOLT   = '#FFD54F' // warm amber lightning

// ── Cloud paths (24 × 24 viewBox) ────────────────────────────────────────────
// Full cloud — wide, sits in the middle (used by overcast)
const P_FULL  = 'M3 18 Q2 13 5 11 Q7 8 10 9 Q11 7 13 7 Q15 7 16 9 Q19 8 21 11 Q22 14 21 18H3Z'
// High cloud — shifted up, leaves room for precipitation below
const P_HIGH  = 'M3 15 Q2 10 5 8 Q7 5 10 6 Q11 4 13 4 Q15 4 16 6 Q19 5 21 8 Q22 11 21 15H3Z'
// Small cloud — right half, for sun+cloud combos
const P_SMALL = 'M11 20 Q10 16 13 14.5 Q14 13 16 13 Q17.5 12 19 13 Q22 13 22 16 Q22 18.5 20.5 20H11Z'
// Medium cloud — center-right, for partly cloudy (sun upper-left)
const P_MED   = 'M5 19 Q4 14.5 7 12.5 Q9 10 12 10.5 Q13 9.5 15 10.5 Q17 9.5 19 11.5 Q22 12 22 15 Q22 18 20.5 19H5Z'

// ── Helpers ───────────────────────────────────────────────────────────────────
interface P { size?: string | number }

function Svg({ size, children }: { size?: string | number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size ?? '1em'}
      height={size ?? '1em'}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// Sun: circle + 8 evenly-spaced rays
function Sun({ cx, cy, r, r1, r2 }: { cx: number; cy: number; r: number; r1: number; r2: number }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180
        return (
          <line
            key={i}
            x1={+(cx + Math.cos(a) * r1).toFixed(2)} y1={+(cy + Math.sin(a) * r1).toFixed(2)}
            x2={+(cx + Math.cos(a) * r2).toFixed(2)} y2={+(cy + Math.sin(a) * r2).toFixed(2)}
            stroke={SUN} strokeWidth="1.5" strokeLinecap="round"
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
    </>
  )
}

// Rain drops: short diagonal lines, n = 2 | 3 | 4 | 5
function Drops({ y, n, color = RAIN, sw = 1.5 }: { y: number; n: number; color?: string; sw?: number }) {
  const xs: Record<number, number[]> = {
    2: [8.5, 16],
    3: [7, 12, 17],
    4: [5.5, 10, 14.5, 19],
    5: [4.5, 8.5, 12.5, 16.5, 20.5],
  }
  return (
    <>
      {(xs[n] ?? xs[3]).map((x, i) => (
        <line
          key={i}
          x1={x + 0.5} y1={y + (i % 2) * 0.8}
          x2={x - 1.5} y2={y + 3.5 + (i % 2) * 0.8}
          stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      ))}
    </>
  )
}

// Snowflake: 3-bar asterisk
function Flake({ cx, cy, r = 2.2 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      {[0, 60, 120].map(deg => {
        const a = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={+(cx - Math.cos(a) * r).toFixed(2)} y1={+(cy - Math.sin(a) * r).toFixed(2)}
            x2={+(cx + Math.cos(a) * r).toFixed(2)} y2={+(cy + Math.sin(a) * r).toFixed(2)}
            stroke={SNOW} strokeWidth="1.5" strokeLinecap="round"
          />
        )
      })}
    </>
  )
}

// ── Icon components ───────────────────────────────────────────────────────────

export function ClearIcon({ size }: P) {
  return (
    <Svg size={size}>
      <Sun cx={12} cy={12} r={5} r1={6.8} r2={9.5} />
    </Svg>
  )
}

export function MostlyClearIcon({ size }: P) {
  return (
    <Svg size={size}>
      <Sun cx={9} cy={9} r={3.5} r1={4.8} r2={7} />
      <path d={P_SMALL} fill={CLOUD} />
    </Svg>
  )
}

export function PartlyCloudyIcon({ size }: P) {
  return (
    <Svg size={size}>
      <Sun cx={8} cy={8} r={3} r1={4.2} r2={6.5} />
      <path d={P_MED} fill={CLOUD} />
    </Svg>
  )
}

export function OvercastIcon({ size }: P) {
  return (
    <Svg size={size}>
      {/* Back cloud (lighter) */}
      <path
        d="M5 15.5 Q4 11 7 9 Q9 7 12 7.5 Q13.5 6.5 16 7.5 Q18.5 7 20 9.5 Q21.5 10 21.5 13 Q21.5 15.5 19.5 15.5H5Z"
        fill={CLOUD} opacity={0.45}
      />
      {/* Front cloud */}
      <path d={P_FULL} fill={CLOUD} />
    </Svg>
  )
}

export function FogIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={CLOUD} />
      <line x1="3"  y1="17.5" x2="21" y2="17.5" stroke={CLOUD} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="5"  y1="20.5" x2="19" y2="20.5" stroke={CLOUD} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
      <line x1="7"  y1="23"   x2="17" y2="23"   stroke={CLOUD} strokeWidth="1.8" strokeLinecap="round" opacity="0.3" />
    </Svg>
  )
}

export function DrizzleIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={CLOUD} />
      <Drops y={17.5} n={2} />
    </Svg>
  )
}

export function RainIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={CLOUD} />
      <Drops y={17.5} n={3} />
    </Svg>
  )
}

export function HeavyRainIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={DCLOUD} />
      <Drops y={17.5} n={4} sw={2} />
    </Svg>
  )
}

export function SnowIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={CLOUD} />
      <Flake cx={7}  cy={19.5} />
      <Flake cx={12} cy={21}   />
      <Flake cx={17} cy={19.5} />
    </Svg>
  )
}

export function HeavySnowIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={CLOUD} />
      <Flake cx={6}  cy={19}   r={2.2} />
      <Flake cx={12} cy={20.5} r={2.5} />
      <Flake cx={18} cy={19}   r={2.2} />
      <Flake cx={9}  cy={23}   r={1.8} />
      <Flake cx={15} cy={23}   r={1.8} />
    </Svg>
  )
}

export function ThunderstormIcon({ size }: P) {
  return (
    <Svg size={size}>
      <path d={P_HIGH} fill={DCLOUD} />
      {/* Lightning bolt — classic Z shape */}
      <path d="M12.5 15 L9 21 L12 21 L10 23.5 L16 18 H13 Z" fill={BOLT} />
      {/* Rain drops flanking the bolt */}
      <line x1="5.5" y1="17" x2="3.5" y2="20.5" stroke={RAIN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19"  y1="17" x2="17"  y2="20.5" stroke={RAIN} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  )
}

// ── Inline icons for SunBlock labels ─────────────────────────────────────────
// These use inline-block + text-bottom so they sit flush with surrounding text

function InlineSvg({ size, children }: { size?: string | number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size ?? '1em'}
      height={size ?? '1em'}
      style={{ display: 'inline-block', verticalAlign: 'text-bottom', flexShrink: 0 }}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// Sun rising: semicircle above horizon + 3 rays + up-chevron below
export function SunriseIcon({ size }: P) {
  return (
    <InlineSvg size={size}>
      <line x1="2" y1="15" x2="22" y2="15" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 15 a4 4 0 0 1 8 0" fill={SUN} />
      <line x1="12"  y1="8.5" x2="12"  y2="6.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16.8" y1="10"  x2="18.2" y2="8.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7.2"  y1="10"  x2="5.8"  y2="8.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="9,21 12,18 15,21" fill="none" stroke={SUN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </InlineSvg>
  )
}

// Sun setting: semicircle above horizon + 3 rays + down-chevron below
export function SunsetIcon({ size }: P) {
  return (
    <InlineSvg size={size}>
      <line x1="2" y1="15" x2="22" y2="15" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 15 a4 4 0 0 1 8 0" fill={SUN} />
      <line x1="12"  y1="8.5" x2="12"  y2="6.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16.8" y1="10"  x2="18.2" y2="8.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7.2"  y1="10"  x2="5.8"  y2="8.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="9,18 12,21 15,18" fill="none" stroke={SUN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </InlineSvg>
  )
}

// Small full sun (for daylight duration label)
export function DaylightIcon({ size }: P) {
  return (
    <InlineSvg size={size}>
      <circle cx="12" cy="12" r="4" fill={SUN} />
      <line x1="12" y1="5.5" x2="12" y2="3.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="20.5" x2="12" y2="18.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3.5" y1="12" x2="5.5" y2="12" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18.5" y1="12" x2="20.5" y2="12" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.5" y1="6.5" x2="8"  y2="8"   stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16"  y1="16"  x2="17.5" y2="17.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17.5" y1="6.5" x2="16"  y2="8"   stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8"   y1="16"  x2="6.5" y2="17.5" stroke={SUN} strokeWidth="1.5" strokeLinecap="round" />
    </InlineSvg>
  )
}

// ── WMO code → icon ───────────────────────────────────────────────────────────

const WMO_ICONS: Record<number, React.FC<P>> = {
  0:  ClearIcon,
  1:  MostlyClearIcon,
  2:  PartlyCloudyIcon,
  3:  OvercastIcon,
  45: FogIcon, 48: FogIcon,
  51: DrizzleIcon, 53: DrizzleIcon,
  55: RainIcon,
  61: RainIcon, 63: RainIcon, 65: HeavyRainIcon,
  71: SnowIcon,   73: SnowIcon,   75: HeavySnowIcon,
  80: DrizzleIcon, 81: RainIcon,  82: HeavyRainIcon,
  95: ThunderstormIcon, 96: ThunderstormIcon, 99: ThunderstormIcon,
}

export function WeatherIcon({ code, size }: { code: number; size?: string | number }) {
  const Icon = WMO_ICONS[code] ?? RainIcon
  return <Icon size={size} />
}
