# Rules System Rewrite Plan

**Status:** Complete ✅
**Started:** 2026-03-23
**Finished:** 2026-03-23

---

## Goal

Rewrite the assistant rules system so rules are:
- Generic (shared) or personal (per-person)
- Active/inactive toggle
- Defined as a condition: `variable operator value unit` (e.g. `bus.delay_minutes >= 5 min`)
- Editable via admin panel (add/edit/remove)
- All saved to `config/wall-cast.yaml`

---

## Implementation Batches

### Batch A — Phase 1+3 (YAML schema + assistant engine) ✅ / 🔲
**Files touched:**
- `config/wall-cast.example.yaml` — update schema
- `backend/app/wall_config.py` — add migration from old flat rules
- `assistant/assistant.py` — rewrite main loop to use new rule objects
- `assistant/rules/__init__.py` — rewrite: generic evaluator replaces per-file checkers
- `assistant/rules/garbage.py` — replaced by variable extractor
- `assistant/rules/weather.py` — replaced by variable extractor (special case: enum operator)
- `assistant/rules/calendar.py` — replaced by variable extractor
- `assistant/rules/bus.py` — replaced by variable extractor
- `assistant/rules/traffic.py` — replaced by variable extractor
- NEW: `assistant/variables/` — variable catalogue + extractors

**New YAML rule shape:**
```yaml
shared:
  assistant:
    rules:
      - id: garbage-reminder
        title: Garbage pickup reminder
        description: Alert when bin collection is approaching
        enabled: true
        condition:
          variable: garbage.hours_until_pickup
          operator: "<="
          value: 18
          unit: h
      - id: bus-delay
        title: Bus delay alert
        enabled: true
        condition:
          variable: bus.delay_minutes
          operator: ">="
          value: 5
          unit: min
      - id: traffic-delay
        title: Traffic delay alert
        enabled: true
        condition:
          variable: traffic.delay_pct
          operator: ">="
          value: 25
          unit: "%"
      - id: calendar-reminder
        title: Calendar reminder
        enabled: true
        condition:
          variable: calendar.minutes_until_event
          operator: "<="
          value: 30
          unit: min
      - id: weather-warning
        title: Weather warning
        enabled: true
        condition:
          variable: weather.warning_level
          operator: in
          value: ["orange", "red"]
          unit: null

# Per-person rules:
people:
  - id: bob
    name: Bob
    rules:
      - id: bob-bus-custom
        title: Bob's bus threshold
        enabled: true
        condition:
          variable: bus.delay_minutes
          operator: ">="
          value: 3
          unit: min
```

**Migration logic in wall_config.py:**
Old flat keys → new rule list (run once on load, rewrite YAML):
```
garbage_notify_hours_before: 18  →  rule id=garbage-reminder, value=18
bus_delay_threshold_min: 5       →  rule id=bus-delay, value=5
traffic_delay_threshold_pct: 25  →  rule id=traffic-delay, value=25
calendar_reminder_min: 30        →  rule id=calendar-reminder, value=30
```

**Variable catalogue** (`assistant/variables/catalogue.py`):

| id | label | api | requires_person | operators | unit |
|----|-------|-----|-----------------|-----------|------|
| garbage.hours_until_pickup | Garbage – hours until pickup | /api/garbage | No | <= >= < > == | h |
| bus.delay_minutes | Bus – delay | /api/bus | Yes | <= >= < > == | min |
| bus.cancelled | Bus – cancelled | /api/bus | Yes | == | bool |
| traffic.delay_pct | Traffic – delay above normal | /api/traffic | Yes | <= >= < > == | % |
| traffic.delay_minutes | Traffic – delay | /api/traffic | Yes | <= >= < > == | min |
| calendar.minutes_until_event | Calendar – minutes until next event | /api/calendar | Yes | <= >= < > == | min |
| polestar.battery_pct | Polestar – battery | /api/polestar | No | <= >= < > == | % |
| weather.warning_level | Weather warning level | /api/warnings | No | in | enum |

**Rule engine loop** (`assistant/rules/__init__.py`):
1. Collect all enabled generic rules + per-person rules
2. Deduplicate required endpoints; fetch each once (httpx, same pattern as before)
3. For each rule, call `extract(variable_id, api_data, person?)` → scalar value
4. Evaluate: `actual_value {operator} rule.condition.value`
5. Dedup check: key = `{rule.id}:{person_id or "global"}:{date or event_id}`
6. If not fired: format title/message, dispatch via ntfy (same as before)

**Dedup key strategy** (preserving current behaviour):
- `garbage.hours_until_pickup`: key includes pickup date
- `bus.delay_minutes`: key includes departure time + first event id
- `traffic.*`: key includes today's date (fires once per day)
- `calendar.*`: key includes event id + reminder_min
- `weather.*`: key includes phenomenon + valid_from

---

### Batch B — Phase 2 (variable catalogue endpoint) 🔲
**Files touched:**
- NEW: `backend/app/routers/rule_variables.py`
- `backend/app/main.py` — register router

`GET /api/admin/rule-variables` returns:
```json
[
  {
    "id": "bus.delay_minutes",
    "label": "Bus – delay (minutes)",
    "requires_person": true,
    "operators": [">=", "<=", ">", "<", "=="],
    "default_unit": "min",
    "type": "number"
  },
  ...
]
```

---

### Batch C — Phase 4 (TypeScript types) 🔲
**Files touched:**
- `frontend/src/types/config.ts`

Changes:
- Remove `AssistantRulesConfig` (the flat object)
- Add `RuleCondition`, `Rule` interfaces
- Change `AssistantConfig.rules` from `AssistantRulesConfig` to `Rule[]`
- Add `Person.rules?: Rule[]`

---

### Batch D — Phase 5a+5b (admin panel rule lists, no modal) 🔲
**Files touched:**
- `frontend/src/admin/AdminPanel.tsx`

**Assistant tab — generic rules:**
Replace the 4 static NumberInputs with a `<RuleList>` component:
- Each row: `[checkbox enabled] [title] [condition pill] [Edit btn] [Delete btn]`
- `[+ Add rule]` button at bottom (opens modal — Phase 5c, skip for now, just render disabled)
- Inline enable/disable saves immediately

**People tab — personal rules:**
Add `<RuleList>` at bottom of each person panel.
Only `requires_person: true` variables shown in builder (enforced in Phase 5c).

---

### Batch E — Phase 5c (rule editor modal) 🔲 — DO TOGETHER WITH USER
**Files touched:**
- `frontend/src/admin/AdminPanel.tsx` (or extracted component)

Rule builder modal:
- Title + description inputs
- Condition builder: pill row assembled by clicking tag groups below
- Variable tags | Operator tags | Value input (number or text) | Unit (auto from catalogue, editable)
- Drag-to-reorder pills within condition row (HTML5 drag API, no extra lib)
- Enabled checkbox
- Save / Cancel

---

## Key invariants to preserve
- All changes save to `config/wall-cast.yaml` via `PUT /api/admin/config`
- Assistant re-reads config on file change (already works via watchfiles)
- Dedup state in `/config/assistant-state.json` — keys change format, wipe on migration is acceptable
- No Pydantic models — config handled as plain dicts throughout backend
- Layout CSS: all layout-critical styles use inline `style={{}}`, not Tailwind classes

---

## Files NOT touched
- `assistant/ai/formatter.py` — unchanged
- `assistant/notify/ntfy.py` — unchanged
- `assistant/state.py` — unchanged (key format changes but mechanism stays)
- All widget files, backend routers (except main.py for new router)
- nginx config, Docker files
