import type { ThemeTokens } from '../../engine';

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

  fontDisplay: '"Courier New", Courier, monospace',
  fontBody: '"Courier New", Courier, monospace',
  fontNum: '"Courier New", Courier, monospace',
  radius: '2px',
  borderStyle: 'bevel',
};
