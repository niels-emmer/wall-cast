# Widget Style Guide

All display widgets share a common visual language defined in
`frontend/src/widgets/styles.ts`. Import from there — do not invent new
font sizes, spacing values, or colours inline.

---

## Import

```ts
import { fs, sp, col, shellStyle, titleStyle, dividerStyle, sectionLabelStyle, cardBase, cardBaseDim } from '../styles'
```

---

## Font sizes — `fs`

Seven semantic tiers. Pick the one that matches the role of the text, not
its pixel size.

| Token | Value | Use for |
|-------|-------|---------|
| `fs.xs` | `clamp(0.7rem, 1.2vw, 0.95rem)` | Badges, road labels, fine print, "valid until" |
| `fs.sm` | `clamp(0.9rem, 1.6vw, 1.3rem)` | Secondary text — timestamps, directions, wind, muted labels |
| `fs.md` | `clamp(1.1rem, 2vw, 1.6rem)` | Primary card text — event name, bus line, container name |
| `fs.lg` | `clamp(1.5rem, 2.8vw, 2.2rem)` | Featured numbers — column temps, travel duration, range km |
| `fs.hero` | `clamp(2rem, 4vw, 3.2rem)` | Single dominant figure — current temperature, battery SOC |
| `fs.title` | `clamp(1.3rem, 2.6vw, 2.1rem)` | Widget header — used with `titleStyle` |
| `fs.icon` | `clamp(1.7rem, 3.2vw, 2.6rem)` | Emoji / symbol icons |

**Rules:**
- Never write a literal `clamp()` string in a widget — use a token.
- If you find yourself between two tiers, step up (more readable on a TV).
- The clock's giant time (`clamp(3.5rem, 7.5vw, 6.5rem)`) is the only
  deliberate exception — it is intentionally oversized.

---

## Spacing — `sp`

| Token | Value | Use for |
|-------|-------|---------|
| `sp.shellPad` | `'0.85rem'` | `padding` on the root shell div |
| `sp.shellGap` | `'0.45rem'` | `gap` between title / divider / content in the shell |
| `sp.cardPad` | `'0.45rem 0.7rem'` | `padding` inside every card or row |
| `sp.cardRadius` | `8` | `borderRadius` on every card/row (number, not string) |
| `sp.listGap` | `'0.35rem'` | `gap` between items in a card list |
| `sp.innerGap` | `'0.15rem'` | `gap` between sub-elements inside one card |

---

## Colours — `col`

| Token | Value | Use for |
|-------|-------|---------|
| `col.divider` | `rgba(255,255,255,0.07)` | Horizontal rule between sections |
| `col.cardBg` | `rgba(255,255,255,0.05)` | Standard card background |
| `col.cardBorder` | `rgba(255,255,255,0.09)` | Standard card border |
| `col.cardBgDim` | `rgba(255,255,255,0.03)` | Dimmer card bg (weather columns, garbage rows) |

For semantic colours (status, severity, accent) use the CSS variables:

```
var(--color-text)     — primary text, white-ish
var(--color-muted)    — secondary text, grey
var(--color-accent)   — cyan highlight (#00d4ff)
var(--color-bg)       — page background, black
```

---

## Reusable style objects

### `shellStyle` — root div of every widget

```tsx
<div style={shellStyle}>
  …
</div>
```

Equivalent to:
```ts
{
  display: 'flex', flexDirection: 'column',
  height: '100%', padding: sp.shellPad,
  boxSizing: 'border-box', gap: sp.shellGap,
  overflow: 'hidden',
}
```

### `titleStyle` — widget header text

```tsx
<div style={titleStyle}>{t.myWidgetTitle}</div>
```

Equivalent to:
```ts
{
  fontSize: fs.title, fontWeight: 300,
  textTransform: 'uppercase', letterSpacing: '0.25em',
  color: 'var(--color-text)', flexShrink: 0,
}
```

### `dividerStyle` — thin horizontal rule

```tsx
const divider = <div style={dividerStyle} />
```

### `sectionLabelStyle` — muted label above a group of cards

```tsx
<span style={sectionLabelStyle}>{t.today}</span>
```

Equivalent to:
```ts
{
  fontSize: fs.sm, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.18em',
  color: 'var(--color-muted)', flexShrink: 0,
}
```

### `cardBase` — standard bordered card

```tsx
<div style={{
  ...cardBase,
  display: 'flex',
  borderLeft: `4px solid ${accentColor}`,
}}>
```

### `cardBaseDim` — borderless dim card (columns, compact rows)

```tsx
<div style={{
  ...cardBaseDim,
  display: 'flex',
  flexDirection: 'column',
}}>
```

---

## Shell structure

Every widget follows this exact structure — title, divider, content:

```tsx
export function MyWidget({ config }: WidgetProps) {
  const t = useLang()
  const { data, isError, isLoading } = useMyData()

  const divider = <div style={dividerStyle} />

  // Loading skeleton — just show the title
  if (isLoading) return <div style={shellStyle}><div style={titleStyle}>{t.myTitle}</div></div>

  // Error state
  if (isError || !data) return (
    <div style={shellStyle}>
      <div style={titleStyle}>{t.myTitle}</div>
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: fs.md }}>
        {t.unavailable}
      </span>
    </div>
  )

  // Happy path
  return (
    <div style={shellStyle}>
      <div style={titleStyle}>{t.myTitle}</div>
      {divider}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: sp.listGap, overflow: 'hidden',
        flex: 1, minHeight: 0,
      }}>
        {data.items.map(item => <MyCard key={item.id} item={item} />)}
      </div>
    </div>
  )
}
```

---

## Cards

### Standard card with accent border

```tsx
function MyCard({ item }: { item: MyItem }) {
  return (
    <div style={{
      ...cardBase,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      borderLeft: `4px solid ${item.color}`,
    }}>
      <span style={{ fontSize: fs.md, fontWeight: 500 }}>{item.title}</span>
      <span style={{ fontSize: fs.sm, color: 'var(--color-muted)', marginLeft: 'auto' }}>
        {item.subtitle}
      </span>
    </div>
  )
}
```

### Column card (equal-height grid columns, weather style)

```tsx
function MyCol({ label, value, accent = false }) {
  return (
    <div style={{
      ...cardBaseDim,
      flex: '1 1 0',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-evenly',
      background: accent ? 'rgba(0,212,255,0.09)' : col.cardBgDim,
      minWidth: 0, minHeight: 0,
    }}>
      <span style={{ fontSize: fs.sm, color: accent ? 'var(--color-accent)' : 'var(--color-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: fs.lg, fontWeight: 700 }}>{value}</span>
    </div>
  )
}
```

---

## Alert / badge tags

For status tags (warnings, service alerts, fluid alerts):

```tsx
<div style={{
  display: 'inline-flex', alignItems: 'center', gap: '0.4em',
  padding: sp.cardPad,
  background: 'rgba(255,152,0,0.12)',
  border: '1px solid rgba(255,152,0,0.35)',
  borderRadius: sp.cardRadius,
  alignSelf: 'flex-start', flexShrink: 0,
}}>
  <span style={{ fontSize: fs.sm }}>⚠</span>
  <span style={{ color: '#ff9800', fontSize: fs.sm, fontWeight: 500 }}>
    {message}
  </span>
</div>
```

For inline number badges (delay, route):

```tsx
<span style={{ fontSize: fs.xs, fontWeight: 600, color: '#f97316' }}>
  +3 min
</span>
```

---

## Typography hierarchy quick reference

```
fs.hero   ████████████████████  current temperature, battery %
fs.lg     ███████████████       daily high/low, travel time, range
fs.title  ████████████          WEATHER  BUS  CALENDAR  (widget headers)
fs.md     ██████████            event title, bus line, container name
fs.sm     ████████              time, direction, wind, muted label
fs.xs     ██████                badge, road chip, "valid until"
```

---

## Layout rules (critical)

1. **Always use inline `style={{ }}`** for layout — Tailwind utility classes
   are silently dropped in the production build.
   Affected properties: `display`, `flexDirection`, `height`, `overflow`,
   `gap`, `alignItems`, `justifyContent`, `padding`, `margin`, `flex`, etc.

2. **CSS variables and `clamp()` work fine** — only layout *utility classes*
   are unreliable.

3. Every widget root div must have `height: '100%'` (provided by `shellStyle`).

4. Flex containers that scroll or grow must have `minHeight: 0` (flex bug
   workaround).

5. Use `flexShrink: 0` on elements that must not compress (title, divider,
   single-card sections).
