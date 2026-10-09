import type { ThemeTokens } from '../../engine';
import { CINZEL_LATIN_EXT_WOFF2, CINZEL_LATIN_WOFF2 } from './fonts/cinzel';

// Google Fonts' subset ranges for Cinzel v26.
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT_RANGE =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

/**
 * Castle of the Winds' material (ADR-0011): a night-slate surface ladder, amber for
 * selection and action, gold-yellow names, an amber frame on dialogs. Roles only; the
 * renderer derives everything else.
 */
export const COTW_THEME_TOKENS: ThemeTokens = {
  surface0: '#0a0c14',
  surface1: '#161a26',
  surface2: '#1c2433',
  surface3: '#05070c',
  line: '#252e40',
  lineStrong: '#3b455b',
  frame: '#d97706',

  text: '#f8fafc',
  textSoft: '#cbd5e1',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  title: '#fde047',

  accent: '#f59e0b',
  accentInk: '#0a0c14',
  good: '#4ade80',
  warn: '#fbbf24',
  bad: '#f87171',
  info: '#38bdf8',

  health: '#ef4444',
  mana: '#0ea5e9',
  xp: '#c4b5fd',
  gold: '#facc15',

  // Item families (names and icon frames), in the colours of their auras (sprites/sculpt/aura.ts);
  // cursed and chaotic are lighter than their auras so the names read on the menu cards.
  rarityCursed: '#f4554a',
  rarityHexed: '#c8b432',
  rarityUnholy: '#7c9a2e',
  rarityChaotic: '#b86cf0',
  rarityEnchanted: '#6aa6ff',
  rarityBlessed: '#e0a83a',
  rarityHoly: '#fff1c8',
  rarityArtifact: '#e07a2a',

  // Cinzel for titles, tab labels and names; body text and numbers stay monospace.
  fontDisplay: '"Cinzel", Georgia, serif',
  fontFaces: [
    { family: 'Cinzel', src: CINZEL_LATIN_WOFF2, weight: '400 900', unicodeRange: LATIN_RANGE },
    { family: 'Cinzel', src: CINZEL_LATIN_EXT_WOFF2, weight: '400 900', unicodeRange: LATIN_EXT_RANGE },
  ],
  fontBody: '"Courier New", Courier, monospace',
  fontNum: '"Courier New", Courier, monospace',
  radius: '2px',
  // Vellum codex leaves for the books of lore (Q62 "A: vellum", tracker 4.8).
  borderStyle: 'parchment',
};
