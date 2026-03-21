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
        <Stack gap={6}>
          <Text size="xs" c="dimmed" fw={500}>Slots</Text>
          {slots.map((slot, idx) => (
            <Checkbox
              key={idx}
              checked={slot.enabled !== false}
              onChange={() => {
                const next = slots.map((s, i) => i === idx ? { ...s, enabled: s.enabled !== false ? false : true } : s)
                onChange({ ...rotateConfig, widgets: next })
              }}
              label={<Code fz="xs">{slot.type}</Code>}
              size="sm"
            />
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
  return (
    <Paper p="md" radius="sm" withBorder mb="md">
      <SectionTitle>News feeds</SectionTitle>
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

function GarbageDaysSection({
  widgets, onChange,
}: {
  widgets: WidgetConfig[]
  onChange: (days: number) => void
}) {
  const garbageSlot = widgets
    .flatMap(w => w.type === 'rotate'
      ? (w.config.widgets as Array<{ type: string; config: Record<string, unknown> }> ?? [])
      : []
    )
    .find(s => s.type === 'garbage')

  if (!garbageSlot) return null
  const days = (garbageSlot.config.days_ahead as number) ?? 7

  return (
    <Paper p="md" radius="sm" withBorder mb="md">
      <SectionTitle>Garbage — days ahead</SectionTitle>
      <NumberInput
        label="Days"
        value={days}
        onChange={v => onChange(Number(v))}
        min={1}
        max={60}
        size="sm"
        w={100}
      />
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
        {rotators.map(w => (
          <RotatorSection
            key={w.id}
            widgetId={w.id}
            rotateConfig={w.config}
            onChange={cfg => onChange({ ...draft, widgets: widgets.map(x => x.id === w.id ? { ...x, config: cfg } : x) })}
          />
        ))}
        <GarbageDaysSection
          widgets={widgets}
          onChange={days => {
            const updated = widgets.map(w => {
              if (w.type !== 'rotate') return w
              const slots = (w.config.widgets as Array<{ type: string; config: Record<string, unknown> }> ?? [])
              if (!slots.some(s => s.type === 'garbage')) return w
              return { ...w, config: { ...w.config, widgets: slots.map(s => s.type === 'garbage' ? { ...s, config: { ...s.config, days_ahead: days } } : s) } }
            })
            onChange({ ...draft, widgets: updated })
          }}
        />
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

  function setGarbageDays(days: number) {
    const updated = screenWidgets.map(w => {
      if (w.type !== 'rotate') return w
      const slots = (w.config.widgets as Array<{ type: string; config: Record<string, unknown> }> ?? [])
      if (!slots.some(s => s.type === 'garbage')) return w
      return { ...w, config: { ...w.config, widgets: slots.map(s => s.type === 'garbage' ? { ...s, config: { ...s.config, days_ahead: days } } : s) } }
    })
    updateScreenWidgets(updated)
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

          {/* Rotators */}
          {rotators.map(w => (
            <RotatorSection
              key={w.id}
              widgetId={w.id}
              rotateConfig={w.config}
              onChange={cfg => updateScreenWidgets(screenWidgets.map(x => x.id === w.id ? { ...x, config: cfg } : x))}
            />
          ))}

          {/* Garbage */}
          <GarbageDaysSection widgets={screenWidgets} onChange={setGarbageDays} />
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
