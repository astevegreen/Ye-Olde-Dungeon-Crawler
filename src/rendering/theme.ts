import type { ThemeTokens } from '../engine';
export type { ThemeTokens };

export const COTW_THEME_TOKENS: Required<ThemeTokens> = {
  bg: '#0a0c14',
  panel: '#161a26',
  borderLight: '#3b455b',
  borderDark: '#0c0e17',
  text: '#f1f5f9',
  titlebarStart: '#1e2433',
  titlebarEnd: '#0f1420',
  titlebarText: '#fde047',
  accent: '#f59e0b',
  fontFamily: '"Courier New", Courier, monospace',
  borderStyle: 'bevel',

  // Canvas Viewport & Overlays Tokens
  canvasBg: '#07080d',
  hudBg: '#101420',
  hudBorder: '#2d3748',
  hudText: '#f8fafc',
  hudAccent: '#f59e0b',
  modalBg: '#0f131d',
  modalBorder: '#d97706',
  modalTitlebar: '#1a202c',
  modalTitlebarText: '#fde047',
  modalBackdrop: 'rgba(4, 6, 12, 0.88)',
  cardBg: '#181e2b',
  cardBorder: '#2d3748',
  textMuted: '#94a3b8',
  healthBar: '#ef4444',
  manaBar: '#0ea5e9',
};

export function resolveThemeTokens(tokens?: Partial<ThemeTokens>): Required<ThemeTokens> {
  const isFlat = tokens?.borderStyle === 'flat';
  return {
    bg: tokens?.bg ?? COTW_THEME_TOKENS.bg,
    panel: tokens?.panel ?? COTW_THEME_TOKENS.panel,
    borderLight: tokens?.borderLight ?? COTW_THEME_TOKENS.borderLight,
    borderDark: tokens?.borderDark ?? COTW_THEME_TOKENS.borderDark,
    text: tokens?.text ?? COTW_THEME_TOKENS.text,
    titlebarStart: tokens?.titlebarStart ?? COTW_THEME_TOKENS.titlebarStart,
    titlebarEnd: tokens?.titlebarEnd ?? COTW_THEME_TOKENS.titlebarEnd,
    titlebarText: tokens?.titlebarText ?? COTW_THEME_TOKENS.titlebarText,
    accent: tokens?.accent ?? COTW_THEME_TOKENS.accent,
    fontFamily: tokens?.fontFamily ?? COTW_THEME_TOKENS.fontFamily,
    borderStyle: tokens?.borderStyle ?? COTW_THEME_TOKENS.borderStyle,

    canvasBg: tokens?.canvasBg ?? tokens?.bg ?? COTW_THEME_TOKENS.canvasBg,
    hudBg: tokens?.hudBg ?? (isFlat ? (tokens?.bg ?? '#1c1917') : COTW_THEME_TOKENS.hudBg),
    hudBorder: tokens?.hudBorder ?? tokens?.borderDark ?? COTW_THEME_TOKENS.hudBorder,
    hudText: tokens?.hudText ?? (isFlat ? (tokens?.text ?? '#f5f5f4') : COTW_THEME_TOKENS.hudText),
    hudAccent: tokens?.hudAccent ?? tokens?.accent ?? COTW_THEME_TOKENS.hudAccent,
    modalBg: tokens?.modalBg ?? (isFlat ? (tokens?.panel ?? '#292524') : COTW_THEME_TOKENS.modalBg),
    modalBorder: tokens?.modalBorder ?? tokens?.accent ?? COTW_THEME_TOKENS.modalBorder,
    modalTitlebar: tokens?.modalTitlebar ?? tokens?.titlebarStart ?? COTW_THEME_TOKENS.modalTitlebar,
    modalTitlebarText: tokens?.modalTitlebarText ?? tokens?.titlebarText ?? COTW_THEME_TOKENS.modalTitlebarText,
    modalBackdrop: tokens?.modalBackdrop ?? COTW_THEME_TOKENS.modalBackdrop,
    cardBg: tokens?.cardBg ?? (isFlat ? (tokens?.bg ?? '#1c1917') : COTW_THEME_TOKENS.cardBg),
    cardBorder: tokens?.cardBorder ?? tokens?.borderDark ?? COTW_THEME_TOKENS.cardBorder,
    textMuted: tokens?.textMuted ?? COTW_THEME_TOKENS.textMuted,
    healthBar: tokens?.healthBar ?? COTW_THEME_TOKENS.healthBar,
    manaBar: tokens?.manaBar ?? COTW_THEME_TOKENS.manaBar,
  };
}

export function applyThemeTokens(tokens?: Partial<ThemeTokens>): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const merged = resolveThemeTokens(tokens);

  root.style.setProperty('--ui-bg', merged.bg);
  root.style.setProperty('--ui-panel', merged.panel);
  root.style.setProperty('--ui-border-light', merged.borderLight);
  root.style.setProperty('--ui-border-dark', merged.borderDark);
  root.style.setProperty('--ui-text', merged.text);
  root.style.setProperty('--ui-titlebar-start', merged.titlebarStart);
  root.style.setProperty('--ui-titlebar-end', merged.titlebarEnd);
  root.style.setProperty('--ui-titlebar-text', merged.titlebarText);
  root.style.setProperty('--ui-accent', merged.accent);
  if (merged.fontFamily) {
    root.style.setProperty('--ui-font-family', merged.fontFamily);
  }
}
