/** Visual theme tokens for manifest-driven UI theming. Engine-owned type. */
export interface ThemeTokens {
  bg: string;
  panel: string;
  borderLight: string;
  borderDark: string;
  text: string;
  titlebarStart: string;
  titlebarEnd: string;
  titlebarText: string;
  accent: string;
  fontFamily?: string;
  borderStyle?: 'bevel' | 'flat' | 'parchment';

  // Extended / Canvas viewport & overlay tokens (optional, with intelligent fallbacks)
  canvasBg?: string;
  hudBg?: string;
  hudBorder?: string;
  hudText?: string;
  hudAccent?: string;
  modalBg?: string;
  modalBorder?: string;
  modalTitlebar?: string;
  modalTitlebarText?: string;
  modalBackdrop?: string;
  cardBg?: string;
  cardBorder?: string;
  textMuted?: string;
  healthBar?: string;
  manaBar?: string;
}
