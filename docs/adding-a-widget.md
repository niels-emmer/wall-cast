# Adding a Widget

Wall-cast uses a simple registry pattern. Adding a new widget type takes about 10 minutes.

## Steps

### 1. Create the frontend component

```
frontend/src/widgets/<name>/<Name>Widget.tsx
```

The component receives a single prop `config: Record<string, unknown>` containing whatever you put in the YAML `config:` block.

```tsx
interface Props {
  config: Record<string, unknown>
}

export function MyWidget({ config }: Props) {
  // Use config values:
  const myOption = config.my_option as string ?? 'default'

  return <div>...</div>
}
```

### 2. Register the component

In `frontend/src/widgets/index.ts`, import and register:

```ts
import { MyWidget } from './my-widget/MyWidget'

export const WIDGET_REGISTRY = {
  // ... existing
  my_widget: MyWidget,
}
```

### 3. Add a backend route (if the widget needs external data)

Create `backend/app/routers/my_widget.py` and add caching:

```python
from fastapi import APIRouter
router = APIRouter(tags=["my_widget"])

@router.get("/my-widget")
async def get_my_widget() -> dict:
    # fetch, cache, return
    ...
```

Mount it in `backend/app/main.py`:

```python
from app.routers import my_widget
app.include_router(my_widget.router, prefix="/api")
```

Create a hook in `frontend/src/hooks/use-my-widget.ts` to fetch it.

### 4. Add to config

Use it in `config/wall-cast.yaml`:

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

### 5. Document it

Add the widget to `docs/config-reference.md`.

## Guidelines

- Keep all external HTTP calls in the backend router, never in the frontend component directly.
- Use the caching pattern from existing routers (in-memory TTL dict).
- Use `clamp()` CSS for font sizes so the widget looks reasonable across resolutions.
- Use CSS variables (`var(--color-text)`, `var(--color-muted)`, `var(--color-accent)`, `var(--color-panel)`, `var(--color-border)`) for consistent theming.
