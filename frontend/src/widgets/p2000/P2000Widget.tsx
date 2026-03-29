import { useEffect } from 'react'
import { useP2000 } from '../../hooks/use-p2000'
import { useLang } from '../../i18n/use-lang'
import type { P2000Incident } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { fs, sp, col, sectionLabelStyle } from '../styles'
import { WidgetShell } from '../WidgetShell'

// ── Discipline colours ────────────────────────────────────────────────────────

const DISC_COLOR: Record<string, string> = {
  Brandweerdiensten: '#f97316',   // orange
  Ambulancediensten: '#ef4444',   // red
  Politiediensten:   '#3b82f6',   // blue
}

const DISC_ICON: Record<string, string> = {
  Brandweerdiensten: '🚒',
  Ambulancediensten: '🚑',
  Politiediensten:   '🚔',
}

function discColor(discipline: string): string {
  return DISC_COLOR[discipline] ?? '#a78bfa'
}

function discIcon(discipline: string): string {
  return DISC_ICON[discipline] ?? '🚨'
}

// ── Incident card ─────────────────────────────────────────────────────────────

function IncidentCard({
  incident,
  dimmed,
  t,
}: {
  incident: P2000Incident
  dimmed: boolean
  t: ReturnType<typeof useLang>
}) {
  const color  = discColor(incident.discipline)
  const icon   = discIcon(incident.discipline)
  const alpha  = dimmed ? 0.45 : 1

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           sp.listGap,
      background:    dimmed ? col.cardBgDim : col.cardBg,
      border:        `1px solid ${dimmed ? col.cardBorder : color + '44'}`,
      borderLeft:    `4px solid ${color}`,
      borderRadius:  sp.cardRadius,
      padding:       sp.cardPad,
      flexShrink:    0,
      opacity:       alpha,
    }}>
      {/* Top row: icon + discipline + priority pill + age */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '0.4rem',
      }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '0.4rem',
          minWidth:   0,
        }}>
          <span style={{ fontSize: fs.sm, lineHeight: 1 }}>{icon}</span>
          <span style={{
            fontSize:      fs.xs,
            fontWeight:    600,
            color:         color,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace:    'nowrap',
          }}>
            {incident.discipline.replace('diensten', '')}
          </span>
          {incident.priority && (
            <div style={{
              background:   `${color}22`,
              border:       `1px solid ${color}55`,
              borderRadius: 4,
              padding:      '0.1rem 0.4rem',
              flexShrink:   0,
            }}>
              <span style={{
                fontSize:      fs.xs,
                fontWeight:    700,
                color:         color,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {incident.priority}
              </span>
            </div>
          )}
        </div>
        <span style={{
          fontSize:   fs.xs,
          color:      'var(--color-muted)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {t.p2000AgoMin(incident.age_min)}
        </span>
      </div>

      {/* Message text */}
      <span style={{
        fontSize:   fs.sm,
        color:      'var(--color-text)',
        lineHeight: 1.35,
      }}>
        {incident.message}
      </span>
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function P2000Widget({ config, onSkip, onUnskip }: WidgetProps) {
  const t = useLang()
  const enabled = config.enabled !== false
  const { data, isLoading, dataUpdatedAt } = useP2000(enabled)

  const incidents     = data?.incidents ?? []
  const activeList    = incidents.filter(i => i.age_min <= 60)
  const historicList  = incidents.filter(i => i.age_min > 60)
  const hasIncidents  = incidents.length > 0

  useEffect(() => {
    if (isLoading) return
    if (!enabled || !hasIncidents) {
      onSkip?.()
    } else {
      onUnskip?.()
    }
  }, [isLoading, enabled, hasIncidents, onSkip, onUnskip])

  const regionSuffix = data?.region ? (
    <span style={{
      fontSize:      fs.sm,
      color:         'var(--color-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
    }}>
      {data.region}
    </span>
  ) : undefined

  if (isLoading || !enabled || !hasIncidents) {
    return (
      <WidgetShell
        title={t.p2000Title}
        source="P2000"
        dataUpdatedAt={dataUpdatedAt}
        containerStyle={{ opacity: 0 }}
      >
        {null}
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title={t.p2000Title} titleSuffix={regionSuffix} source="P2000" dataUpdatedAt={dataUpdatedAt}>
      {/* Scrollable list */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           sp.listGap,
        overflow:      'hidden',
        flex:          1,
        minHeight:     0,
      }}>
        {/* Active incidents */}
        {activeList.length > 0 && (
          <>
            <div style={sectionLabelStyle}>{t.p2000Active}</div>
            {activeList.map(i => (
              <IncidentCard key={i.id} incident={i} dimmed={false} t={t} />
            ))}
          </>
        )}

        {/* Historic incidents */}
        {historicList.length > 0 && (
          <>
            <div style={{ ...sectionLabelStyle, marginTop: activeList.length > 0 ? '0.3rem' : 0 }}>
              {t.p2000Historic}
            </div>
            {historicList.map(i => (
              <IncidentCard key={i.id} incident={i} dimmed t={t} />
            ))}
          </>
        )}
      </div>
    </WidgetShell>
  )
}
