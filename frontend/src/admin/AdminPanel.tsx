import { useState, useEffect } from 'react'
import {
  MantineProvider, createTheme,
  Box, Container, Stack, Group, Paper,
  Text, Code, Title,
  TextInput, NumberInput,
  Checkbox,
  Button, ActionIcon,
  Tabs, SegmentedControl,
  Loader, Alert,
  Anchor, Divider,
} from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LANGUAGE_LABELS, type Lang } from '../i18n/translations'
import type {
  AdminConfig,
  MultiScreenConfig,
  FlatConfig,
  Location,
  Person,
  ScreenSection,
  WidgetConfig,
} from '../types/config'
import { isMultiScreen } from '../types/config'
import { apiFetch } from '../lib/api'

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const theme = createTheme({
  primaryColor: 'cyan',
  defaultRadius: 'sm',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: 'ui-monospace, Menlo, "Cascadia Code", Consolas, monospace',
  colors: {
    dark: [
      '#C1C2C5', '#A6A7AB', '#909296', '#5C5F66',
      '#373A40', '#2C2E33', '#25262B', '#1A1B1E', '#141517', '#0c0c0c',
    ],
  },
  components: {
    Paper: Paper.extend({
      defaultProps: { bg: 'dark.8' },
    }),
  },
})

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Unlock scrolling while the admin panel is open (index.css locks html+body for the kiosk). */
function useScrollUnlock() {
  useEffect(() => {
    const html = document.documentElement
    const prev = { html: html.style.overflow, body: document.body.style.overflow }
    html.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      html.style.overflow = prev.html
      document.body.style.overflow = prev.body
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

async function saveAdminConfig(config: AdminConfig): Promise<void> {
  const res = await fetch('/api/admin/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed (${res.status}): ${text}`)
  }
}

function useAdminConfig() {
  return useQuery<AdminConfig>({
    queryKey: ['admin-config'],
    queryFn: () => apiFetch<AdminConfig>('/api/admin/config'),
    staleTime: Infinity,
    retry: 0,
  })
}

// ---------------------------------------------------------------------------
// Config accessors
// ---------------------------------------------------------------------------

function getActiveWidgets(draft: AdminConfig, screenId: string): WidgetConfig[] {
  if (!isMultiScreen(draft)) return draft.widgets ?? []
  if (screenId === '_shared') return draft.shared.widgets ?? []
  const screen = draft.screens.find(s => s.id === screenId)
  return screen?.widgets ?? []
}

function setActiveWidgets(draft: AdminConfig, screenId: string, widgets: WidgetConfig[]): AdminConfig {
  if (!isMultiScreen(draft)) return { ...draft, widgets }
  if (screenId === '_shared') return { ...draft, shared: { ...draft.shared, widgets } }
  return {
    ...draft,
    screens: draft.screens.map(s => s.id === screenId ? { ...s, widgets } : s),
  }
}

function getLanguage(draft: AdminConfig): string {
  if (!isMultiScreen(draft)) return (draft.language ?? 'nl') as string
  return (draft.shared.language ?? 'nl') as string
}

function setLanguageInDraft(draft: AdminConfig, lang: string): AdminConfig {
  if (!isMultiScreen(draft)) return { ...draft, language: lang }
  return { ...draft, shared: { ...draft.shared, language: lang } }
}

function getLocation(draft: AdminConfig): Location | undefined {
  if (!isMultiScreen(draft)) return (draft as FlatConfig).location
  return draft.shared.location
}

function setLocationInDraft(draft: AdminConfig, loc: Location): AdminConfig {
  if (!isMultiScreen(draft)) return { ...draft, location: loc }
  return { ...draft, shared: { ...draft.shared, location: loc } }
}

function getPeople(draft: AdminConfig): Person[] {
  if (!isMultiScreen(draft)) return []
  return (draft.shared.people ?? []) as Person[]
}

function setPeopleInDraft(draft: AdminConfig, people: Person[]): AdminConfig {
  if (!isMultiScreen(draft)) return draft
  return { ...draft, shared: { ...draft.shared, people } }
}

function getScreenPeople(draft: AdminConfig, screenId: string): string[] {
  if (!isMultiScreen(draft)) return []
  const screen = draft.screens.find(s => s.id === screenId)
  return (screen?.people ?? []) as string[]
}

function setScreenPeople(draft: AdminConfig, screenId: string, ids: string[]): AdminConfig {
  if (!isMultiScreen(draft)) return draft
  return {
    ...draft,
    screens: draft.screens.map(s => s.id === screenId ? { ...s, people: ids } : s),
  }
}

// ---------------------------------------------------------------------------
// Screen CRUD helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screen'
}

function uniqueId(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function makeDefaultScreen(id: string, name: string): ScreenSection {
  return {
    id,
    name,
    people: [],
    layout: { columns: 12, rows: 8 },
    widgets: [
      {
        id: `${id}-clock`,
        type: 'clock',
        col: 1, row: 1, col_span: 4, row_span: 3,
        config: { show_seconds: true, show_date: true },
      },
      {
        id: `${id}-main-rotator`,
        type: 'rotate',
        col: 5, row: 1, col_span: 8, row_span: 7,
        config: {
          interval_sec: 20,
          widgets: [
            { type: 'weather', config: { show_hourly: true, show_daily: true } },
            { type: 'calendar', config: { calendar_ids: [] } },
            { type: 'traffic', config: { home_address: '', work_address: '', route_roads: '' } },
            { type: 'warnings', config: {} },
          ],
        },
      },
      {
        id: `${id}-bottom-rotator`,
        type: 'rotate',
        col: 1, row: 4, col_span: 4, row_span: 4,
        config: {
          interval_sec: 20,
          widgets: [
            { type: 'rain', config: {} },
            { type: 'garbage', config: { days_ahead: 31, postcode: '', huisnummer: '' } },
            { type: 'polestar', config: {} },
            { type: 'bus', config: { stop_city: '', stop_name: '' } },
          ],
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.07em' }}>
      {children}
    </Text>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RotateSlot { type: string; config: Record<string, unknown>; enabled?: boolean }

function SlotConfig({
  slot, onChange,
}: {
  slot: RotateSlot
  onChange: (slot: RotateSlot) => void
}) {
  const cfg = slot.config

  if (slot.type === 'traffic') {
    return (
      <Stack gap="xs" pl="xl" pt={4}>
        <TextInput
          label="Home address"
          placeholder="Streetname 1, 1234AB City, NL"
          value={(cfg.home_address as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, home_address: e.target.value } })}
          size="xs"
        />
        <TextInput
          label="Work address"
          placeholder="Streetname 2, 5678CD City, NL"
          value={(cfg.work_address as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, work_address: e.target.value } })}
          size="xs"
        />
        <TextInput
          label="Route roads"
          placeholder="A10,A2,N14"
          description="Comma-separated — jams on these roads float to the top"
          value={(cfg.route_roads as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, route_roads: e.target.value } })}
          size="xs"
        />
      </Stack>
    )
  }

  if (slot.type === 'bus') {
    return (
      <Group gap="sm" pl="xl" pt={4} wrap="wrap" align="flex-start">
        <TextInput
          label="City"
          value={(cfg.stop_city as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, stop_city: e.target.value } })}
          size="xs"
          w={140}
        />
        <TextInput
          label="Stop name"
          value={(cfg.stop_name as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, stop_name: e.target.value } })}
          size="xs"
          w={180}
        />
      </Group>
    )
  }

  if (slot.type === 'garbage') {
    return (
      <Group gap="sm" pl="xl" pt={4} wrap="wrap" align="flex-start">
        <TextInput
          label="Postcode"
          placeholder="1234AB"
          value={(cfg.postcode as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, postcode: e.target.value } })}
          size="xs"
          w={100}
        />
        <TextInput
          label="House number"
          placeholder="1"
          value={(cfg.huisnummer as string) ?? ''}
          onChange={e => onChange({ ...slot, config: { ...cfg, huisnummer: e.target.value } })}
          size="xs"
          w={110}
        />
        <NumberInput
          label="Days ahead"
          value={(cfg.days_ahead as number) ?? 7}
          onChange={v => onChange({ ...slot, config: { ...cfg, days_ahead: Number(v) } })}
          min={1}
          max={60}
          size="xs"
          w={100}
        />
      </Group>
    )
  }

  if (slot.type === 'weather') {
    return (
      <Group gap="md" pl="xl" pt={4}>
        <Checkbox
          label="Show hourly"
          checked={cfg.show_hourly !== false}
          onChange={e => onChange({ ...slot, config: { ...cfg, show_hourly: e.currentTarget.checked } })}
          size="xs"
        />
        <Checkbox
          label="Show daily"
          checked={cfg.show_daily !== false}
          onChange={e => onChange({ ...slot, config: { ...cfg, show_daily: e.currentTarget.checked } })}
          size="xs"
        />
      </Group>
    )
  }

  if (slot.type === 'calendar') {
    const ids = (cfg.calendar_ids as string[]) ?? []
    return (
      <Stack gap="xs" pl="xl" pt={4}>
        <Text size="xs" c="dimmed" fw={500}>Extra calendar IDs</Text>
        {ids.map((id, i) => (
          <Group key={i} gap="xs" wrap="nowrap">
            <TextInput
              placeholder="xxxx@group.calendar.google.com"
              value={id}
              onChange={e => {
                const next = ids.map((x, j) => j === i ? e.target.value : x)
                onChange({ ...slot, config: { ...cfg, calendar_ids: next } })
              }}
              size="xs"
              style={{ flex: 1, minWidth: 0 }}
              ff="monospace"
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => onChange({ ...slot, config: { ...cfg, calendar_ids: ids.filter((_, j) => j !== i) } })}
              style={{ flexShrink: 0 }}
            >
              ✕
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          onClick={() => onChange({ ...slot, config: { ...cfg, calendar_ids: [...ids, ''] } })}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add calendar
        </Button>
      </Stack>
    )
  }

  return null
}

function RotatorSection({
  widgetId, rotateConfig, onChange,
}: {
  widgetId: string
  rotateConfig: Record<string, unknown>
  onChange: (cfg: Record<string, unknown>) => void
}) {
  const slots = (rotateConfig.widgets as RotateSlot[]) ?? []
  const intervalSec = (rotateConfig.interval_sec as number) ?? 30

  return (
    <Paper p="md" radius="sm" withBorder mb="md">
      <SectionTitle>Rotator: <Code fz="xs">{widgetId}</Code></SectionTitle>
      <Stack gap="sm">
        <NumberInput
          label="Interval (seconds)"
          value={intervalSec}
          onChange={v => onChange({ ...rotateConfig, interval_sec: Number(v) })}
          min={5}
          max={3600}
          size="sm"
          w={130}
        />
        <Stack gap="md">
          <Text size="xs" c="dimmed" fw={500}>Slots</Text>
          {slots.map((slot, idx) => (
            <Stack key={idx} gap={6}>
              <Checkbox
                checked={slot.enabled !== false}
                onChange={() => {
                  const next = slots.map((s, i) => i === idx ? { ...s, enabled: s.enabled !== false ? false : true } : s)
                  onChange({ ...rotateConfig, widgets: next })
                }}
                label={<Code fz="xs">{slot.type}</Code>}
                size="sm"
              />
              <SlotConfig
                slot={slot}
                onChange={updated => {
                  const next = slots.map((s, i) => i === idx ? updated : s)
                  onChange({ ...rotateConfig, widgets: next })
                }}
              />
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}

interface NewsFeed { url: string; label: string }

function NewsSection({
  newsConfig, onChange,
}: {
  newsConfig: Record<string, unknown>
  onChange: (cfg: Record<string, unknown>) => void
}) {
  const feeds = (newsConfig.feeds as NewsFeed[]) ?? []
  const scrollSpeed = (newsConfig.scroll_speed_px_per_sec as number) ?? 80
  const ntfyUrl = (newsConfig.ntfy_url as string) ?? ''
  const ntfyTopic = (newsConfig.ntfy_topic as string) ?? ''

  return (
    <Paper p="md" radius="sm" withBorder mb="md">
      <SectionTitle>News ticker</SectionTitle>
      <Stack gap="xs">
        {feeds.map((feed, idx) => (
          <Group key={idx} gap="xs" wrap="nowrap">
            <TextInput
              placeholder="Label"
              value={feed.label}
              onChange={e => {
                const next = feeds.map((f, i) => i === idx ? { ...f, label: e.target.value } : f)
                onChange({ ...newsConfig, feeds: next })
              }}
              size="sm"
              w={100}
              style={{ flexShrink: 0 }}
            />
            <TextInput
              placeholder="RSS feed URL"
              value={feed.url}
              onChange={e => {
                const next = feeds.map((f, i) => i === idx ? { ...f, url: e.target.value } : f)
                onChange({ ...newsConfig, feeds: next })
              }}
              size="sm"
              style={{ flex: 1, minWidth: 0 }}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => onChange({ ...newsConfig, feeds: feeds.filter((_, i) => i !== idx) })}
              style={{ flexShrink: 0 }}
            >
              ✕
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          onClick={() => onChange({ ...newsConfig, feeds: [...feeds, { url: '', label: '' }] })}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add feed
        </Button>

        <Divider mt="xs" />

        <NumberInput
          label="Scroll speed (px/s)"
          value={scrollSpeed}
          onChange={v => onChange({ ...newsConfig, scroll_speed_px_per_sec: Number(v) })}
          min={10}
          max={500}
          size="sm"
          w={160}
        />

        <Divider mt="xs" />

        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.07em' }}>Breaking news (ntfy)</Text>
        <Group gap="sm" wrap="wrap" align="flex-start">
          <TextInput
            label="ntfy server URL"
            placeholder="https://ntfy.sh"
            value={ntfyUrl}
            onChange={e => onChange({ ...newsConfig, ntfy_url: e.target.value })}
            size="sm"
            style={{ flex: 1, minWidth: 200 }}
          />
          <TextInput
            label="Topic"
            placeholder="wall-cast"
            value={ntfyTopic}
            onChange={e => onChange({ ...newsConfig, ntfy_topic: e.target.value })}
            size="sm"
            w={160}
          />
        </Group>
      </Stack>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// LocationSection
// ---------------------------------------------------------------------------

function LocationSection({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const loc = getLocation(draft)
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'error'>('idle')
  const [geoError, setGeoError] = useState('')

  const lat = loc?.lat ?? 0
  const lon = loc?.lon ?? 0
  const name = loc?.name ?? ''

  function updateLoc(patch: Partial<Location>) {
    onChange(setLocationInDraft(draft, { lat, lon, name, ...patch }))
  }

  async function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.')
      setGeoState('error')
      return
    }
    setGeoState('locating')
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const newLat = Math.round(pos.coords.latitude * 10000) / 10000
        const newLon = Math.round(pos.coords.longitude * 10000) / 10000
        let newName = name
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLon}`,
            { headers: { 'Accept-Language': 'en' } },
          )
          if (res.ok) {
            const data = await res.json()
            const addr = data.address ?? {}
            newName = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? data.display_name ?? name
          }
        } catch {
          // name stays as-is if reverse geocoding fails
        }
        onChange(setLocationInDraft(draft, { lat: newLat, lon: newLon, name: newName }))
        setGeoState('idle')
      },
      err => {
        setGeoError(err.message)
        setGeoState('error')
      },
      { timeout: 10000 },
    )
  }

  return (
    <Paper p="md" radius="sm" withBorder>
      <SectionTitle>Home location</SectionTitle>
      <Text size="sm" c="dimmed" mb="md">
        Used by weather, sunrise/sunset, and other location-aware widgets.
      </Text>
      <Stack gap="sm">
        <Group gap="md" align="flex-end" wrap="wrap">
          <NumberInput
            label="Latitude"
            value={lat}
            onChange={v => updateLoc({ lat: Number(v) })}
            decimalScale={4}
            step={0.0001}
            min={-90}
            max={90}
            size="sm"
            w={130}
          />
          <NumberInput
            label="Longitude"
            value={lon}
            onChange={v => updateLoc({ lon: Number(v) })}
            decimalScale={4}
            step={0.0001}
            min={-180}
            max={180}
            size="sm"
            w={130}
          />
          <TextInput
            label="Display name"
            placeholder="Amsterdam"
            value={name}
            onChange={e => updateLoc({ name: e.target.value })}
            size="sm"
            w={180}
          />
          <Button
            variant="subtle"
            color="cyan"
            size="sm"
            onClick={handleGeolocate}
            loading={geoState === 'locating'}
            style={{ marginBottom: 1 }}
          >
            📍 Geolocate
          </Button>
        </Group>
        {geoState === 'error' && (
          <Alert color="red" variant="light" p="xs" radius="sm">
            {geoError || 'Could not determine location.'}
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// Tab: General
// ---------------------------------------------------------------------------

function GeneralTab({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const multi = isMultiScreen(draft)
  const lang = getLanguage(draft) as Lang

  const widgets = multi ? (draft.shared.widgets ?? []) : (draft.widgets ?? [])
  const newsWidget = widgets.find(w => w.type === 'news')

  function updateNewsConfig(cfg: Record<string, unknown>) {
    if (multi) {
      const updated = (draft.shared.widgets ?? []).map(w => w.type === 'news' ? { ...w, config: cfg } : w)
      onChange({ ...draft, shared: { ...draft.shared, widgets: updated } })
    } else {
      const updated = (draft.widgets ?? []).map(w => w.type === 'news' ? { ...w, config: cfg } : w)
      onChange({ ...draft, widgets: updated })
    }
  }

  return (
    <Stack gap="md">
      <LocationSection draft={draft} onChange={onChange} />

      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Display language</SectionTitle>
        <SegmentedControl
          value={lang}
          onChange={val => onChange(setLanguageInDraft(draft, val))}
          data={(Object.entries(LANGUAGE_LABELS) as [Lang, string][]).map(([code, label]) => ({ value: code, label }))}
          size="sm"
        />
      </Paper>

      {newsWidget && (
        <NewsSection newsConfig={newsWidget.config} onChange={updateNewsConfig} />
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Tab: Screens
// ---------------------------------------------------------------------------

function ClockSection({
  widgets, onChange,
}: {
  widgets: WidgetConfig[]
  onChange: (widgets: WidgetConfig[]) => void
}) {
  const clockWidget = widgets.find(w => w.type === 'clock')
  if (!clockWidget) return null
  const cfg = clockWidget.config

  function updateClock(patch: Record<string, unknown>) {
    onChange(widgets.map(w => w.type === 'clock' ? { ...w, config: { ...cfg, ...patch } } : w))
  }

  return (
    <Paper p="md" radius="sm" withBorder mb="md">
      <SectionTitle>Clock</SectionTitle>
      <Group gap="md">
        <Checkbox
          label="Show seconds"
          checked={cfg.show_seconds !== false}
          onChange={e => updateClock({ show_seconds: e.currentTarget.checked })}
          size="sm"
        />
        <Checkbox
          label="Show date"
          checked={cfg.show_date !== false}
          onChange={e => updateClock({ show_date: e.currentTarget.checked })}
          size="sm"
        />
      </Group>
    </Paper>
  )
}

function ScreenPeopleSection({
  allPeople, screenPeopleIds, onChange,
}: {
  allPeople: Person[]
  screenPeopleIds: string[]
  onChange: (ids: string[]) => void
}) {
  const familyPeople = allPeople.filter(p => p.family)
  const assignable = allPeople.filter(p => !p.family)

  if (allPeople.length === 0) {
    return (
      <Paper p="md" radius="sm" withBorder mb="md">
        <SectionTitle>People on this screen</SectionTitle>
        <Text size="sm" c="dimmed">
          No people defined yet — add them in the <Text span fw={600} c="cyan">People</Text> tab first.
        </Text>
      </Paper>
    )
  }

  function toggle(id: string) {
    onChange(screenPeopleIds.includes(id)
      ? screenPeopleIds.filter(x => x !== id)
      : [...screenPeopleIds, id]
    )
  }

  return (
    <Paper p="md" radius="sm" withBorder mb="md">
      <SectionTitle>People on this screen</SectionTitle>
      <Stack gap="xs">
        {familyPeople.map(p => (
          <Checkbox
            key={p.id}
            checked
            disabled
            label={
              <Group gap={6}>
                <Text size="sm">{p.name || p.id}</Text>
                <Text size="xs" c="dimmed">(family)</Text>
              </Group>
            }
            size="sm"
          />
        ))}
        {assignable.map(p => (
          <Checkbox
            key={p.id}
            checked={screenPeopleIds.includes(p.id)}
            onChange={() => toggle(p.id)}
            label={<Text size="sm">{p.name || p.id}</Text>}
            size="sm"
          />
        ))}
      </Stack>
    </Paper>
  )
}

function ScreensTab({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const multi = isMultiScreen(draft)
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    multi ? ((draft as MultiScreenConfig).screens[0]?.id ?? null) : null
  )
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [scanResults, setScanResults] = useState<{ name: string; ip: string }[]>([])

  function selectScreen(id: string) {
    setSelectedId(id)
    setScanState('idle')
    setScanResults([])
  }

  async function handleScan() {
    setScanState('scanning')
    setScanResults([])
    try {
      const res = await fetch('/api/admin/scan')
      if (!res.ok) throw new Error(`${res.status}`)
      const devices = await res.json()
      setScanResults(devices)
      setScanState('done')
    } catch {
      setScanState('error')
    }
  }

  function pickScanResult(ip: string) {
    if (!currentScreen) return
    onChange({
      ...multiDraft,
      screens: multiDraft.screens.map(s => s.id === currentScreen.id ? { ...s, chromecast_ip: ip } : s),
    })
    setScanState('idle')
    setScanResults([])
  }

  if (!multi) {
    const widgets = draft.widgets ?? []
    const rotators = widgets.filter(w => w.type === 'rotate')
    return (
      <Stack gap="md">
        <ClockSection
          widgets={widgets}
          onChange={updated => onChange({ ...draft, widgets: updated })}
        />
        {rotators.map(w => (
          <RotatorSection
            key={w.id}
            widgetId={w.id}
            rotateConfig={w.config}
            onChange={cfg => onChange({ ...draft, widgets: widgets.map(x => x.id === w.id ? { ...x, config: cfg } : x) })}
          />
        ))}
      </Stack>
    )
  }

  const multiDraft = draft as MultiScreenConfig

  function handleAddScreen() {
    const existingIds = multiDraft.screens.map(s => s.id)
    const name = 'New Screen'
    const id = uniqueId(slugify(name), existingIds)
    const newScreen = makeDefaultScreen(id, name)
    onChange({ ...multiDraft, screens: [...multiDraft.screens, newScreen] })
    setSelectedId(id)
  }

  function handleDeleteScreen(screenId: string) {
    if (!window.confirm('Delete this screen? This cannot be undone.')) return
    const remaining = multiDraft.screens.filter(s => s.id !== screenId)
    onChange({ ...multiDraft, screens: remaining })
    setSelectedId(remaining[0]?.id ?? null)
  }

  const currentScreen = selectedId ? multiDraft.screens.find(s => s.id === selectedId) ?? null : null
  const screenWidgets = currentScreen ? getActiveWidgets(draft, currentScreen.id) : []
  const rotators = screenWidgets.filter(w => w.type === 'rotate')
  const allPeople = getPeople(draft)
  const screenPeopleIds = currentScreen ? getScreenPeople(draft, currentScreen.id) : []

  function updateScreenWidgets(widgets: WidgetConfig[]) {
    if (!currentScreen) return
    onChange(setActiveWidgets(draft, currentScreen.id, widgets))
  }

  return (
    <Stack gap="md">
      {/* Screen selector */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Screens</SectionTitle>
        <Group gap="xs" wrap="wrap">
          {multiDraft.screens.map(s => (
            <Button
              key={s.id}
              size="sm"
              variant={selectedId === s.id ? 'filled' : 'subtle'}
              color={selectedId === s.id ? 'cyan' : 'gray'}
              onClick={() => selectScreen(s.id)}
            >
              {s.name || s.id}
            </Button>
          ))}
          <Button size="sm" variant="subtle" color="gray" onClick={handleAddScreen}>
            + Add
          </Button>
        </Group>
      </Paper>

      {currentScreen && (
        <>
          {/* Screen settings */}
          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Screen settings</SectionTitle>
            <Stack gap="md">
              <Group gap="md" align="flex-end" wrap="wrap">
                <TextInput
                  label="Name"
                  description="Display label shown in the admin panel"
                  value={currentScreen.name ?? currentScreen.id}
                  onChange={e => onChange({
                    ...multiDraft,
                    screens: multiDraft.screens.map(s => s.id === currentScreen.id ? { ...s, name: e.target.value } : s),
                  })}
                  size="sm"
                  w={200}
                />
                <TextInput
                  label="Screen ID"
                  description="Used in the cast URL — keep it URL-safe"
                  value={currentScreen.id}
                  onChange={e => {
                    const newId = e.target.value
                    setSelectedId(newId)
                    onChange({
                      ...multiDraft,
                      screens: multiDraft.screens.map(s => s.id === currentScreen.id ? { ...s, id: newId } : s),
                    })
                  }}
                  size="sm"
                  w={200}
                  ff="monospace"
                />
              </Group>
              <Group gap={6} align="center">
                <Text size="xs" c="dimmed">Cast URL:</Text>
                <Anchor
                  href={`${window.location.origin}/?screen=${currentScreen.id}`}
                  target="_blank"
                  size="xs"
                  ff="monospace"
                >
                  {window.location.origin}/?screen={currentScreen.id}
                </Anchor>
              </Group>

              <Stack gap="xs">
                <TextInput
                  label="Chromecast IP"
                  description="Leave blank to disable auto-casting"
                  placeholder="192.168.1.42"
                  value={currentScreen.chromecast_ip ?? ''}
                  onChange={e => onChange({
                    ...multiDraft,
                    screens: multiDraft.screens.map(s => s.id === currentScreen.id ? { ...s, chromecast_ip: e.target.value } : s),
                  })}
                  size="sm"
                  w={200}
                  ff="monospace"
                />
                {scanState !== 'scanning' && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    onClick={handleScan}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Scan network
                  </Button>
                )}
                {scanState === 'scanning' && (
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">Scanning… (up to 30s)</Text>
                  </Group>
                )}
                {scanState === 'error' && (
                  <Alert color="red" variant="light" p="xs" radius="sm">
                    Scanner unavailable — is the scanner container running?
                  </Alert>
                )}
                {scanState === 'done' && scanResults.length === 0 && (
                  <Text size="sm" c="dimmed">No Chromecasts found on the network.</Text>
                )}
                {scanResults.length > 0 && (
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', color: 'var(--mantine-color-dimmed)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--mantine-color-dark-4)' }}>Device</th>
                        <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', color: 'var(--mantine-color-dimmed)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--mantine-color-dark-4)' }}>IP address</th>
                        <th style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {scanResults.map(d => (
                        <tr key={d.ip} style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                          <td style={{ padding: '6px 12px 6px 0', fontSize: 13 }}>{d.name}</td>
                          <td style={{ padding: '6px 12px 6px 0', fontSize: 13, fontFamily: 'monospace', color: 'var(--mantine-color-cyan-4)' }}>{d.ip}</td>
                          <td style={{ padding: '6px 0', textAlign: 'right' }}>
                            <Button size="xs" variant="subtle" color="cyan" onClick={() => pickScanResult(d.ip)}>
                              Use
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Stack>

              <Divider />
              <Button
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => handleDeleteScreen(currentScreen.id)}
                style={{ alignSelf: 'flex-start' }}
              >
                Delete screen
              </Button>
            </Stack>
          </Paper>

          {/* People on this screen */}
          <ScreenPeopleSection
            allPeople={allPeople}
            screenPeopleIds={screenPeopleIds}
            onChange={ids => onChange(setScreenPeople(draft, currentScreen.id, ids))}
          />

          {/* Clock */}
          <ClockSection
            widgets={screenWidgets}
            onChange={updateScreenWidgets}
          />

          {/* Rotators */}
          {rotators.map(w => (
            <RotatorSection
              key={w.id}
              widgetId={w.id}
              rotateConfig={w.config}
              onChange={cfg => updateScreenWidgets(screenWidgets.map(x => x.id === w.id ? { ...x, config: cfg } : x))}
            />
          ))}
        </>
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Tab: People
// ---------------------------------------------------------------------------

function PeopleTab({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const multi = isMultiScreen(draft)
  if (!multi) {
    return (
      <Paper p="md" radius="sm" withBorder>
        <Text size="sm" c="dimmed">People are only available in multi-screen format.</Text>
      </Paper>
    )
  }

  const people = getPeople(draft)

  function updatePeople(updated: Person[]) {
    onChange(setPeopleInDraft(draft, updated))
  }

  function addPerson() {
    const newPerson: Person = {
      id: uniqueId('person', people.map(p => p.id)),
      name: '',
      family: false,
      calendar_ids: [],
    }
    updatePeople([...people, newPerson])
  }

  function removePerson(idx: number) {
    updatePeople(people.filter((_, i) => i !== idx))
  }

  function updatePerson(idx: number, updates: Partial<Person>) {
    updatePeople(people.map((p, i) => i === idx ? { ...p, ...updates } : p))
  }

  function addCalendarId(idx: number) {
    updatePerson(idx, { calendar_ids: [...(people[idx].calendar_ids ?? []), ''] })
  }

  function updateCalendarId(personIdx: number, calIdx: number, value: string) {
    const ids = (people[personIdx].calendar_ids ?? []).map((id, i) => i === calIdx ? value : id)
    updatePerson(personIdx, { calendar_ids: ids })
  }

  function removeCalendarId(personIdx: number, calIdx: number) {
    const ids = (people[personIdx].calendar_ids ?? []).filter((_, i) => i !== calIdx)
    updatePerson(personIdx, { calendar_ids: ids })
  }

  return (
    <Paper p="md" radius="sm" withBorder>
      <SectionTitle>People</SectionTitle>
      <Text size="sm" c="dimmed" mb="lg">
        Assign people to screens to include their calendars. Family members appear on every screen automatically.
      </Text>

      <Stack gap="lg">
        {people.map((person, idx) => (
          <Stack key={person.id} gap="sm">
            {idx > 0 && <Divider />}
            <Group gap="md" align="flex-end" wrap="wrap">
              <TextInput
                label="Name"
                placeholder="Name"
                value={person.name}
                onChange={e => updatePerson(idx, { name: e.target.value })}
                size="sm"
                w={160}
              />
              <Checkbox
                label="Family (all screens)"
                checked={!!person.family}
                onChange={e => updatePerson(idx, { family: e.currentTarget.checked })}
                size="sm"
                mb={4}
              />
              <Button
                variant="subtle"
                color="red"
                size="xs"
                onClick={() => removePerson(idx)}
                style={{ marginLeft: 'auto' }}
                mb={4}
              >
                Remove
              </Button>
            </Group>

            <Stack gap="xs" pl="xs">
              <Text size="xs" c="dimmed" fw={500}>Google Calendar IDs</Text>
              {(person.calendar_ids ?? []).map((calId, calIdx) => (
                <Group key={calIdx} gap="xs" wrap="nowrap">
                  <TextInput
                    placeholder="xxxx@group.calendar.google.com"
                    value={calId}
                    onChange={e => updateCalendarId(idx, calIdx, e.target.value)}
                    size="sm"
                    style={{ flex: 1, minWidth: 0 }}
                    ff="monospace"
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => removeCalendarId(idx, calIdx)}
                    style={{ flexShrink: 0 }}
                  >
                    ✕
                  </ActionIcon>
                </Group>
              ))}
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => addCalendarId(idx)}
                style={{ alignSelf: 'flex-start' }}
              >
                + Add calendar
              </Button>
            </Stack>
          </Stack>
        ))}
      </Stack>

      {people.length > 0 && <Divider mt="lg" />}
      <Button
        variant="subtle"
        color="gray"
        size="sm"
        onClick={addPerson}
        mt={people.length > 0 ? 'md' : undefined}
      >
        + Add person
      </Button>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPanel
// ---------------------------------------------------------------------------

type AdminTab = 'general' | 'screens' | 'people'

function AdminPanelInner() {
  useScrollUnlock()
  const queryClient = useQueryClient()
  const { data: remoteConfig, isLoading, isError } = useAdminConfig()
  const [draft, setDraft] = useState<AdminConfig | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('general')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (remoteConfig) setDraft(deepClone(remoteConfig))
  }, [remoteConfig])

  if (isError) {
    return (
      <Box bg="dark.9" mih="100vh" p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert color="red" variant="light" radius="sm">
          Cannot reach backend — is it running?
        </Alert>
      </Box>
    )
  }

  if (isLoading || !draft) {
    return (
      <Box bg="dark.9" mih="100vh" p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Group gap="sm">
          <Loader size="sm" color="cyan" />
          <Text c="dimmed" size="sm">Loading config…</Text>
        </Group>
      </Box>
    )
  }

  function handleDraftChange(updated: AdminConfig) {
    setDraft(updated)
    setSaveState('idle')
  }

  async function handleSave() {
    if (!draft) return
    setSaveState('saving')
    setSaveError('')
    try {
      await saveAdminConfig(draft)
      setSaveState('saved')
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setSaveState('error')
    }
  }

  return (
    <Box bg="dark.9" mih="100vh" py="xl" px="md">
      <Container size="sm">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <Title order={4} c="cyan.4" style={{ letterSpacing: '0.06em', fontWeight: 600 }}>
            wall-cast admin
          </Title>
          <Anchor href="/" c="dimmed" size="sm" style={{ textDecoration: 'none' }}>
            ← display
          </Anchor>
        </Group>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={v => v && setActiveTab(v as AdminTab)} mb="lg">
          <Tabs.List mb="lg">
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="screens">Screens</Tabs.Tab>
            <Tabs.Tab value="people">People</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <GeneralTab draft={draft} onChange={handleDraftChange} />
          </Tabs.Panel>
          <Tabs.Panel value="screens">
            <ScreensTab draft={draft} onChange={handleDraftChange} />
          </Tabs.Panel>
          <Tabs.Panel value="people">
            <PeopleTab draft={draft} onChange={handleDraftChange} />
          </Tabs.Panel>
        </Tabs>

        {/* Save bar */}
        <Group gap="md" mt="xl">
          <Button
            onClick={handleSave}
            loading={saveState === 'saving'}
            size="sm"
          >
            Save
          </Button>
          {saveState === 'saved' && (
            <Text size="sm" c="green">Saved — display is updating</Text>
          )}
          {saveState === 'error' && (
            <Text size="sm" c="red">{saveError}</Text>
          )}
        </Group>
      </Container>
    </Box>
  )
}

export default function AdminPanel() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AdminPanelInner />
    </MantineProvider>
  )
}
