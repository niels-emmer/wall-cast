# Adding a Widget

Wall-cast uses a simple registry pattern. A new widget type typically takes 15–30 minutes to add.

## Overview

A widget is:
1. A **React component** in `frontend/src/widgets/<name>/`
2. An entry in the **widget registry** (`frontend/src/widgets/index.ts`)
3. Optionally a **backend router** if the widget needs external data
4. A **TanStack Query hook** to fetch that data
5. An entry in `docs/config-reference.md`

---

## Step-by-step

### 1. Create the React component

```
frontend/src/widgets/<name>/<Name>Widget.tsx
```

Every widget receives a single prop — `config: Record<string, unknown>` — containing whatever you put in the YAML `config:` block for that widget instance.

```tsx
interface Props {
  config: Record<string, unknown>
}

export function MyWidget({ config }: Props) {
  const myOption = config.my_option as string ?? 'default'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0.85rem',
      boxSizing: 'border-box',
    }}>
      {myOption}
    </div>
  )
}
```

**Important styling rules:**
- Always use **inline `style={{ }}`** for layout properties — Tailwind utility classes are unreliable in the production build due to tree-shaking. This applies to `display`, `flexDirection`, `height`, `overflow`, `whiteSpace`, etc.
- Use **`clamp(min, preferred, max)`** for font sizes so the widget looks reasonable across screen resolutions.
- Use CSS variables for colours: `var(--color-text)`, `var(--color-muted)`, `var(--color-accent)`, `var(--color-panel)`, `var(--color-border)`.
- The widget wrapper in `App.tsx` already sets `height: 100%` and `minHeight: 0` — your root element should also use `height: '100%'` to fill the cell.

---

### 2. Register the widget

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

### 3. Add a backend route (if the widget needs external data)

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

### 4. Create a data hook

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

export function MyWidget({ config }: Props) {
  const { data, isError } = useMyWidget()

  if (isError || !data) return <div style={{ ... }}>Loading...</div>

  return <div>{ data.value }</div>
}
```

---

### 5. Add it to the YAML config

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

### 6. Document it

Add the new widget to `docs/config-reference.md` under **Widget types**, following the same format as existing entries.

---

## Patterns from existing widgets

| Pattern | Where to look |
|---------|---------------|
| Client-side only, no API | `ClockWidget.tsx` |
| Simple data fetch + display | `RainWidget.tsx` |
| Multiple data rows, complex layout | `WeatherWidget.tsx` |
| Real-time SSE subscription | `NewsTickerWidget.tsx` (`useNtfy`) |
| Accessing global config (location) | `backend/app/routers/weather.py` |
| SVG chart | `RainWidget.tsx` |

## Guidelines

- Keep all external HTTP calls in the **backend router** — never fetch third-party APIs from the frontend (CORS, caching, and rate-limiting all handled server-side).
- Use the **in-memory TTL cache** pattern from existing routers. Return stale data on upstream errors rather than propagating a 502.
- Match your `refetchInterval` in the hook to the backend `CACHE_TTL` — fetching more often than the cache TTL wastes requests.
- All layout must use **inline `style`** — not Tailwind classes (see note in Step 1).
- Use `clamp()` for all font sizes.
- Use `var(--color-*)` CSS variables for all colours.
