// Meteocons weather icons — static SVGs served from public/icons/weather/
// Source: github.com/basmilius/weather-icons (MIT) — svg-static variant (no SMIL animations)

// ── WMO code → Meteocon filename ─────────────────────────────────────────────
const WMO_ICON: Record<number, string> = {
  0:  'clear-day',
  1:  'partly-cloudy-day',
  2:  'partly-cloudy-day',
  3:  'overcast',
  45: 'fog',       48: 'fog',
  51: 'drizzle',   53: 'drizzle',   55: 'drizzle',
  61: 'rain',      63: 'rain',      65: 'thunderstorms-rain',
  71: 'snow',      73: 'snow',      75: 'snowflake',
  80: 'drizzle',   81: 'rain',      82: 'thunderstorms-rain',
  95: 'thunderstorms', 96: 'thunderstorms', 99: 'thunderstorms',
}

// img width/height attributes only accept px integers — use style for CSS units
function imgStyle(size: string | number, inline?: boolean): React.CSSProperties {
  const dim = typeof size === 'number' ? `${size}px` : size
  return {
    display: inline ? 'inline-block' : 'block',
    width: dim,
    height: dim,
    flexShrink: 0,
    ...(inline ? { verticalAlign: 'text-bottom' } : {}),
  }
}

// ── Main weather icon (WMO code) ──────────────────────────────────────────────

export function WeatherIcon({ code, size = '1em' }: { code: number; size?: string | number }) {
  const name = WMO_ICON[code] ?? 'rain'
  return (
    <img
      src={`/icons/weather/${name}.svg`}
      alt={name}
      style={imgStyle(size)}
    />
  )
}

// ── Inline icons for SunBlock labels ─────────────────────────────────────────

export function SunriseIcon({ size = '1em' }: { size?: string | number }) {
  return <img src="/icons/weather/sunrise.svg" alt="sunrise" style={imgStyle(size, true)} />
}

export function SunsetIcon({ size = '1em' }: { size?: string | number }) {
  return <img src="/icons/weather/sunset.svg" alt="sunset" style={imgStyle(size, true)} />
}

export function DaylightIcon({ size = '1em' }: { size?: string | number }) {
  return <img src="/icons/weather/clear-day.svg" alt="daylight" style={imgStyle(size, true)} />
}
