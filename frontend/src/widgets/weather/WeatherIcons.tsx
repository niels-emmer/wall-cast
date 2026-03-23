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

// ── Main weather icon (WMO code) ──────────────────────────────────────────────

export function WeatherIcon({ code, size }: { code: number; size?: string | number }) {
  const name = WMO_ICON[code] ?? 'rain'
  return (
    <img
      src={`/icons/weather/${name}.svg`}
      alt={name}
      width={size ?? '1em'}
      height={size ?? '1em'}
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}

// ── Inline icons for SunBlock labels ─────────────────────────────────────────
// Sized to sit flush with surrounding text via inline-block + verticalAlign

export function SunriseIcon({ size }: { size?: string | number }) {
  return (
    <img
      src="/icons/weather/sunrise.svg"
      alt="sunrise"
      width={size ?? '1em'}
      height={size ?? '1em'}
      style={{ display: 'inline-block', verticalAlign: 'text-bottom', flexShrink: 0 }}
    />
  )
}

export function SunsetIcon({ size }: { size?: string | number }) {
  return (
    <img
      src="/icons/weather/sunset.svg"
      alt="sunset"
      width={size ?? '1em'}
      height={size ?? '1em'}
      style={{ display: 'inline-block', verticalAlign: 'text-bottom', flexShrink: 0 }}
    />
  )
}

export function DaylightIcon({ size }: { size?: string | number }) {
  return (
    <img
      src="/icons/weather/clear-day.svg"
      alt="daylight"
      width={size ?? '1em'}
      height={size ?? '1em'}
      style={{ display: 'inline-block', verticalAlign: 'text-bottom', flexShrink: 0 }}
    />
  )
}
