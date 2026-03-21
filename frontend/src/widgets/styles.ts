import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens for wall-cast display widgets
//
// ALL layout CSS must use inline style={{ }} objects — Tailwind utility classes
// silently drop in the production build.
// ─────────────────────────────────────────────────────────────────────────────

// ── Font sizes (7 semantic tiers) ────────────────────────────────────────────
//
//  xs    — badges, fine print, road labels
//  sm    — secondary text (direction, time stamps, wind, muted labels)
//  md    — primary card text (event name, bus line, container name)
//  lg    — featured numbers (column temps, travel duration, range km)
//  hero  — big hero numbers (current temp, battery SOC)
//  title — widget header (fw 300, uppercase, tracked)
//  icon  — emoji / symbol icons
//
export const fs = {
  xs:    'clamp(0.7rem,  1.2vw,  0.95rem)',
  sm:    'clamp(0.9rem,  1.6vw,  1.3rem)',
  md:    'clamp(1.1rem,  2vw,    1.6rem)',
  lg:    'clamp(1.5rem,  2.8vw,  2.2rem)',
  hero:  'clamp(2rem,    4vw,    3.2rem)',
  title: 'clamp(1.3rem,  2.6vw,  2.1rem)',
  icon:  'clamp(1.7rem,  3.2vw,  2.6rem)',
} as const

// ── Spacing ───────────────────────────────────────────────────────────────────
export const sp = {
  /** Outer padding for every widget shell */
  shellPad:   '0.85rem',
  /** Gap between shell children (title → divider → content) */
  shellGap:   '0.45rem',
  /** Padding inside every card / row */
  cardPad:    '0.45rem 0.7rem',
  /** Border-radius used on every card and row */
  cardRadius: 8,
  /** Gap between items in a card list */
  listGap:    '0.35rem',
  /** Gap between sub-elements inside a single card */
  innerGap:   '0.15rem',
} as const

// ── Colours ───────────────────────────────────────────────────────────────────
export const col = {
  divider:    'rgba(255,255,255,0.07)',
  cardBg:     'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.09)',
  cardBgDim:  'rgba(255,255,255,0.03)',
} as const

// ── Reusable style objects ────────────────────────────────────────────────────

/** Base shell — flex column, full height, standard padding + gap */
export const shellStyle: CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  height:        '100%',
  padding:       sp.shellPad,
  boxSizing:     'border-box',
  gap:           sp.shellGap,
  overflow:      'hidden',
}

/** Widget title — uppercase, light weight, tracked */
export const titleStyle: CSSProperties = {
  fontSize:      fs.title,
  fontWeight:    300,
  textTransform: 'uppercase',
  letterSpacing: '0.25em',
  color:         'var(--color-text)',
  flexShrink:    0,
}

/** Muted section label above a card list */
export const sectionLabelStyle: CSSProperties = {
  fontSize:      fs.sm,
  fontWeight:    600,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color:         'var(--color-muted)',
  flexShrink:    0,
}

/** Thin horizontal rule between sections */
export const dividerStyle: CSSProperties = {
  height:     1,
  background: col.divider,
  flexShrink: 0,
}

/** Common card base — standard bg, border, radius and padding */
export const cardBase: CSSProperties = {
  background:   col.cardBg,
  border:       `1px solid ${col.cardBorder}`,
  borderRadius: sp.cardRadius,
  padding:      sp.cardPad,
  flexShrink:   0,
}

/** Dim card variant (no border) — used for weather cols and garbage rows */
export const cardBaseDim: CSSProperties = {
  background:   col.cardBgDim,
  borderRadius: sp.cardRadius,
  padding:      sp.cardPad,
  flexShrink:   0,
}
