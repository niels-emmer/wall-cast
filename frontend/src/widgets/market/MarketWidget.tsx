import { useMarket } from '../../hooks/use-market'
import { useLang } from '../../i18n/use-lang'
import type { CryptoData, QuoteData } from '../../types/api'
import type { WidgetProps } from '../base-registry'
import { col, dividerStyle, fs, sectionLabelStyle, shellStyle, sp, titleStyle } from '../styles'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCryptoPrice(price: number): string {
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`
  if (price >= 1)    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${price.toFixed(4)}`
}

function fmtQuotePrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 100)   return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

// Short symbol for display in compact chips
function shortSymbol(symbol: string): string {
  const map: Record<string, string> = {
    '^GSPC': 'SPX', '^IXIC': 'NDX', '^AEX': 'AEX', '^FTSE': 'FTSE',
  }
  return map[symbol] ?? symbol
}

// ── Fear & Greed Gauge ────────────────────────────────────────────────────────

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const pct   = Math.max(0, Math.min(100, value))
  const color = fearGreedColor(value)
  const TRACK_H  = '0.55rem'   // visible track height
  const THUMB_D  = '1.35rem'   // circle diameter — taller than track

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>

      {/* Track + thumb in a shared container */}
      <div style={{ position: 'relative', height: THUMB_D, display: 'flex', alignItems: 'center' }}>

        {/* Full gradient track */}
        <div style={{
          position:     'absolute',
          left:         0,
          right:        0,
          height:       TRACK_H,
          borderRadius: 6,
          background:   'linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #a3e635 75%, #4ade80 100%)',
        }} />

        {/* Dim overlay for the portion to the right of the marker (unlit) */}
        <div style={{
          position:     'absolute',
          left:         `${pct}%`,
          right:        0,
          height:       TRACK_H,
          borderRadius: '0 6px 6px 0',
          background:   'rgba(0,0,0,0.55)',
        }} />

        {/* Circle thumb */}
        <div style={{
          position:     'absolute',
          left:         `${pct}%`,
          transform:    'translateX(-50%)',
          width:        THUMB_D,
          height:       THUMB_D,
          borderRadius: '50%',
          background:   color,
          border:       '3px solid rgba(255,255,255,0.9)',
          boxShadow:    '0 2px 8px rgba(0,0,0,0.7)',
          zIndex:       1,
          flexShrink:   0,
        }} />
      </div>

      {/* Value + label + scale */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{
          fontSize: fs.lg, fontWeight: 700, color, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <span style={{
          fontSize: fs.sm, fontWeight: 600, color,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          {label}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: fs.xs, color: '#ef4444', opacity: 0.65 }}>Fear</span>
        <span style={{ fontSize: fs.xs, color: 'var(--color-muted)', opacity: 0.4 }}>·</span>
        <span style={{ fontSize: fs.xs, color: '#4ade80', opacity: 0.65 }}>Greed</span>
      </div>
    </div>
  )
}

// ── Crypto row ────────────────────────────────────────────────────────────────

function CryptoRow({ c }: { c: CryptoData }) {
  const cc = changeColor(c.change_pct_24h)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      background: col.cardBgDim, borderRadius: sp.cardRadius,
      padding: '0.25rem 0.45rem', flexShrink: 0,
    }}>
      <span style={{
        fontSize: fs.xs, color: 'var(--color-muted)', opacity: 0.5,
        width: '1.1em', textAlign: 'right',
        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
      }}>
        {c.rank}
      </span>
      <span style={{
        fontSize: fs.xs, fontWeight: 700, color: 'var(--color-text)',
        width: '3em', flexShrink: 0, letterSpacing: '0.04em',
      }}>
        {c.symbol}
      </span>
      <span style={{
        fontSize: fs.xs, color: 'var(--color-text)',
        flex: 1, fontVariantNumeric: 'tabular-nums', textAlign: 'right',
      }}>
        {fmtCryptoPrice(c.price)}
      </span>
      <span style={{
        fontSize: fs.xs, color: cc,
        fontVariantNumeric: 'tabular-nums', textAlign: 'right',
        width: '4.2em', flexShrink: 0,
      }}>
        {fmtChange(c.change_pct_24h)}
      </span>
    </div>
  )
}

// ── Quote chip (compact, for bottom section) ──────────────────────────────────

function QuoteChip({ q }: { q: QuoteData }) {
  const cc  = changeColor(q.change_pct)
  const sym = shortSymbol(q.symbol)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      background: col.cardBgDim, borderRadius: sp.cardRadius,
      padding: '0.25rem 0.5rem',
      borderLeft: `2.5px solid ${cc}`,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: fs.xs, fontWeight: 700, color: 'var(--color-muted)',
        letterSpacing: '0.06em', flexShrink: 0,
      }}>
        {sym}
      </span>
      <span style={{
        fontSize: fs.xs, color: 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
      }}>
        {fmtQuotePrice(q.price)}
      </span>
      <span style={{ fontSize: fs.xs, color: cc, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {fmtChange(q.change_pct)}
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
  const quotes  = [...indices, ...stocks]

  return (
    <div style={shellStyle}>
      {title}
      {divider}

      {/* ── Fear & Greed ───────────────────────────────────────────── */}
      {data.fear_greed && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: '0.35rem' }}>{t.marketFearGreed}</div>
          <FearGreedGauge
            value={data.fear_greed.value}
            label={t.fearGreedLabel(data.fear_greed.value)}
          />
        </div>
      )}

      {/* ── Crypto ─────────────────────────────────────────────────── */}
      {data.crypto.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp.innerGap, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={sectionLabelStyle}>{t.marketCrypto}</div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: sp.innerGap, overflow: 'hidden',
          }}>
            {data.crypto.map(c => <CryptoRow key={c.symbol} c={c} />)}
          </div>
        </div>
      )}

      {/* ── Stocks & Indices (at bottom) ───────────────────────────── */}
      {quotes.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          {indices.length > 0 && (
            <>
              <div style={{ ...sectionLabelStyle, marginBottom: '0.25rem' }}>{t.marketIndices}</div>
              <div style={{ display: 'flex', gap: sp.innerGap, flexWrap: 'wrap', marginBottom: sp.listGap }}>
                {indices.map(q => <QuoteChip key={q.symbol} q={q} />)}
              </div>
            </>
          )}
          {stocks.length > 0 && (
            <>
              <div style={{ ...sectionLabelStyle, marginBottom: '0.25rem' }}>{t.marketStocks}</div>
              <div style={{ display: 'flex', gap: sp.innerGap, flexWrap: 'wrap' }}>
                {stocks.map(q => <QuoteChip key={q.symbol} q={q} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
