import { useMarket } from '../../hooks/use-market'
import { useLang } from '../../i18n/use-lang'
import type { CryptoData, QuoteData } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { cardBase, col, dividerStyle, fs, sectionLabelStyle, shellStyle, sp, titleStyle } from '../styles'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(price: number, isCrypto: boolean): string {
  if (!isCrypto) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 1000)  return `$${(price / 1000).toFixed(1)}k`
  if (price >= 1)     return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${price.toFixed(4)}`
}

function fmtChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function changeColor(pct: number): string {
  return pct >= 0 ? '#4ade80' : '#ef4444'
}

function fearGreedColor(value: number): string {
  if (value <= 24) return '#ef4444'
  if (value <= 44) return '#f97316'
  if (value <= 54) return '#eab308'
  if (value <= 74) return '#a3e635'
  return '#4ade80'
}

// ── Fear & Greed Gauge ────────────────────────────────────────────────────────

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = fearGreedColor(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
      {/* Bar */}
      <div style={{ position: 'relative', height: '0.55rem', borderRadius: 6, overflow: 'hidden' }}>
        {/* Gradient track */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #a3e635 75%, #4ade80 100%)',
          opacity: 0.35,
          borderRadius: 6,
        }} />
        {/* Filled portion */}
        <div style={{
          position:     'absolute',
          left:         0,
          top:          0,
          bottom:       0,
          width:        `${pct}%`,
          background:   `linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #a3e635 75%, #4ade80 100%)`,
          borderRadius: 6,
          transition:   'width 0.6s ease',
        }} />
        {/* Needle */}
        <div style={{
          position:    'absolute',
          top:         '-0.15rem',
          bottom:      '-0.15rem',
          left:        `calc(${pct}% - 1px)`,
          width:       2,
          background:  '#fff',
          borderRadius: 2,
          boxShadow:   '0 0 4px rgba(0,0,0,0.6)',
        }} />
      </div>

      {/* Value + label row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{
          fontSize:           fs.lg,
          fontWeight:         700,
          color,
          lineHeight:         1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <span style={{
          fontSize:      fs.sm,
          fontWeight:    600,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          {label}
        </span>
        <span style={{ flex: 1 }} />
        {/* Scale labels */}
        <span style={{ fontSize: fs.xs, color: '#ef4444', opacity: 0.7 }}>0</span>
        <span style={{ fontSize: fs.xs, color: 'var(--color-muted)', opacity: 0.5 }}>50</span>
        <span style={{ fontSize: fs.xs, color: '#4ade80', opacity: 0.7 }}>100</span>
      </div>
    </div>
  )
}

// ── Quote card ────────────────────────────────────────────────────────────────

function QuoteCard({ q }: { q: QuoteData }) {
  const cc = changeColor(q.change_pct)
  // Shorten long index names
  const displayName = q.name.replace(' Index', '').replace(' Composite', '').replace(' 500', ' 500')

  return (
    <div style={{
      ...cardBase,
      display:        'flex',
      flexDirection:  'column',
      gap:            sp.innerGap,
      flex:           1,
      minWidth:       0,
      borderLeft:     `3px solid ${cc}`,
    }}>
      <span style={{
        fontSize:     fs.xs,
        color:        'var(--color-muted)',
        whiteSpace:   'nowrap',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        fontWeight:   600,
        letterSpacing:'0.05em',
      }}>
        {displayName}
      </span>
      <span style={{
        fontSize:           fs.sm,
        fontWeight:         600,
        color:              'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace:         'nowrap',
      }}>
        {fmtPrice(q.price, false)}
      </span>
      <span style={{ fontSize: fs.xs, color: cc, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmtChange(q.change_pct)}
      </span>
    </div>
  )
}

// ── Crypto row ────────────────────────────────────────────────────────────────

function CryptoRow({ c }: { c: CryptoData }) {
  const cc = changeColor(c.change_pct_24h)

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '0.5rem',
      background:   col.cardBgDim,
      borderRadius: sp.cardRadius,
      padding:      '0.3rem 0.5rem',
      flexShrink:   0,
    }}>
      {/* Rank */}
      <span style={{
        fontSize:           fs.xs,
        color:              'var(--color-muted)',
        opacity:            0.55,
        width:              '1.2em',
        textAlign:          'right',
        fontVariantNumeric: 'tabular-nums',
        flexShrink:         0,
      }}>
        {c.rank}
      </span>
      {/* Symbol */}
      <span style={{
        fontSize:      fs.xs,
        fontWeight:    700,
        color:         'var(--color-text)',
        width:         '3em',
        flexShrink:    0,
        letterSpacing: '0.05em',
      }}>
        {c.symbol}
      </span>
      {/* Price */}
      <span style={{
        fontSize:           fs.xs,
        color:              'var(--color-text)',
        flex:               1,
        fontVariantNumeric: 'tabular-nums',
        textAlign:          'right',
      }}>
        {fmtPrice(c.price, true)}
      </span>
      {/* Change */}
      <span style={{
        fontSize:           fs.xs,
        color:              cc,
        fontVariantNumeric: 'tabular-nums',
        textAlign:          'right',
        width:              '4.5em',
        flexShrink:         0,
      }}>
        {fmtChange(c.change_pct_24h)}
      </span>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function MarketWidget(_props: WidgetProps) {
  const t = useLang()
  const { data, isLoading, isError } = useMarket()

  const title   = <div style={titleStyle}>{t.marketTitle}</div>
  const divider = <div style={dividerStyle} />

  if (isLoading) return <div style={shellStyle}>{title}</div>

  if (isError || !data) return (
    <div style={shellStyle}>
      {title}
      {divider}
      <span style={{ fontSize: fs.sm, color: 'var(--color-muted)' }}>{t.marketUnavailable}</span>
    </div>
  )

  const indices = data.quotes.filter(q => q.type === 'index')
  const stocks  = data.quotes.filter(q => q.type === 'stock')

  return (
    <div style={shellStyle}>
      {title}
      {divider}

      {/* ── Fear & Greed ───────────────────────────────────────────── */}
      {data.fear_greed && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: '0.3rem' }}>{t.marketFearGreed}</div>
          <FearGreedGauge
            value={data.fear_greed.value}
            label={t.fearGreedLabel(data.fear_greed.value)}
          />
        </div>
      )}

      {/* ── Indices ───────────────────────────────────────────────── */}
      {indices.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: '0.3rem' }}>{t.marketIndices}</div>
          <div style={{ display: 'flex', gap: sp.listGap }}>
            {indices.map(q => <QuoteCard key={q.symbol} q={q} />)}
          </div>
        </div>
      )}

      {/* ── Stocks ────────────────────────────────────────────────── */}
      {stocks.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: '0.3rem' }}>{t.marketStocks}</div>
          <div style={{ display: 'flex', gap: sp.listGap }}>
            {stocks.map(q => <QuoteCard key={q.symbol} q={q} />)}
          </div>
        </div>
      )}

      {/* ── Crypto ────────────────────────────────────────────────── */}
      {data.crypto.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp.innerGap, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={sectionLabelStyle}>{t.marketCrypto}</div>
          <div style={{
            display:       'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:           sp.innerGap,
            overflow:      'hidden',
          }}>
            {data.crypto.map(c => <CryptoRow key={c.symbol} c={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
