import React, { useState, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  MantineProvider, createTheme,
  Box, Container, Stack, Group, Paper,
  Text, Code, Title,
  TextInput, NumberInput, Autocomplete, Select,
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
  GarbageConfig,
  NetworkConfig,
  P2000Config,
  AssistantConfig,
  Person,
  PersonTraffic,
  PersonBus,
  PersonRssFeed,
  ScreenSection,
  WidgetConfig,
  Rule,
} from '../types/config'
import { isMultiScreen } from '../types/config'
import { apiFetch } from '../lib/api'
import {
  useRuleVariables,
  RuleEditorModal,
  RuleList,
} from './RuleEditor'

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

function getGarbage(draft: AdminConfig): GarbageConfig {
  if (!isMultiScreen(draft)) return (draft as FlatConfig).garbage ?? {}
  return draft.shared.garbage ?? {}
}

function setGarbageInDraft(draft: AdminConfig, gc: GarbageConfig): AdminConfig {
  if (!isMultiScreen(draft)) return { ...draft, garbage: gc }
  return { ...draft, shared: { ...draft.shared, garbage: gc } }
}

function getNetwork(draft: AdminConfig): NetworkConfig {
  if (!isMultiScreen(draft)) return {}
  return draft.shared.network ?? {}
}

function setNetworkInDraft(draft: AdminConfig, nc: NetworkConfig): AdminConfig {
  if (!isMultiScreen(draft)) return draft  // only supported in multi-screen format
  return { ...draft, shared: { ...draft.shared, network: nc } }
}

function getP2000(draft: AdminConfig): P2000Config {
  if (!isMultiScreen(draft)) return (draft as FlatConfig).p2000 ?? {}
  return draft.shared.p2000 ?? {}
}

function setP2000InDraft(draft: AdminConfig, cfg: P2000Config): AdminConfig {
  if (!isMultiScreen(draft)) return { ...draft, p2000: cfg }
  return { ...draft, shared: { ...draft.shared, p2000: cfg } }
}

function getAssistant(draft: AdminConfig): AssistantConfig {
  if (!isMultiScreen(draft)) return {}
  return draft.shared.assistant ?? {}
}

function setAssistantInDraft(draft: AdminConfig, ac: AssistantConfig): AdminConfig {
  if (!isMultiScreen(draft)) return draft
  return { ...draft, shared: { ...draft.shared, assistant: ac } }
}

function getFadeSpeed(draft: AdminConfig): number {
  if (!isMultiScreen(draft)) return 0.8
  return (draft.shared.fade_speed ?? 0.8) as number
}

function setFadeSpeedInDraft(draft: AdminConfig, speed: number): AdminConfig {
  if (!isMultiScreen(draft)) return draft
  return { ...draft, shared: { ...draft.shared, fade_speed: speed } }
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
        id: 'clock',
        type: 'clock',
        col: 1, row: 1, col_span: 4, row_span: 3,
        config: { show_seconds: true, show_date: true },
      },
      {
        id: 'main-rotator',
        type: 'rotate',
        col: 5, row: 1, col_span: 8, row_span: 7,
        config: {
          interval_sec: 20,
          widgets: [
            { type: 'weather',    config: { show_hourly: true, show_daily: true } },
            { type: 'calendar',   config: { calendar_ids: [] } },
            { type: 'traffic',    config: { home_address: '', work_address: '', route_roads: '' } },
            { type: 'warnings',   config: {} },
            { type: 'airquality', config: {} },
          ],
        },
      },
      {
        id: 'bottom-rotator',
        type: 'rotate',
        col: 1, row: 4, col_span: 4, row_span: 4,
        config: {
          interval_sec: 20,
          widgets: [
            { type: 'rain', config: {} },
            { type: 'garbage', config: { days_ahead: 31, postcode: '', huisnummer: '' } },
            { type: 'polestar', config: {} },
            { type: 'bus', config: { stop_city: '', stop_name: '' } },
            { type: 'network', config: {} },
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
      <Text size="xs" c="dimmed" pl="xl" pt={4}>
        Configured per person in the <Text span fw={600} c="cyan">People</Text> tab.
      </Text>
    )
  }

  if (slot.type === 'bus') {
    return (
      <Text size="xs" c="dimmed" pl="xl" pt={4}>
        Configured per person in the <Text span fw={600} c="cyan">People</Text> tab.
      </Text>
    )
  }

  if (slot.type === 'warnings') {
    const NL_PROVINCES = [
      { value: 'all',           label: 'All (nationwide)' },
      { value: 'Drenthe',       label: 'Drenthe' },
      { value: 'Flevoland',     label: 'Flevoland' },
      { value: 'Friesland',     label: 'Friesland' },
      { value: 'Gelderland',    label: 'Gelderland' },
      { value: 'Groningen',     label: 'Groningen' },
      { value: 'Limburg',       label: 'Limburg' },
      { value: 'Noord-Brabant', label: 'Noord-Brabant' },
      { value: 'Noord-Holland', label: 'Noord-Holland' },
      { value: 'Overijssel',    label: 'Overijssel' },
      { value: 'Utrecht',       label: 'Utrecht' },
      { value: 'Zeeland',       label: 'Zeeland' },
      { value: 'Zuid-Holland',  label: 'Zuid-Holland' },
    ]
    return (
      <Group gap="md" pl="xl" pt={4}>
        <Select
          label="Show warnings for"
          data={NL_PROVINCES}
          value={(cfg.region as string | undefined) ?? 'all'}
          onChange={v => onChange({ ...slot, config: { ...cfg, region: v ?? 'all' } })}
          size="xs"
          w={200}
        />
      </Group>
    )
  }

  if (slot.type === 'garbage') {
    return (
      <Group gap="sm" pl="xl" pt={4} wrap="wrap" align="flex-start">
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

  if (slot.type === 'info') {
    const title = (cfg.title as string) ?? ''
    const items = (cfg.items as { label: string; value: string }[]) ?? []
    return (
      <Stack gap="xs" pl="xl" pt={4}>
        <TextInput
          label="Title (optional)"
          placeholder="e.g. Household"
          value={title}
          onChange={e => onChange({ ...slot, config: { ...cfg, title: e.target.value } })}
          size="xs"
          w={220}
        />
        <Text size="xs" c="dimmed" fw={500}>Items</Text>
        {items.map((item, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              placeholder="Label"
              value={item.label}
              onChange={e => {
                const next = items.map((x, j) => j === i ? { ...x, label: e.target.value } : x)
                onChange({ ...slot, config: { ...cfg, items: next } })
              }}
              size="xs"
              style={{ flex: 1, minWidth: 0 }}
            />
            <TextInput
              placeholder="Value"
              value={item.value}
              onChange={e => {
                const next = items.map((x, j) => j === i ? { ...x, value: e.target.value } : x)
                onChange({ ...slot, config: { ...cfg, items: next } })
              }}
              size="xs"
              style={{ flex: 1, minWidth: 0 }}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => onChange({ ...slot, config: { ...cfg, items: items.filter((_, j) => j !== i) } })}
              style={{ flexShrink: 0, marginBottom: 1 }}
            >
              ✕
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          onClick={() => onChange({ ...slot, config: { ...cfg, items: [...items, { label: '', value: '' }] } })}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add item
        </Button>
      </Stack>
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

function SortableSlotRow({
  slot, slots, rotateConfig, onChange,
}: {
  slot: RotateSlot
  slots: RotateSlot[]
  rotateConfig: Record<string, unknown>
  onChange: (cfg: Record<string, unknown>) => void
}) {
  const idx = slots.indexOf(slot)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.type })

  return (
    <Stack
      ref={setNodeRef}
      gap={6}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <Group gap="xs" align="center">
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', color: 'var(--mantine-color-dimmed)', display: 'flex', alignItems: 'center', padding: '0 2px', touchAction: 'none' }}
          title="Drag to reorder"
        >
          ⠿
        </div>
        <Checkbox
          checked={slot.enabled !== false}
          onChange={() => {
            const next = slots.map((s, i) => i === idx ? { ...s, enabled: s.enabled !== false ? false : true } : s)
            onChange({ ...rotateConfig, widgets: next })
          }}
          label={<Code fz="xs">{slot.type}</Code>}
          size="sm"
        />
        <ActionIcon
          variant="subtle"
          color="red"
          size="xs"
          title="Remove slot"
          onClick={() => {
            const next = slots.filter((_, i) => i !== idx)
            onChange({ ...rotateConfig, widgets: next })
          }}
        >
          ✕
        </ActionIcon>
      </Group>
      <SlotConfig
        slot={slot}
        onChange={updated => {
          const next = slots.map((s, i) => i === idx ? updated : s)
          onChange({ ...rotateConfig, widgets: next })
        }}
      />
    </Stack>
  )
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
  const [addType, setAddType] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = slots.findIndex(s => s.type === active.id)
      const newIndex = slots.findIndex(s => s.type === over.id)
      onChange({ ...rotateConfig, widgets: arrayMove(slots, oldIndex, newIndex) })
    }
  }

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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={slots.map(s => s.type)} strategy={verticalListSortingStrategy}>
              {slots.map(slot => (
                <SortableSlotRow
                  key={slot.type}
                  slot={slot}
                  slots={slots}
                  rotateConfig={rotateConfig}
                  onChange={onChange}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Divider />
          <Group gap="xs" align="flex-end">
            <Select
              label="Add slot"
              placeholder="Pick widget type…"
              data={ROTATOR_SLOT_TYPES.filter(t => !slots.some(s => s.type === t.value))}
              value={addType}
              onChange={setAddType}
              size="xs"
              w={160}
              clearable
            />
            <Button
              size="xs"
              variant="light"
              disabled={!addType}
              onClick={() => {
                if (!addType) return
                const next = [...slots, { type: addType, config: defaultSlotConfig(addType), enabled: true }]
                onChange({ ...rotateConfig, widgets: next })
                setAddType(null)
              }}
            >
              + Add
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Paper>
  )
}

const ROTATOR_SLOT_TYPES: { value: string; label: string }[] = [
  { value: 'weather',  label: 'Weather' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'traffic',  label: 'Traffic' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'rain',     label: 'Rain' },
  { value: 'garbage',  label: 'Garbage' },
  { value: 'polestar', label: 'Polestar' },
  { value: 'bus',      label: 'Bus' },
  { value: 'network',    label: 'Network' },
  { value: 'airquality', label: 'Air Quality' },
  { value: 'market',     label: 'Market' },
  { value: 'p2000',      label: 'P2000' },
  { value: 'info',       label: 'Info' },
]

function defaultSlotConfig(type: string): Record<string, unknown> {
  if (type === 'garbage')  return { days_ahead: 31, postcode: '', huisnummer: '' }
  if (type === 'traffic')  return { home_address: '', work_address: '', route_roads: '' }
  if (type === 'bus')      return { stop_city: '', stop_name: '' }
  if (type === 'weather')  return { show_hourly: true, show_daily: true }
  if (type === 'calendar') return { calendar_ids: [] }
  if (type === 'info')     return { title: '', items: [] }
  if (type === 'warnings') return { region: 'all' }
  return {}
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
// AddressInput — TextInput with debounced TomTom address autocomplete
// ---------------------------------------------------------------------------

function AddressInput({
  label, placeholder, value, onChange, size = 'sm', description,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  size?: string
  description?: string
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(val: string) {
    onChange(val)
    if (timer.current) clearTimeout(timer.current)
    if (val.trim().length < 4) { setSuggestions([]); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/address-search?q=${encodeURIComponent(val.trim())}`)
        if (res.ok) setSuggestions((await res.json()).results ?? [])
      } catch { /* ignore */ }
    }, 350)
  }

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      description={description}
      value={value}
      onChange={handleChange}
      data={suggestions}
      size={size as 'sm' | 'xs'}
      comboboxProps={{ withinPortal: false }}
    />
  )
}

// ---------------------------------------------------------------------------
// GarbageSection
// ---------------------------------------------------------------------------

function GarbageSection({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const gc = getGarbage(draft)

  return (
    <Paper p="md" radius="sm" withBorder>
      <SectionTitle>Garbage collection</SectionTitle>
      <Text size="sm" c="dimmed" mb="md">
        Dutch address for mijnafvalwijzer.nl — used by the garbage widget on all screens.
      </Text>
      <Group gap="sm" wrap="wrap" align="flex-start">
        <TextInput
          label="Postcode"
          placeholder="1234AB"
          value={gc.postcode ?? ''}
          onChange={e => onChange(setGarbageInDraft(draft, { ...gc, postcode: e.target.value }))}
          size="sm"
          w={110}
        />
        <TextInput
          label="House number"
          placeholder="1"
          value={gc.huisnummer ?? ''}
          onChange={e => onChange(setGarbageInDraft(draft, { ...gc, huisnummer: e.target.value }))}
          size="sm"
          w={110}
        />
      </Group>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// NetworkSection
// ---------------------------------------------------------------------------

function NetworkSection({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const nc = getNetwork(draft)

  return (
    <Paper p="md" radius="sm" withBorder>
      <SectionTitle>Network widget</SectionTitle>
      <Text size="sm" c="dimmed" mb="md">
        Optional Zyxel router integration — enables WAN status and host counts.
        Without it the widget still shows connectivity, DNS, and speed.
      </Text>
      <Stack gap="sm">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            label="Router URL"
            placeholder="https://192.168.1.1"
            value={nc.router_url ?? ''}
            onChange={e => onChange(setNetworkInDraft(draft, { ...nc, router_url: e.target.value || undefined }))}
            size="sm"
            w={210}
          />
          <TextInput
            label="Router username"
            placeholder="admin"
            value={nc.router_username ?? ''}
            onChange={e => onChange(setNetworkInDraft(draft, { ...nc, router_username: e.target.value || undefined }))}
            size="sm"
            w={150}
          />
        </Group>
        <Group gap="xs" align="center">
          <TextInput
            label="Router password"
            value="••••••••"
            readOnly
            disabled
            size="sm"
            w={150}
          />
          <Text size="xs" c="dimmed" mt={22}>
            Set <Code fz="xs">ROUTER_PASSWORD=…</Code> in your <Code fz="xs">.env</Code> file — never stored in the config YAML.
          </Text>
        </Group>
      </Stack>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// P2000Section
// ---------------------------------------------------------------------------

function P2000Section({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const multi = isMultiScreen(draft)
  const p2000Cfg = getP2000(draft)
  const widgets = multi ? (draft.shared.widgets ?? []) : (draft.widgets ?? [])
  const newsWidget = widgets.find(w => w.type === 'news')
  const tickerEnabled = !!(newsWidget?.config?.p2000_ticker)
  const widgetEnabled = p2000Cfg.widget_enabled !== false
  const locationName = getLocation(draft)?.name

  function setTickerEnabled(val: boolean) {
    const updated = widgets.map(w =>
      w.type === 'news' ? { ...w, config: { ...w.config, p2000_ticker: val } } : w
    )
    if (multi) onChange({ ...draft, shared: { ...draft.shared, widgets: updated } })
    else onChange({ ...draft, widgets: updated })
  }

  function setWidgetEnabled(val: boolean) {
    onChange(setP2000InDraft(draft, { ...p2000Cfg, widget_enabled: val }))
  }

  return (
    <Paper p="md" radius="sm" withBorder>
      <SectionTitle>P2000 Emergency Alerts</SectionTitle>
      <Text size="sm" c="dimmed" mb="md">
        Show Dutch emergency services dispatch alerts (fire, ambulance A1, police P1) scoped
        to your location{locationName ? <> — <strong>{locationName}</strong></> : null}.
      </Text>
      <Stack gap="xs">
        <Checkbox
          label="Show in news ticker"
          checked={tickerEnabled}
          onChange={e => setTickerEnabled(e.currentTarget.checked)}
          disabled={!newsWidget}
        />
        <Checkbox
          label="Show in P2000 Alert Service widget"
          checked={widgetEnabled}
          onChange={e => setWidgetEnabled(e.currentTarget.checked)}
        />
      </Stack>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// FadeSpeedSection
// ---------------------------------------------------------------------------

const FADE_STEPS = [
  { value: '2.0',  label: 'Slow' },
  { value: '1.4',  label: 'Relaxed' },
  { value: '0.8',  label: 'Normal' },
  { value: '0.4',  label: 'Snappy' },
  { value: '0.15', label: 'Fast' },
]

function nearestFadeStep(speed: number): string {
  let best = FADE_STEPS[0].value
  let bestDist = Infinity
  for (const step of FADE_STEPS) {
    const dist = Math.abs(parseFloat(step.value) - speed)
    if (dist < bestDist) { bestDist = dist; best = step.value }
  }
  return best
}

function FadeSpeedSection({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const speed = getFadeSpeed(draft)
  const value = nearestFadeStep(speed)

  return (
    <Paper p="md" radius="sm" withBorder>
      <SectionTitle>Rotator fade speed</SectionTitle>
      <Text size="sm" c="dimmed" mb="md">
        How fast widgets cross-fade when the rotator switches slots.
      </Text>
      <SegmentedControl
        value={value}
        onChange={val => onChange(setFadeSpeedInDraft(draft, parseFloat(val)))}
        data={FADE_STEPS}
        size="sm"
      />
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
    if (!window.isSecureContext) {
      setGeoError('Geolocation requires HTTPS. Open the admin panel via https:// or find your coordinates at latlong.net.')
      setGeoState('error')
      return
    }
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
            fixedDecimalScale
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
            fixedDecimalScale
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
            {geoError || 'Could not determine location.'}{' '}
            {!window.isSecureContext && (
              <Anchor href="https://www.latlong.net" target="_blank" size="sm">
                Find coordinates →
              </Anchor>
            )}
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// Tab: Assistant
// ---------------------------------------------------------------------------

function AssistantTab({
  draft, onChange,
}: {
  draft: AdminConfig
  onChange: (d: AdminConfig) => void
}) {
  const ac        = getAssistant(draft)
  const notify    = ac.notify  ?? {}
  const ai        = ac.ai      ?? {}
  const rules     = Array.isArray(ac.rules) ? ac.rules : []
  const variables = useRuleVariables()

  const [ruleModal,      setRuleModal]      = useState(false)
  const [editingRule,    setEditingRule]    = useState<Rule | undefined>()
  const [editingRuleIdx, setEditingRuleIdx] = useState(-1)
  const [testSending,    setTestSending]    = useState(false)
  const [testResult,     setTestResult]     = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleSendTest() {
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/notify/test', { method: 'POST' })
      if (res.ok) {
        setTestResult({ ok: true, msg: 'Test message sent successfully.' })
      } else {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        setTestResult({ ok: false, msg: err.detail ?? 'Failed to send.' })
      }
    } catch {
      setTestResult({ ok: false, msg: 'Network error.' })
    } finally {
      setTestSending(false)
    }
  }

  function update(patch: Partial<AssistantConfig>) {
    onChange(setAssistantInDraft(draft, { ...ac, ...patch }))
  }

  function openAddRule() {
    setEditingRule(undefined); setEditingRuleIdx(-1); setRuleModal(true)
  }
  function openEditRule(rule: Rule, idx: number) {
    setEditingRule(rule); setEditingRuleIdx(idx); setRuleModal(true)
  }
  function saveRule(rule: Rule) {
    const updated = editingRuleIdx >= 0
      ? rules.map((r, i) => i === editingRuleIdx ? rule : r)
      : [...rules, rule]
    update({ rules: updated })
    setRuleModal(false)
  }

  return (
    <Stack gap="md">
      {/* Enable / interval */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Assistant</SectionTitle>
        <Text size="sm" c="dimmed" mb="md">
          Proactive notifications — sends alerts when your bin needs to go out,
          your bus is late, or your commute has delays.
        </Text>
        <Stack gap="sm">
          <Checkbox
            label="Enable assistant"
            checked={ac.enabled ?? false}
            onChange={e => update({ enabled: e.currentTarget.checked })}
            size="sm"
          />
          <NumberInput
            label="Check interval (seconds)"
            description="How often to poll for new alerts"
            value={ac.check_interval ?? 300}
            onChange={v => update({ check_interval: Number(v) })}
            min={60}
            max={3600}
            step={60}
            size="sm"
            w={200}
            disabled={!ac.enabled}
          />
        </Stack>
      </Paper>

      {/* Notifications */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Notifications</SectionTitle>
        <Text size="sm" c="dimmed" mb="md">
          Enable one or more channels. Each person can have a personal ntfy topic and/or
          Matrix room configured in the People tab — alerts are delivered to all active channels.
        </Text>

        {/* ntfy */}
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.07em' }}>ntfy</Text>
        <Stack gap="xs" mb="md">
          <Checkbox
            label="Enable ntfy"
            checked={notify.ntfy?.enabled ?? false}
            onChange={e => update({ notify: { ...notify, ntfy: { ...notify.ntfy, enabled: e.currentTarget.checked } } })}
            size="sm"
          />
          <TextInput
            label="ntfy server URL"
            placeholder="https://ntfy.example.com"
            value={notify.ntfy?.url ?? ''}
            onChange={e => update({ notify: { ...notify, ntfy: { ...notify.ntfy, url: e.target.value || undefined } } })}
            size="sm"
            style={{ maxWidth: 340 }}
            disabled={!notify.ntfy?.enabled}
          />
          <Text size="xs" c="dimmed">
            Personal topics are configured per-person in the People tab.
          </Text>
        </Stack>

        {/* Matrix */}
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.07em' }}>Matrix</Text>
        <Stack gap="xs">
          <Checkbox
            label="Enable Matrix"
            checked={notify.matrix?.enabled ?? false}
            onChange={e => update({ notify: { ...notify, matrix: { ...notify.matrix, enabled: e.currentTarget.checked } } })}
            size="sm"
          />
          <Group gap="sm" wrap="wrap" align="flex-start">
            <TextInput
              label="Homeserver URL"
              placeholder="https://matrix.example.com"
              value={notify.matrix?.homeserver ?? ''}
              onChange={e => update({ notify: { ...notify, matrix: { ...notify.matrix, homeserver: e.target.value || undefined } } })}
              size="sm"
              style={{ flex: 1, minWidth: 220 }}
              disabled={!notify.matrix?.enabled}
            />
            <TextInput
              label="System room ID"
              placeholder="!roomid:matrix.example.com"
              value={notify.matrix?.room_id ?? ''}
              onChange={e => update({ notify: { ...notify, matrix: { ...notify.matrix, room_id: e.target.value || undefined } } })}
              size="sm"
              style={{ flex: 1, minWidth: 220 }}
              disabled={!notify.matrix?.enabled}
            />
          </Group>
          <Group gap="xs" align="center">
            <TextInput
              label="Access token"
              value="••••••••"
              readOnly
              disabled
              size="sm"
              w={120}
            />
            <Text size="xs" c="dimmed" mt={22}>
              Set <Code fz="xs">MATRIX_TOKEN=…</Code> in <Code fz="xs">.env</Code> — never stored in YAML
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Per-person room IDs can be set in the People tab to route personal alerts directly.
          </Text>
        </Stack>
      </Paper>

      {/* AI */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>AI formatting (optional)</SectionTitle>
        <Text size="sm" c="dimmed" mb="md">
          Rewrites template notifications into natural language. Rules always fire
          deterministically — AI only changes the wording. Falls back to templates
          if unavailable.
        </Text>
        <Stack gap="sm">
          <Select
            label="Provider"
            data={[
              { value: 'none',   label: 'None (template messages)' },
              { value: 'ollama', label: 'Ollama (self-hosted)' },
              { value: 'openai', label: 'OpenAI' },
            ]}
            value={ai.provider ?? 'none'}
            onChange={v => update({ ai: { ...ai, provider: (v as 'none' | 'ollama' | 'openai') ?? 'none' } })}
            size="sm"
            w={240}
          />
          {ai.provider === 'ollama' && (
            <Group gap="sm" wrap="wrap">
              <TextInput
                label="Ollama URL"
                placeholder="http://host.docker.internal:11434"
                value={ai.ollama_url ?? ''}
                onChange={e => update({ ai: { ...ai, ollama_url: e.target.value || undefined } })}
                size="sm"
                style={{ flex: 1, minWidth: 220 }}
              />
              <TextInput
                label="Model"
                placeholder="llama3.2:3b"
                value={ai.ollama_model ?? ''}
                onChange={e => update({ ai: { ...ai, ollama_model: e.target.value || undefined } })}
                size="sm"
                w={160}
              />
            </Group>
          )}
          {ai.provider === 'openai' && (
            <Group gap="sm" wrap="wrap" align="flex-end">
              <TextInput
                label="Model"
                placeholder="gpt-4o-mini"
                value={ai.openai_model ?? ''}
                onChange={e => update({ ai: { ...ai, openai_model: e.target.value || undefined } })}
                size="sm"
                w={180}
              />
              <Group gap="xs" align="center">
                <TextInput
                  label="API key"
                  value="••••••••"
                  readOnly
                  disabled
                  size="sm"
                  w={120}
                />
                <Text size="xs" c="dimmed" mt={22}>
                  Set <Code fz="xs">OPENAI_API_KEY=…</Code> in <Code fz="xs">.env</Code>
                </Text>
              </Group>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Rules */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Rules</SectionTitle>
        <Text size="sm" c="dimmed" mb="sm">
          Rules determine when the assistant sends a message. Each rule checks a live
          value and fires a notification when the condition is met.{' '}
          These are family rules — sent to all registered people.
        </Text>
        <RuleList
          rules={rules}
          onChangeRules={r => update({ rules: r })}
          variables={variables}
          onAddRule={openAddRule}
          onEditRule={openEditRule}
        />
      </Paper>

      {/* Test */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Test</SectionTitle>
        <Text size="sm" c="dimmed" mb="sm">
          Send a test message on all enabled channels to verify your notification setup.
        </Text>
        <Group gap="sm" align="center">
          <Button
            variant="subtle"
            color="cyan"
            size="sm"
            onClick={handleSendTest}
            loading={testSending}
            disabled={!notify.ntfy?.enabled && !notify.matrix?.enabled}
          >
            Send test message
          </Button>
          {testResult && (
            <Text size="sm" c={testResult.ok ? 'teal' : 'red'} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {testResult.ok ? '✅' : '❌'} {testResult.msg}
            </Text>
          )}
        </Group>
      </Paper>

      <RuleEditorModal
        opened={ruleModal}
        onClose={() => setRuleModal(false)}
        onSave={saveRule}
        initial={editingRule}
        variables={variables}
      />
    </Stack>
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
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>Display language</SectionTitle>
        <SegmentedControl
          value={lang}
          onChange={val => onChange(setLanguageInDraft(draft, val))}
          data={(Object.entries(LANGUAGE_LABELS) as [Lang, string][]).map(([code, label]) => ({ value: code, label }))}
          size="sm"
        />
      </Paper>

      <LocationSection draft={draft} onChange={onChange} />

      <FadeSpeedSection draft={draft} onChange={onChange} />

      {newsWidget && (
        <NewsSection newsConfig={newsWidget.config} onChange={updateNewsConfig} />
      )}

      <GarbageSection draft={draft} onChange={onChange} />
      <NetworkSection draft={draft} onChange={onChange} />
      <P2000Section draft={draft} onChange={onChange} />
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

// ---------------------------------------------------------------------------
// Screen diagnostics box
// ---------------------------------------------------------------------------

interface ScreenStatus {
  status: 'casting' | 'cooldown' | 'starting' | 'scanning' | 'unreachable' | 'cast_failed' | 'sleeping' | 'unknown'
  ip: string
  last_cast_at: number
}

interface ScreensStatusData {
  updated_at: number | null
  screens: Record<string, ScreenStatus>
}

interface LogRecord {
  ts: string
  level: string
  name: string
  msg: string
}

const STATUS_COLOR: Record<string, string> = {
  casting:     'green',
  cooldown:    'teal',
  starting:    'blue',
  scanning:    'yellow',
  unreachable: 'red',
  cast_failed: 'orange',
  sleeping:    'gray',
  unknown:     'gray',
}

const STATUS_LABEL: Record<string, string> = {
  casting:     'Casting',
  cooldown:    'Casting (cooldown)',
  starting:    'Starting…',
  scanning:    'Scanning for device…',
  unreachable: 'Unreachable',
  cast_failed: 'Cast failed — retrying',
  sleeping:    'Sleeping',
  unknown:     'Unknown',
}

type PairingSession = { state: 'starting' | 'waiting_pin' | 'success' | 'failed'; error?: string } | null
type PairingStatus = { paired: boolean; session: PairingSession }

function ScreenDiagnosticsBox({
  screenId,
  screensStatus,
  logsData,
  draftIp,
}: {
  screenId: string
  screensStatus: ScreensStatusData | undefined
  logsData: { records: LogRecord[] } | undefined
  draftIp?: string
}) {
  const [recasting, setRecasting] = useState(false)
  const [recastDone, setRecastDone] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const [localStarting, setLocalStarting] = useState(false)
  const queryClient = useQueryClient()


  const { data: pairingStatus } = useQuery<PairingStatus>({
    queryKey: ['pairing-status', screenId],
    queryFn: () => apiFetch<PairingStatus>(`/api/admin/pairing/${screenId}`),
    refetchInterval: (query) => {
      const state = query.state.data?.session?.state
      return state === 'starting' || state === 'waiting_pin' ? 2_000 : 15_000
    },
    staleTime: 1_500,
  })

  const pairingState = pairingStatus?.session?.state ?? null
  const isPaired     = pairingStatus?.paired ?? false
  const canPair      = !!draftIp

  // Clear localStarting once the server session is visible
  useEffect(() => {
    if (pairingState !== null) setLocalStarting(false)
  }, [pairingState])

  async function handleStartPairing() {
    if (!draftIp) return
    setLocalStarting(true)
    setPinInput('')
    await fetch('/api/admin/pairing/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen_id: screenId, ip: draftIp }),
    })
    queryClient.invalidateQueries({ queryKey: ['pairing-status', screenId] })
  }

  async function handleSubmitPin() {
    if (!pinInput.trim()) return
    setPinSubmitting(true)
    try {
      await fetch('/api/admin/pairing/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_id: screenId, pin: pinInput.trim() }),
      })
      setPinInput('')
    } finally {
      setPinSubmitting(false)
    }
  }

  const screenStatus = screensStatus?.screens?.[screenId]
  const updatedAgo   = screensStatus?.updated_at
    ? Math.round(Date.now() / 1000 - screensStatus.updated_at)
    : null

  const filteredLogs = ((logsData?.records ?? []) as LogRecord[])
    .filter(r => r.msg.includes(screenId) || r.name.includes(screenId))
    .slice()
    .reverse()

  async function handleRecast() {
    setRecasting(true)
    setRecastDone(false)
    try {
      await fetch('/api/admin/casting/recast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_id: screenId }),
      })
      setRecastDone(true)
      setTimeout(() => setRecastDone(false), 4000)
      // Poll more aggressively after a recast so status updates quickly
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['screens-status'] }), 5000)
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['screens-status'] }), 12000)
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['screens-status'] }), 20000)
    } finally {
      setRecasting(false)
    }
  }

  const statusKey   = screenStatus?.status ?? 'unknown'
  const statusColor = STATUS_COLOR[statusKey] ?? 'gray'
  const statusLabel = STATUS_LABEL[statusKey] ?? statusKey

  // Pairing status text for the inline row
  const pairingStatusText = (() => {
    if (localStarting || pairingState === 'starting') return { label: 'Pairing started…', color: 'dimmed' }
    if (pairingState === 'waiting_pin') return { label: 'Waiting for PIN', color: 'cyan' }
    if (pairingState === 'success') return { label: 'Paired successfully', color: 'green' }
    if (pairingState === 'failed') return { label: pairingStatus?.session?.error ?? 'Pairing failed', color: 'red' }
    if (isPaired) return { label: 'Paired', color: 'green' }
    return { label: 'Not paired', color: 'dimmed' }
  })()

  // IP to display — prefer draftIp with an "updated" hint if it differs from the server-reported IP
  const displayIp    = draftIp ?? screenStatus?.ip ?? null
  const ipIsUpdated  = !!draftIp && draftIp !== screenStatus?.ip

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">

        {/* Header */}
        <Group justify="space-between" align="center">
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.1em' }}>
            Diagnostics
          </Text>
          {updatedAgo !== null && (
            <Text size="xs" c="dimmed">updated {updatedAgo}s ago</Text>
          )}
        </Group>

        <Text size="xs" c="dimmed">Live caster status for this screen.</Text>

        <div style={{ borderTop: '1px solid var(--mantine-color-dark-5)', margin: '2px 0' }} />

        {/* Status row */}
        <Group gap="xs" align="center">
          <Text size="sm" c="dimmed" style={{ minWidth: 90 }}>Status</Text>
          {screenStatus ? (
            <Group gap="xs" align="center">
              <span style={{
                display: 'inline-block',
                width: 8, height: 8,
                borderRadius: '50%',
                background: `var(--mantine-color-${statusColor}-5)`,
                flexShrink: 0,
              }} />
              <Text size="sm">{statusLabel}</Text>
              {screenStatus.last_cast_at > 0 && (
                <Text size="xs" c="dimmed">
                  (last cast {Math.round(Date.now() / 1000 - screenStatus.last_cast_at)}s ago)
                </Text>
              )}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              {screensStatus ? 'Not active' : 'Caster not running'}
            </Text>
          )}
        </Group>

        {/* IP row */}
        <Group gap="xs" align="center">
          <Text size="sm" c="dimmed" style={{ minWidth: 90 }}>IP</Text>
          {displayIp ? (
            <Group gap={4} align="center">
              <Code fz="xs">{displayIp}</Code>
              {ipIsUpdated && <Text size="xs" c="yellow">updated</Text>}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
        </Group>

        {/* Remote control row */}
        <Group gap="xs" align="center">
          <Text size="sm" c="dimmed" style={{ minWidth: 90 }}>Remote control</Text>
          <Text size="sm" c={pairingStatusText.color as any}>{pairingStatusText.label}</Text>
        </Group>

        <div style={{ borderTop: '1px solid var(--mantine-color-dark-5)', margin: '2px 0' }} />

        {/* Action buttons */}
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            color={recastDone ? 'green' : 'blue'}
            loading={recasting}
            onClick={handleRecast}
          >
            {recastDone ? 'Signal sent' : 'Re-cast now'}
          </Button>
          {pairingState !== 'waiting_pin' && (
            <Button
              size="xs"
              variant="light"
              color={isPaired ? 'gray' : 'cyan'}
              disabled={!canPair || pairingState === 'starting' || localStarting}
              loading={localStarting || pairingState === 'starting'}
              title={!canPair ? 'Set a Chromecast IP first' : undefined}
              onClick={handleStartPairing}
            >
              {isPaired ? 'Re-pair' : 'Pair now'}
            </Button>
          )}
        </Group>

        {/* PIN input — shown when device is waiting for the PIN */}
        {pairingState === 'waiting_pin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text size="xs" c="dimmed">PIN shown on TV:</Text>
            <TextInput
              size="xs"
              placeholder="e.g. 123456"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmitPin()}
              w={130}
              ff="monospace"
              autoFocus
            />
            <Button
              size="xs"
              variant="filled"
              color="cyan"
              loading={pinSubmitting}
              disabled={!pinInput.trim()}
              onClick={handleSubmitPin}
            >
              Confirm
            </Button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--mantine-color-dark-5)', margin: '2px 0' }} />

        {/* Log buffer */}
        <div style={{
          background:   'var(--mantine-color-dark-8)',
          border:       '1px solid var(--mantine-color-dark-5)',
          borderRadius: 6,
          padding:      '0.5rem 0.65rem',
          minHeight:    48,
          maxHeight:    160,
          overflowY:    'auto',
        }}>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.1em', marginBottom: 4 }}>
            Recent warnings / errors
          </Text>
          {filteredLogs.length === 0 ? (
            <Text size="xs" c="dimmed" style={{ opacity: 0.5 }}>No warnings or errors for this screen.</Text>
          ) : (
            filteredLogs.map((r, i) => (
              <div key={i} style={{
                display:      'flex',
                gap:          '0.4rem',
                fontSize:     11,
                lineHeight:   1.5,
                color:        r.level === 'ERROR'
                  ? 'var(--mantine-color-red-4)'
                  : 'var(--mantine-color-yellow-4)',
                fontFamily:   'monospace',
                borderBottom: i < filteredLogs.length - 1
                  ? '1px solid var(--mantine-color-dark-6)'
                  : 'none',
                padding:      '1px 0',
              }}>
                <span style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}>{r.ts}</span>
                <span style={{ flexShrink: 0, fontWeight: 700 }}>{r.level}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.msg}</span>
              </div>
            ))
          )}
        </div>

      </Stack>
    </Paper>
  )
}

// ---------------------------------------------------------------------------
// Tab: Screens
// ---------------------------------------------------------------------------

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

  const { data: screensStatus } = useQuery<ScreensStatusData>({
    queryKey: ['screens-status'],
    queryFn: () => apiFetch<ScreensStatusData>('/api/admin/screens/status'),
    refetchInterval: 10_000,
    staleTime: 9_000,
  })

  const { data: logsData } = useQuery<{ records: LogRecord[] }>({
    queryKey: ['admin-logs'],
    queryFn: () => apiFetch<{ records: LogRecord[] }>('/api/admin/logs'),
    refetchInterval: 5_000,
    staleTime: 4_000,
  })

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

  function pickScanResult(ip: string, name: string) {
    if (!currentScreen) return
    onChange({
      ...multiDraft,
      screens: multiDraft.screens.map(s =>
        s.id === currentScreen.id ? { ...s, chromecast_ip: ip, chromecast_name: name } : s
      ),
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

  const currentScreen = selectedId !== null ? multiDraft.screens.find(s => s.id === selectedId) ?? null : null
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
          {multiDraft.screens.map(s => {
            const isDisabled = s.enabled === false
            return (
              <Button
                key={s.id}
                size="sm"
                variant={selectedId === s.id ? 'filled' : 'subtle'}
                color={selectedId === s.id ? (isDisabled ? 'gray' : 'cyan') : 'gray'}
                onClick={() => selectScreen(s.id)}
                style={{ opacity: isDisabled ? 0.45 : 1 }}
              >
                {s.name || s.id}
              </Button>
            )
          })}
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
                  error={currentScreen.id === '' ? 'ID cannot be empty' : undefined}
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
                <Group gap="md" align="flex-end">
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
                  <TextInput
                    label="Chromecast name"
                    description="Device name for IP auto-recovery"
                    placeholder="Living Room TV"
                    value={(currentScreen as any).chromecast_name ?? ''}
                    onChange={e => onChange({
                      ...multiDraft,
                      screens: multiDraft.screens.map(s => s.id === currentScreen.id ? { ...s, chromecast_name: e.target.value } : s),
                    })}
                    size="sm"
                    w={220}
                  />
                </Group>
                {scanState !== 'scanning' && (
                  <Button
                    variant="light"
                    color="blue"
                    size="sm"
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
                            <Button size="xs" variant="light" color="cyan" onClick={() => pickScanResult(d.ip, d.name)}>
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
              <Group gap="sm">
                <Button
                  variant="light"
                  color={currentScreen.enabled === false ? 'green' : 'orange'}
                  size="sm"
                  onClick={() => {
                    const screens = multiDraft.screens.map(s =>
                      s.id === currentScreen.id
                        ? { ...s, enabled: s.enabled === false ? true : false }
                        : s
                    )
                    onChange({ ...multiDraft, screens })
                  }}
                >
                  {currentScreen.enabled === false ? 'Enable screen' : 'Disable screen'}
                </Button>
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={() => handleDeleteScreen(currentScreen.id)}
                >
                  Delete screen
                </Button>
              </Group>
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

          {/* Diagnostics */}
          <ScreenDiagnosticsBox
            screenId={currentScreen.id}
            screensStatus={screensStatus}
            logsData={logsData}
            draftIp={currentScreen.chromecast_ip ?? undefined}
          />
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
  const ruleVariables = useRuleVariables()
  const multi = isMultiScreen(draft)
  if (!multi) {
    return (
      <Paper p="md" radius="sm" withBorder>
        <Text size="sm" c="dimmed">People are only available in multi-screen format.</Text>
      </Paper>
    )
  }

  const people = getPeople(draft)
  const [selectedId, setSelectedId] = useState<string | null>(() => people[0]?.id ?? null)
  const [saEmail, setSaEmail] = useState<string | null>(null)
  const [lookingUpRoads, setLookingUpRoads] = useState(false)
  const [roadsError, setRoadsError] = useState('')
  const [ruleModal,      setRuleModal]      = useState(false)
  const [editingRule,    setEditingRule]    = useState<Rule | undefined>()
  const [editingRuleIdx, setEditingRuleIdx] = useState(-1)

  useEffect(() => {
    fetch('/api/admin/google-sa-email')
      .then(r => r.json())
      .then(d => setSaEmail(d.email ?? null))
      .catch(() => {})
  }, [])

  const currentIdx = people.findIndex(p => p.id === selectedId)
  const currentPerson = currentIdx >= 0 ? people[currentIdx] : null

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
    setSelectedId(newPerson.id)
  }

  function removePerson() {
    if (!currentPerson) return
    if (!window.confirm(`Remove ${currentPerson.name || currentPerson.id}? This cannot be undone.`)) return
    const remaining = people.filter(p => p.id !== currentPerson.id)
    updatePeople(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  function updatePerson(updates: Partial<Person>) {
    if (!currentPerson) return
    updatePeople(people.map(p => p.id === currentPerson.id ? { ...p, ...updates } : p))
  }

  function openAddPersonRule() {
    setEditingRule(undefined); setEditingRuleIdx(-1); setRuleModal(true)
  }
  function openEditPersonRule(rule: Rule, idx: number) {
    setEditingRule(rule); setEditingRuleIdx(idx); setRuleModal(true)
  }
  function savePersonRule(rule: Rule) {
    const existing = currentPerson?.rules ?? []
    const updated = editingRuleIdx >= 0
      ? existing.map((r, i) => i === editingRuleIdx ? rule : r)
      : [...existing, rule]
    updatePerson({ rules: updated })
    setRuleModal(false)
  }

  function addCalendarId() {
    updatePerson({ calendar_ids: [...(currentPerson?.calendar_ids ?? []), ''] })
  }

  function updateCalendarId(calIdx: number, value: string) {
    const ids = (currentPerson?.calendar_ids ?? []).map((id, i) => i === calIdx ? value : id)
    updatePerson({ calendar_ids: ids })
  }

  function removeCalendarId(calIdx: number) {
    const ids = (currentPerson?.calendar_ids ?? []).filter((_, i) => i !== calIdx)
    updatePerson({ calendar_ids: ids })
  }

  function updateTraffic(patch: Partial<PersonTraffic>) {
    updatePerson({ traffic: { ...currentPerson?.traffic, ...patch } })
  }

  function updateBus(patch: Partial<PersonBus>) {
    updatePerson({ bus: { ...currentPerson?.bus, ...patch } })
  }

  function addRssFeed() {
    const feed: PersonRssFeed = { url: '', label: '' }
    updatePerson({ rss_feeds: [...(currentPerson?.rss_feeds ?? []), feed] })
  }

  function updateRssFeed(feedIdx: number, key: keyof PersonRssFeed, value: string) {
    const feeds = (currentPerson?.rss_feeds ?? []).map((f, i) =>
      i === feedIdx ? { ...f, [key]: value } : f
    )
    updatePerson({ rss_feeds: feeds })
  }

  function removeRssFeed(feedIdx: number) {
    const feeds = (currentPerson?.rss_feeds ?? []).filter((_, i) => i !== feedIdx)
    updatePerson({ rss_feeds: feeds })
  }

  async function handleLookupRoads() {
    const home = currentPerson?.traffic?.home_address ?? ''
    const work = currentPerson?.traffic?.work_address ?? ''
    if (!home || !work) return
    setLookingUpRoads(true)
    setRoadsError('')
    try {
      const params = new URLSearchParams({ home, work })
      const res = await fetch(`/api/admin/route-roads?${params}`)
      const data = await res.json()
      if (data.error) {
        setRoadsError(data.error)
      } else if (data.roads?.length) {
        updateTraffic({ route_roads: data.roads.join(',') })
      } else {
        setRoadsError('No highway numbers found on this route.')
      }
    } catch {
      setRoadsError('Lookup failed.')
    } finally {
      setLookingUpRoads(false)
    }
  }

  return (
    <Stack gap="md">
      {/* Person selector */}
      <Paper p="md" radius="sm" withBorder>
        <SectionTitle>People</SectionTitle>
        <Group gap="xs" wrap="wrap">
          {people.map(p => (
            <Button
              key={p.id}
              size="sm"
              variant={selectedId === p.id ? 'filled' : 'subtle'}
              color={selectedId === p.id ? 'cyan' : 'gray'}
              onClick={() => setSelectedId(p.id)}
            >
              {p.name || p.id}{p.family ? ' ★' : ''}
            </Button>
          ))}
          <Button size="sm" variant="subtle" color="gray" onClick={addPerson}>
            + Add
          </Button>
        </Group>
      </Paper>

      {/* Selected person details */}
      {currentPerson && (
        <>
          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Person settings</SectionTitle>
            <Stack gap="md">
              <Group gap="md" align="flex-end" wrap="wrap">
                <TextInput
                  label="Name"
                  placeholder="Name"
                  value={currentPerson.name}
                  onChange={e => updatePerson({ name: e.target.value })}
                  size="sm"
                  w={200}
                />
                <Checkbox
                  label="Family (all screens)"
                  checked={!!currentPerson.family}
                  onChange={e => updatePerson({ family: e.currentTarget.checked })}
                  size="sm"
                  mb={4}
                />
              </Group>
              <Divider />
              <Button
                variant="subtle"
                color="red"
                size="sm"
                onClick={removePerson}
                style={{ alignSelf: 'flex-start' }}
              >
                Remove person
              </Button>
            </Stack>
          </Paper>

          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Google Calendar IDs</SectionTitle>
            <Stack gap="xs">
              {(currentPerson.calendar_ids ?? []).map((calId, calIdx) => (
                <Group key={calIdx} gap="xs" wrap="nowrap">
                  <TextInput
                    placeholder="xxxx@group.calendar.google.com"
                    value={calId}
                    onChange={e => updateCalendarId(calIdx, e.target.value)}
                    size="sm"
                    style={{ flex: 1, minWidth: 0 }}
                    ff="monospace"
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => removeCalendarId(calIdx)}
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
                onClick={addCalendarId}
                style={{ alignSelf: 'flex-start' }}
              >
                + Add calendar
              </Button>
              {saEmail && (
                <Text size="xs" c="dimmed" mt={4}>
                  Share each calendar with{' '}
                  <Code fz="xs" style={{ userSelect: 'all' }}>{saEmail}</Code>
                  {' '}(Google Calendar → Settings → Share with specific people).
                </Text>
              )}
            </Stack>
          </Paper>

          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Traffic (commute)</SectionTitle>
            <Stack gap="sm">
              <AddressInput
                label="Home address"
                placeholder="Streetname 1, 1234AB City, NL"
                value={currentPerson.traffic?.home_address ?? ''}
                onChange={v => updateTraffic({ home_address: v })}
              />
              <AddressInput
                label="Work address"
                placeholder="Streetname 2, 5678CD City, NL"
                value={currentPerson.traffic?.work_address ?? ''}
                onChange={v => updateTraffic({ work_address: v })}
              />
              <Stack gap={4}>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <TextInput
                    label="Route roads"
                    placeholder="A10,A2,N14"
                    description="Comma-separated — jams on these roads float to the top"
                    value={currentPerson.traffic?.route_roads ?? ''}
                    onChange={e => updateTraffic({ route_roads: e.target.value })}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="subtle"
                    color="cyan"
                    size="sm"
                    onClick={handleLookupRoads}
                    loading={lookingUpRoads}
                    disabled={!currentPerson.traffic?.home_address || !currentPerson.traffic?.work_address}
                    style={{ marginBottom: 2 }}
                  >
                    Lookup
                  </Button>
                </Group>
                {roadsError && (
                  <Text size="xs" c="red">{roadsError}</Text>
                )}
              </Stack>
            </Stack>
          </Paper>

          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Bus stop</SectionTitle>
            <Group gap="sm" wrap="wrap" align="flex-start">
              <TextInput
                label="City"
                value={currentPerson.bus?.stop_city ?? ''}
                onChange={e => updateBus({ stop_city: e.target.value })}
                size="sm"
                w={160}
              />
              <TextInput
                label="Stop name"
                value={currentPerson.bus?.stop_name ?? ''}
                onChange={e => updateBus({ stop_name: e.target.value })}
                size="sm"
                w={200}
              />
            </Group>
          </Paper>

          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Assistant</SectionTitle>
            <Text size="sm" c="dimmed" mb="md">
              {currentPerson.name || 'This person'} will receive family-wide alerts and
              personal alerts (from the rules below) on all their configured notification channels.
            </Text>

            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4} style={{ letterSpacing: '0.07em' }}>
              Rules
            </Text>
            <Text size="sm" c="dimmed" mb="sm">Send a message when:</Text>
            <RuleList
              rules={currentPerson.rules ?? []}
              onChangeRules={r => updatePerson({ rules: r })}
              variables={ruleVariables}
              onAddRule={openAddPersonRule}
              onEditRule={openEditPersonRule}
            />

            <Divider my="md" />

            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.07em' }}>
              Notifications
            </Text>
            <Stack gap="sm">
              <TextInput
                label="ntfy topic"
                description="Personal notifications go here via ntfy. Leave blank to skip ntfy for this person."
                placeholder="wall-cast-alice"
                value={currentPerson.notify?.ntfy_topic ?? ''}
                onChange={e => updatePerson({ notify: { ...currentPerson.notify, ntfy_topic: e.target.value || undefined } })}
                size="sm"
              />
              <TextInput
                label="Matrix room ID"
                description="Personal Matrix room for this person. Leave blank to skip Matrix for personal alerts."
                placeholder="!roomid:matrix.example.com"
                value={currentPerson.notify?.matrix_room_id ?? ''}
                onChange={e => updatePerson({ notify: { ...currentPerson.notify, matrix_room_id: e.target.value || undefined } })}
                size="sm"
                ff="monospace"
              />
            </Stack>
          </Paper>

          <RuleEditorModal
            opened={ruleModal}
            onClose={() => setRuleModal(false)}
            onSave={savePersonRule}
            initial={editingRule}
            variables={ruleVariables}
          />

          <Paper p="md" radius="sm" withBorder>
            <SectionTitle>Personal RSS feeds</SectionTitle>
            <Stack gap="xs">
              {(currentPerson.rss_feeds ?? []).map((feed, feedIdx) => (
                <Group key={feedIdx} gap="xs" wrap="nowrap">
                  <TextInput
                    placeholder="https://feeds.example.com/rss"
                    value={feed.url}
                    onChange={e => updateRssFeed(feedIdx, 'url', e.target.value)}
                    size="sm"
                    style={{ flex: 2, minWidth: 0 }}
                    ff="monospace"
                  />
                  <TextInput
                    placeholder="Label"
                    value={feed.label ?? ''}
                    onChange={e => updateRssFeed(feedIdx, 'label', e.target.value)}
                    size="sm"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => removeRssFeed(feedIdx)}
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
                onClick={addRssFeed}
                style={{ alignSelf: 'flex-start' }}
              >
                + Add feed
              </Button>
              <Text size="xs" c="dimmed" mt={4}>
                Shown in the news ticker on screens where this person is assigned,
                alongside the global feeds.
              </Text>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPanel
// ---------------------------------------------------------------------------

type AdminTab = 'general' | 'screens' | 'people' | 'assistant'

function AdminPanelInner() {
  useScrollUnlock()
  const queryClient = useQueryClient()
  const { data: remoteConfig, isLoading, isError } = useAdminConfig()
  const [draft, setDraft] = useState<AdminConfig | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('general')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  // Only initialise the draft from server data on first load (draft === null).
  // Never overwrite an in-progress draft — that is what was causing edits to
  // disappear: invalidateQueries() triggered a background refetch, remoteConfig
  // updated, and this effect silently reset the draft to the server snapshot.
  useEffect(() => {
    if (remoteConfig && draft === null) setDraft(deepClone(remoteConfig))
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
      // Push the saved draft directly into the query cache instead of
      // invalidating — we know the server now holds exactly `draft`, so there
      // is no need to refetch, and no risk of the refetch triggering the
      // useEffect above and overwriting the user's ongoing edits.
      queryClient.setQueryData(['admin-config'], draft)
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
            ← home
          </Anchor>
        </Group>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={v => v && setActiveTab(v as AdminTab)} mb="lg">
          <Tabs.List mb="lg">
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="screens">Screens</Tabs.Tab>
            <Tabs.Tab value="people">People</Tabs.Tab>
            <Tabs.Tab value="assistant">Assistant</Tabs.Tab>
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
          <Tabs.Panel value="assistant">
            <AssistantTab draft={draft} onChange={handleDraftChange} />
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
