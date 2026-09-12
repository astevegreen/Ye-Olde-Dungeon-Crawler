import type { ThemeTokens } from '../engine';
export type { ThemeTokens };

export const COTW_THEME_TOKENS: Required<ThemeTokens> = {
  bg: '#0a0b10',
  panel: '#c0c0c0',
  borderLight: '#ffffff',
  borderDark: '#404040',
  text: '#000000',
  titlebarStart: '#000080',
  titlebarEnd: '#1084d0',
  titlebarText: '#ffffff',
  accent: '#3b82f6',
  fontFamily: '"Courier New", Courier, "MS Sans Serif", monospace',
  borderStyle: 'bevel',

  // Canvas Viewport & Overlays Tokens
  canvasBg: '#07080d',
  hudBg: '#11141e',
  hudBorder: '#252c3d',
  hudText: '#e2e8f0',
  hudAccent: '#38bdf8',
  modalBg: '#0f172a',
  modalBorder: '#38bdf8',
  modalTitlebar: '#1e293b',
  modalTitlebarText: '#38bdf8',
  modalBackdrop: 'rgba(2, 6, 23, 0.86)',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  textMuted: '#94a3b8',
  healthBar: '#10b981',
  manaBar: '#0284c7',
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
