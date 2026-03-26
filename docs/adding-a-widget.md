# Adding a Widget

Wall-cast uses a simple registry pattern. A new widget type typically takes 15–30 minutes to add.

## Overview

A widget is:
1. A **React component** in `frontend/src/widgets/<name>/`
2. **Translation keys** in `frontend/src/i18n/translations.ts` (both `nl` and `en`)
3. An entry in the **widget registry** (`frontend/src/widgets/index.ts`)
4. Optionally a **backend router** if the widget needs external data
5. A **TanStack Query hook** to fetch that data
6. An entry in `docs/config-reference.md`

---

## Step-by-step

### 1. Create the React component

```
frontend/src/widgets/<name>/<Name>Widget.tsx
```

Every widget receives a single prop — `config: Record<string, unknown>` — containing whatever you put in the YAML `config:` block for that widget instance.

Import the shared design tokens (see `docs/widget-style-guide.md` for the full reference):

```tsx
import { shellStyle, titleStyle, dividerStyle, fs, sp } from '../styles'
import { useLang } from '../../i18n/use-lang'
import type { WidgetProps } from '../base-registry'

export function MyWidget({ config }: WidgetProps) {
  const t = useLang()
  const myOption = config.my_option as string ?? 'default'

  const divider = <div style={dividerStyle} />

  return (
    <div style={shellStyle}>
      <div style={titleStyle}>{t.myWidgetTitle}</div>
      {divider}
      <span style={{ fontSize: fs.md, color: 'var(--color-text)' }}>
        {myOption}
      </span>
    </div>
  )
}
```

**Critical styling rules:**
- Always use **inline `style={{ }}`** for layout properties — Tailwind utility classes are silently dropped in the production build. This applies to `display`, `flexDirection`, `height`, `overflow`, `gap`, `alignItems`, `justifyContent`, `padding`, `margin`, and all other layout properties.
- Use the **shared design tokens** from `../styles` for font sizes, spacing, and colours — do not write new `clamp()` values inline.
- Use **CSS variables** for colours: `var(--color-text)`, `var(--color-muted)`, `var(--color-accent)`, `var(--color-bg)`.
- The widget wrapper in `App.tsx` already sets `height: 100%` and `minHeight: 0` — `shellStyle` handles this for your root element.

Read `docs/widget-style-guide.md` before writing layout code.

---

### 2. Add translations

Add your widget's title and any other user-facing labels to `frontend/src/i18n/translations.ts`. Both `nl` and `en` objects must always have identical keys — the `check-translations` hook will warn immediately if they drift.

**In the `Translations` interface:**

```ts
// Widget: my widget
myWidgetTitle: string
myWidgetUnavailable: string
```

**In the `nl` object:**

```ts
myWidgetTitle: 'Mijn Widget',
myWidgetUnavailable: 'Niet beschikbaar',
```

**In the `en` object:**

```ts
myWidgetTitle: 'My Widget',
myWidgetUnavailable: 'Unavailable',
```

Then reference them in your component via `useLang()`:

```tsx
const t = useLang()
// ...
<div style={titleStyle}>{t.myWidgetTitle}</div>
```

Widgets that have no user-visible labels (e.g. a pure chart) can skip this step.

---

### 4. Register the widget

In `frontend/src/widgets/index.ts`:

```ts
import { MyWidget } from './my-widget/MyWidget'

export const WIDGET_REGISTRY = {
  // ... existing entries
  my_widget: MyWidget,
}
```

The key is the `type:` value used in the YAML config.

---

### 5. Add a backend route (if the widget needs external data)

Create `backend/app/routers/my_widget.py`:

```python
import time
import httpx
from fastapi import APIRouter, HTTPException
from app import wall_config

router = APIRouter(tags=["my_widget"])

_cache: dict = {}
CACHE_TTL = 15 * 60  # 15 minutes

@router.get("/my-widget")
async def get_my_widget() -> dict:
    cfg = wall_config.get_config()
    location = cfg.get("location", {})
    lat = location.get("lat", 52.3676)
    lon = location.get("lon", 4.9041)

    now = time.time()
    if "data" in _cache and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.example.com/...", timeout=10)
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        if "data" in _cache:
            return _cache["data"]   # serve stale on error
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    _cache.update({"data": data, "ts": now})
    return data
```

Mount it in `backend/app/main.py`:

```python
from app.routers import my_widget
app.include_router(my_widget.router, prefix="/api")
```

---

### 6. Create a data hook

Create `frontend/src/hooks/use-my-widget.ts`:

```ts
import { useQuery } from '@tanstack/react-query'

export function useMyWidget() {
  return useQuery({
    queryKey: ['my-widget'],
    queryFn: () => fetch('/api/my-widget').then(r => r.json()),
    refetchInterval: 15 * 60 * 1000,   // match backend cache TTL
    staleTime:       14 * 60 * 1000,
  })
}
```

Use it in your component:

```tsx
import { useMyWidget } from '../../hooks/use-my-widget'

export function MyWidget({ config }: WidgetProps) {
  const t = useLang()
  const { data, isError, isLoading } = useMyWidget()
  const divider = <div style={dividerStyle} />

  if (isLoading) return <div style={shellStyle}><div style={titleStyle}>{t.myTitle}</div></div>

  if (isError || !data) return (
    <div style={shellStyle}>
      <div style={titleStyle}>{t.myTitle}</div>
      {divider}
      <span style={{ color: 'var(--color-muted)', fontSize: fs.md }}>{t.unavailable}</span>
    </div>
  )

  return (
    <div style={shellStyle}>
      <div style={titleStyle}>{t.myTitle}</div>
      {divider}
      <span style={{ fontSize: fs.md }}>{data.value}</span>
    </div>
  )
}
```

---

### 7. Add it to the YAML config

```yaml
widgets:
  - id: my_widget_1
    type: my_widget
    col: 1
    row: 5
    col_span: 6
    row_span: 2
    config:
      my_option: hello
```

---

### 8. Document it

Add the new widget to `docs/config-reference.md` under **Widget types**, following the same format as existing entries.

---

## Before you commit

Three things the hooks check automatically — they will surface as warnings if missed:

| Check | What fires | How to fix |
|-------|-----------|------------|
| Layout Tailwind classes in `className` | `check-tailwind` | Replace with inline `style={{}}` |
| Mismatched `nl`/`en` keys in `translations.ts` | `check-translations` | Add the missing key to both objects |
| Widget file not in registry | `check-widget-registry` | Register in `index.ts` or `base-registry.ts` |

The TypeScript check (`check-types`) runs async in the background and will wake the model if `tsc --noEmit` finds errors.

See [docs/claude-hooks.md](claude-hooks.md) for details on all five hooks.

---

## Patterns from existing widgets

| Pattern | Where to look |
|---------|---------------|
| Client-side only, no API | `ClockWidget.tsx` |
| Simple data fetch + display | `RainWidget.tsx` |
| Multiple data rows, card list | `GarbageWidget.tsx`, `CalendarWidget.tsx` |
| Hero number + secondary stats | `PolestarWidget.tsx` |
| Row-based dense list | `BusWidget.tsx`, `TrafficWidget.tsx` |
| Equal-height column grid | `WeatherWidget.tsx` (HourlyCol / DailyCol) |
| Skip from RotatorWidget when no data | `WarningsWidget.tsx` (`onSkip`) |
| Real-time SSE subscription | `NewsTickerWidget.tsx` (`useNtfy`) |
| Accessing global config (location) | `backend/app/routers/weather.py` |
| SVG chart | `RainWidget.tsx` |
| Fit-to-box (measure and truncate) | `GarbageWidget.tsx` (ResizeObserver) |

## Backend guidelines

- Keep all external HTTP calls in the **backend router** — never fetch third-party APIs from the frontend (CORS, caching, and rate-limiting all handled server-side).
- Use the **in-memory TTL cache** pattern from existing routers. Return stale data on upstream errors rather than propagating a 502.
- Match your `refetchInterval` in the hook to the backend `CACHE_TTL` — fetching more often than the cache TTL wastes requests.
