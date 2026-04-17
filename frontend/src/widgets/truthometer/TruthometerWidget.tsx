import { useTruthometer } from '../../hooks/use-truthometer'
import { useLang } from '../../i18n/use-lang'
import type { TruthometerPost, TruthometerStats } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { col, fs, sectionLabelStyle, sp } from '../styles'
import { WidgetShell } from '../WidgetShell'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRUMP_RED  = '#b22234'
const REPOST_COL = '#6b7280'

function trendIcon(trend: 'up' | 'down' | 'steady'): string {
  if (trend === 'up')     return '↑'
  if (trend === 'down')   return '↓'
  return '→'
}

function trendColor(trend: 'up' | 'down' | 'steady'): string {
  if (trend === 'up')   return '#f97316'
  if (trend === 'down') return '#4ade80'
  return 'var(--color-muted)'
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({
  value,
  label,
  color,
}: {
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      background:    col.cardBgDim,
      borderRadius:  sp.cardRadius,
      padding:       '0.3rem 0.6rem',
      flexShrink:    0,
      minWidth:      '3.5rem',
    }}>
      <span style={{
        fontSize:           fs.lg,
        fontWeight:         700,
        color:              color ?? 'var(--color-text)',
        lineHeight:         1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{
        fontSize:      fs.xs,
        color:         'var(--color-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop:     '0.15rem',
        whiteSpace:    'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({ stats, t }: { stats: TruthometerStats; t: ReturnType<typeof useLang> }) {
  const origPct = stats.originals + stats.reposts > 0
    ? Math.round((stats.originals / (stats.originals + stats.reposts)) * 100)
    : 0

  return (
    <div style={{
      display:    'flex',
      gap:        sp.innerGap,
      flexWrap:   'wrap',
      flexShrink: 0,
    }}>
      <StatChip value={stats.posts_last_hour} label={t.truthometerPerHour} />
      <StatChip value={stats.posts_last_24h}  label={t.truthometerPer24h} />
      <StatChip value={`${origPct}%`}         label={t.truthometerOriginals} color={TRUMP_RED} />
      <StatChip
        value={trendIcon(stats.trend)}
        label={
          stats.trend === 'up'   ? t.truthometerTrendUp   :
          stats.trend === 'down' ? t.truthometerTrendDown :
          t.truthometerTrendSteady
        }
        color={trendColor(stats.trend)}
      />
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, t }: { post: TruthometerPost; t: ReturnType<typeof useLang> }) {
  const accent = post.is_repost ? REPOST_COL : TRUMP_RED
  const alpha  = post.is_repost ? 0.6 : 1

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           sp.listGap,
      background:    post.is_repost ? col.cardBgDim : col.cardBg,
      border:        `1px solid ${post.is_repost ? col.cardBorder : accent + '44'}`,
      borderLeft:    `4px solid ${accent}`,
      borderRadius:  sp.cardRadius,
      padding:       sp.cardPad,
      flexShrink:    0,
      opacity:       alpha,
    }}>
      {/* Header row */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '0.4rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {post.is_repost && (
            <div style={{
              background:   `${REPOST_COL}22`,
              border:       `1px solid ${REPOST_COL}55`,
              borderRadius: 4,
              padding:      '0.1rem 0.4rem',
            }}>
              <span style={{
                fontSize:      fs.xs,
                fontWeight:    700,
                color:         REPOST_COL,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {t.truthometerRetruth}
              </span>
            </div>
          )}
          {post.original_account && (
            <span style={{ fontSize: fs.xs, color: 'var(--color-muted)' }}>
              @{post.original_account}
            </span>
          )}
        </div>
        <span style={{ fontSize: fs.xs, color: 'var(--color-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t.truthometerAgoMin(post.age_min)}
        </span>
      </div>

      {/* TLDR */}
      <span style={{ fontSize: fs.sm, color: 'var(--color-text)', lineHeight: 1.4 }}>
        {post.tldr}
      </span>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function TruthometerWidget(_props: WidgetProps) {
  const t = useLang()
  const { data, isLoading, isError, dataUpdatedAt } = useTruthometer()

  if (isLoading) {
    return (
      <WidgetShell title={t.truthometerTitle} source="truthsocial.com" dataUpdatedAt={dataUpdatedAt}>
        {null}
      </WidgetShell>
    )
  }

  if (isError || !data) {
    return (
      <WidgetShell title={t.truthometerTitle} source="truthsocial.com" dataUpdatedAt={dataUpdatedAt}>
        <span style={{ fontSize: fs.sm, color: 'var(--color-muted)' }}>{t.truthometerUnavailable}</span>
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title={t.truthometerTitle} source="truthsocial.com" dataUpdatedAt={dataUpdatedAt}>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <StatsRow stats={data.stats} t={t} />

      {/* ── Posts ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flexShrink: 0 }}>
        <div style={sectionLabelStyle}>{t.truthometerRecent}</div>
      </div>

      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           sp.listGap,
        flex:          1,
        minHeight:     0,
        overflowY:     'auto',
      }}>
        {data.posts.map(post => (
          <PostCard key={post.id} post={post} t={t} />
        ))}
        {data.posts.length === 0 && (
          <span style={{ fontSize: fs.sm, color: 'var(--color-muted)' }}>
            {t.truthometerUnavailable}
          </span>
        )}
      </div>

    </WidgetShell>
  )
}
