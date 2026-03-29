/**
 * Rule editor — shared between AssistantTab and PeopleTab.
 *
 * Exports:
 *   useRuleVariables  — hook: fetches variable catalogue (cached)
 *   generateRuleId    — helper: slug + random suffix
 *   formatRule        — helper: human-readable summary of a rule's conditions
 *   RuleEditorModal   — modal for creating / editing a single rule
 *   RuleList          — list of rules with enable/edit/delete controls
 */
import React, { useState, useEffect } from 'react'
import {
  Stack, Group, Text,
  TextInput,
  Checkbox,
  Button, ActionIcon,
  SegmentedControl,
  Divider,
  Modal,
  Popover,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import type { Rule, RuleCondition, RuleVariable } from '../types/config'
import { apiFetch } from '../lib/api'

// ── Internal state type ───────────────────────────────────────────────────────

interface ConditionRowState {
  variable: string
  operator: string
  value: string   // always string internally; parsed to correct type on save
  unit: string
}

function emptyCondition(): ConditionRowState {
  return { variable: '', operator: '', value: '', unit: '' }
}

// ── Exported helpers ──────────────────────────────────────────────────────────

export function useRuleVariables(): RuleVariable[] {
  const { data } = useQuery<RuleVariable[]>({
    queryKey: ['rule-variables'],
    queryFn: () => apiFetch<RuleVariable[]>('/api/admin/rule-variables'),
    staleTime: Infinity,
  })
  return data ?? []
}

export function generateRuleId(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rule'
  return slug + '-' + Math.random().toString(36).slice(2, 6)
}

function formatSingleCondition(condition: RuleCondition, variables: RuleVariable[]): string {
  const varMeta = variables.find(v => v.id === condition.variable)
  const label = varMeta?.label ?? condition.variable
  const op    = condition.operator
  const val   = Array.isArray(condition.value)
    ? condition.value.join(', ')
    : String(condition.value)
  const unit  = condition.unit ? ` ${condition.unit}` : ''
  return op === 'in' ? `${label}: ${val}` : `${label} ${op} ${val}${unit}`
}

export function formatRule(rule: Rule, variables: RuleVariable[]): string {
  const conds = rule.conditions ?? (rule.condition ? [rule.condition] : [])
  if (conds.length === 0) return '(no condition)'
  const logic = rule.condition_logic ?? 'and'
  return conds.map(c => formatSingleCondition(c, variables)).join(` ${logic.toUpperCase()} `)
}

// ── Source colour palette (kept in sync with the original picker colours) ─────

const SOURCE_COLOR: Record<string, string> = {
  '/api/weather':    '#74c0fc',
  '/api/warnings':   '#ffe066',
  '/api/rain':       '#4dabf7',
  '/api/airquality': '#69db7c',
  '/api/garbage':    '#a9e34b',
  '/api/p2000':      '#ff8787',
  '/api/market':     '#ffa94d',
  '/api/network':    '#63e6be',
  '/api/polestar':   '#748ffc',
  '/api/calendar':   '#da77f2',
  '/api/traffic':    '#ff922b',
  '/api/bus':        '#ffd43b',
}

// Strip "Source — " prefix for compact display
function shortLabel(label: string): string {
  const idx = label.indexOf(' — ')
  return idx >= 0 ? label.slice(idx + 3) : label
}

// ── Shared tag styles ─────────────────────────────────────────────────────────

const tagBase: React.CSSProperties = {
  display: 'inline-block', padding: '3px 8px', borderRadius: 4,
  fontSize: 11, cursor: 'pointer', userSelect: 'none', border: '1px solid transparent',
  whiteSpace: 'nowrap',
}
const tagIdle: React.CSSProperties = {
  ...tagBase,
  background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#aaa',
}
const tagActive: React.CSSProperties = {
  ...tagBase,
  background: 'rgba(34,184,207,0.18)', borderColor: 'rgba(34,184,207,0.5)', color: '#22b8cf',
}

// ── ConditionRow ──────────────────────────────────────────────────────────────

function ConditionRow({
  cond, variables, onChange, onRemove, showRemove,
}: {
  cond: ConditionRowState
  variables: RuleVariable[]
  onChange: (patch: Partial<ConditionRowState>) => void
  onRemove: () => void
  showRemove: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search,     setSearch]     = useState('')

  const varMeta    = variables.find(v => v.id === cond.variable)
  const validOps   = varMeta?.operators ?? []
  const isEnum     = varMeta?.type === 'enum'
  const isBool     = varMeta?.type === 'boolean'
  const enumValues = varMeta?.enum_values ?? []
  const selectedEnumValues = cond.value ? cond.value.split(',').filter(Boolean) : []
  const sourceColor = varMeta ? (SOURCE_COLOR[varMeta.api_endpoint] ?? '#aaa') : '#555'

  function selectVariable(id: string) {
    const meta = variables.find(v => v.id === id)
    const newOp = meta?.operators.length === 1 ? meta.operators[0] : ''
    onChange({ variable: id, unit: meta?.default_unit ?? '', value: '', operator: newOp })
    setPickerOpen(false)
    setSearch('')
  }

  function toggleEnumValue(val: string) {
    const current = cond.value ? cond.value.split(',').filter(Boolean) : []
    const next = current.includes(val)
      ? current.filter(x => x !== val)
      : [...current, val]
    onChange({ value: next.join(',') })
  }

  // Group variables for the picker, filtered by search
  const lowerSearch = search.toLowerCase()
  const groups = new Map<string, RuleVariable[]>()
  for (const v of variables) {
    if (search && !shortLabel(v.label).toLowerCase().includes(lowerSearch) &&
        !v.id.toLowerCase().includes(lowerSearch)) continue
    const ep = v.api_endpoint ?? 'other'
    if (!groups.has(ep)) groups.set(ep, [])
    groups.get(ep)!.push(v)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '8px 10px', borderRadius: 6,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    }}>

      {/* ── Variable picker button + floating popover ─────────────────────── */}
      <Popover
        opened={pickerOpen}
        onClose={() => { setPickerOpen(false); setSearch('') }}
        position="bottom-start"
        width={340}
        withinPortal
        zIndex={310}
      >
        <Popover.Target>
          <button
            onClick={() => setPickerOpen(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              background: varMeta ? sourceColor + '18' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${varMeta ? sourceColor + '45' : 'rgba(255,255,255,0.15)'}`,
              color: varMeta ? '#ddd' : '#777', fontSize: 12,
              minWidth: 150, maxWidth: 200, overflow: 'hidden',
            }}
          >
            {varMeta && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: sourceColor, display: 'inline-block',
              }} />
            )}
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', flex: 1, textAlign: 'left',
            }}>
              {varMeta ? shortLabel(varMeta.label) : 'Select variable…'}
            </span>
            <span style={{ fontSize: 9, opacity: 0.5, flexShrink: 0 }}>▾</span>
          </button>
        </Popover.Target>

        <Popover.Dropdown style={{ padding: 10 }}>
          <TextInput
            placeholder="Search variables…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="xs"
            mb={8}
            autoFocus
          />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {Array.from(groups.entries()).map(([ep, vars]) => {
              const color    = SOURCE_COLOR[ep] ?? '#aaa'
              const epLabel  = ep.replace('/api/', '')
              return (
                <div key={ep} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: color, display: 'inline-block', flexShrink: 0,
                    }} />
                    <Text size="xs" fw={700} style={{
                      color, opacity: 0.9, textTransform: 'uppercase',
                      letterSpacing: '0.05em', fontSize: 10,
                    }}>
                      {epLabel}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {vars.map(v => {
                      const selected = cond.variable === v.id
                      const tagStyle: React.CSSProperties = {
                        ...tagBase,
                        background:  selected ? color + '28' : color + '0e',
                        borderColor: selected ? color + '80' : color + '30',
                        color:       selected ? '#eee' : '#bbb',
                      }
                      return (
                        <span key={v.id} style={tagStyle} onClick={() => selectVariable(v.id)}>
                          {shortLabel(v.label)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {groups.size === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="sm">
                No variables match "{search}"
              </Text>
            )}
          </div>
        </Popover.Dropdown>
      </Popover>

      {/* ── Operator tags (appear after variable is selected) ─────────────── */}
      {cond.variable && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {validOps.map(op => (
            <span
              key={op}
              style={cond.operator === op ? tagActive : tagIdle}
              onClick={() => onChange({ operator: op })}
            >
              {op}
            </span>
          ))}
        </div>
      )}

      {/* ── Value: number / string ────────────────────────────────────────── */}
      {cond.operator && !isEnum && !isBool && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <TextInput
            value={cond.value}
            onChange={e => onChange({ value: e.target.value })}
            size="xs"
            style={{ width: 70 }}
            placeholder={varMeta?.type === 'number' ? '0' : '…'}
          />
          <TextInput
            value={cond.unit}
            onChange={e => onChange({ unit: e.target.value })}
            size="xs"
            style={{ width: 52 }}
            placeholder="unit"
          />
        </div>
      )}

      {/* ── Value: boolean — true / false tags ───────────────────────────── */}
      {cond.operator && isBool && (
        <div style={{ display: 'flex', gap: 4 }}>
          {['true', 'false'].map(bval => (
            <span
              key={bval}
              style={cond.value === bval ? tagActive : tagIdle}
              onClick={() => onChange({ value: bval })}
            >
              {bval}
            </span>
          ))}
        </div>
      )}

      {/* ── Value: enum — multi-select tags ──────────────────────────────── */}
      {cond.operator && isEnum && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {enumValues.map(val => (
            <span
              key={val}
              style={selectedEnumValues.includes(val) ? tagActive : tagIdle}
              onClick={() => toggleEnumValue(val)}
            >
              {val}
            </span>
          ))}
        </div>
      )}

      {/* ── Remove button ─────────────────────────────────────────────────── */}
      {showRemove && (
        <ActionIcon
          variant="subtle" color="red" size="sm"
          onClick={onRemove}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          ✕
        </ActionIcon>
      )}
    </div>
  )
}

// ── RuleEditorModal ───────────────────────────────────────────────────────────

export function RuleEditorModal({
  opened, onClose, onSave, initial, variables,
}: {
  opened: boolean
  onClose: () => void
  onSave: (rule: Rule) => void
  initial?: Rule
  variables: RuleVariable[]
}) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [enabled,     setEnabled]     = useState(true)
  const [conditions,  setConditions]  = useState<ConditionRowState[]>([emptyCondition()])
  const [condLogic,   setCondLogic]   = useState<'and' | 'or'>('and')

  useEffect(() => {
    if (!opened) return
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setEnabled(initial?.enabled ?? true)
    setCondLogic(initial?.condition_logic ?? 'and')

    // Normalise: prefer conditions[] array; fall back to legacy condition
    const rawConds = initial?.conditions ?? (initial?.condition ? [initial.condition] : null)
    if (rawConds && rawConds.length > 0) {
      setConditions(rawConds.map(c => ({
        variable: c.variable,
        operator: c.operator,
        value: Array.isArray(c.value) ? c.value.join(',') : String(c.value ?? ''),
        unit: c.unit ?? '',
      })))
    } else {
      setConditions([emptyCondition()])
    }
  }, [opened])

  function updateCondition(idx: number, patch: Partial<ConditionRowState>) {
    setConditions(cs => cs.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  function addCondition() {
    if (conditions.length < 3) setConditions(cs => [...cs, emptyCondition()])
  }

  function removeCondition(idx: number) {
    setConditions(cs => cs.filter((_, i) => i !== idx))
  }

  function isConditionComplete(c: ConditionRowState): boolean {
    if (!c.variable || !c.operator) return false
    const varMeta = variables.find(v => v.id === c.variable)
    if (varMeta?.type === 'enum')    return c.value.split(',').filter(Boolean).length > 0
    if (varMeta?.type === 'boolean') return c.value === 'true' || c.value === 'false'
    return c.value.trim() !== ''
  }

  const canSave =
    title.trim() !== '' &&
    conditions.length > 0 &&
    conditions.every(isConditionComplete)

  function buildCondition(c: ConditionRowState): RuleCondition {
    const varMeta = variables.find(v => v.id === c.variable)
    let rawValue: RuleCondition['value']
    if (varMeta?.type === 'enum')    rawValue = c.value.split(',').filter(Boolean)
    else if (varMeta?.type === 'boolean') rawValue = c.value === 'true'
    else                              rawValue = varMeta?.type === 'number' ? Number(c.value) : c.value
    return { variable: c.variable, operator: c.operator, value: rawValue, unit: c.unit || null }
  }

  function handleSave() {
    if (!canSave) return
    onSave({
      id: initial?.id ?? generateRuleId(title),
      title: title.trim(),
      description: description.trim() || undefined,
      enabled,
      conditions: conditions.map(buildCondition),
      condition_logic: conditions.length > 1 ? condLogic : undefined,
    })
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={initial ? 'Edit rule' : 'Add rule'}
      size="lg"
      centered
    >
      <Stack gap="md">

        {/* Title + description + enabled */}
        <TextInput
          label="Title"
          placeholder="e.g. Bus delay alert"
          value={title}
          onChange={e => setTitle(e.target.value)}
          size="sm"
          autoFocus
        />
        <Group gap="md" align="flex-start" wrap="nowrap">
          <TextInput
            label="Description"
            placeholder="Optional"
            value={description}
            onChange={e => setDescription(e.target.value)}
            size="sm"
            style={{ flex: 1 }}
          />
          <Checkbox
            label="Enabled"
            checked={enabled}
            onChange={e => setEnabled(e.currentTarget.checked)}
            size="sm"
            style={{ paddingTop: 24, flexShrink: 0 }}
          />
        </Group>

        <Divider />

        {/* Conditions section */}
        <div>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={10}>
            {conditions.length === 1 ? 'Condition' : 'Conditions'}
          </Text>

          <Stack gap={0}>
            {conditions.map((cond, idx) => (
              <React.Fragment key={idx}>
                <ConditionRow
                  cond={cond}
                  variables={variables}
                  onChange={patch => updateCondition(idx, patch)}
                  onRemove={() => removeCondition(idx)}
                  showRemove={conditions.length > 1}
                />

                {/* AND / OR toggle between consecutive rows */}
                {idx < conditions.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                    <SegmentedControl
                      value={condLogic}
                      onChange={v => setCondLogic(v as 'and' | 'or')}
                      size="xs"
                      data={[
                        { label: 'AND', value: 'and' },
                        { label: 'OR',  value: 'or'  },
                      ]}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </Stack>

          {conditions.length < 3 && (
            <button
              onClick={addCondition}
              style={{
                marginTop: 8, padding: '4px 12px', borderRadius: 4,
                background: 'transparent', border: '1px dashed rgba(255,255,255,0.18)',
                color: '#777', fontSize: 12, cursor: 'pointer',
              }}
            >
              + Add condition
            </button>
          )}
        </div>

        {/* Save / cancel */}
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="subtle" color="gray" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>Save rule</Button>
        </Group>

      </Stack>
    </Modal>
  )
}

// ── RuleList ──────────────────────────────────────────────────────────────────

export function RuleList({
  rules, onChangeRules, variables, onAddRule, onEditRule,
}: {
  rules: Rule[]
  onChangeRules: (rules: Rule[]) => void
  variables: RuleVariable[]
  onAddRule: () => void
  onEditRule: (rule: Rule, index: number) => void
}) {
  function toggleEnabled(idx: number) {
    onChangeRules(rules.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r))
  }

  function removeRule(idx: number) {
    onChangeRules(rules.filter((_, i) => i !== idx))
  }

  return (
    <Stack gap={6}>
      {rules.length === 0 && (
        <Text size="sm" c="dimmed">No rules configured.</Text>
      )}
      {rules.map((rule, idx) => (
        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Checkbox
            checked={rule.enabled}
            onChange={() => toggleEnabled(idx)}
            size="sm"
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={500}>{rule.title}</Text>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatRule(rule, variables)}
            </Text>
          </div>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEditRule(rule, idx)}>
            ✎
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeRule(idx)}>
            ✕
          </ActionIcon>
        </div>
      ))}
      <Button
        variant="subtle" color="gray" size="xs"
        onClick={onAddRule}
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
      >
        + Add rule
      </Button>
    </Stack>
  )
}
