/** A font a pack ships in its bundle (ADR-0011): `src` is a URL, usually an inlined data URL. */
export interface ThemeFontFace {
  family: string;
  src: string;
  /** A single weight ('700') or, for a variable font, a range ('400 900'). */
  weight?: string;
  style?: string;
  /** CSS unicode-range: the browser loads this file only for text that needs it. */
  unicodeRange?: string;
}

/**
 * Visual theme tokens for manifest-driven UI theming. Engine-owned type.
 *
 * The semantic role tokens (ADR-0011) are the primary vocabulary: presentation code names
 * roles — a surface level, a text level, the accent, a status — never hues, and a pack
 * reskins every screen by supplying them. Every field is optional; `resolveThemeTokens()`
 * (`src/rendering/theme.ts`) fills what a pack leaves out from a neutral default.
 */
export interface ThemeTokens {
  // Surfaces, darkest to raised: app background, window/panel body, card or raised row,
  // inset field (bar tracks, key chips, minimap well).
  surface0?: string;
  surface1?: string;
  surface2?: string;
  surface3?: string;
  /** Hairlines and card borders. */
  line?: string;
  /** Window frames and button borders. */
  lineStrong?: string;
  /** The pack's frame material: dialog borders and title bars. */
  frame?: string;

  // Text, strongest to weakest. `textMuted` holds 4.5:1 on surface1; `textFaint` is for
  // decoration only.
  text?: string;
  textSoft?: string;
  textMuted?: string;
  textFaint?: string;
  /** Headings and names. */
  title?: string;

  /** Selection, primary actions, focus. Never the same color as `bad`. */
  accent?: string;
  /** Text drawn on the accent. */
  accentInk?: string;
  good?: string;
  warn?: string;
  bad?: string;
  info?: string;
  /** The hero's side on the map: the brackets on a companion. Never the same color as `accent`. */
  ally?: string;

  // Resources.
  health?: string;
  mana?: string;
  xp?: string;
  gold?: string;

  // Item tones: what an identified item's name is colored by, its family first, then
  // artifact (`itemTone()` in src/ui/inventory/itemTone.ts picks one).
  rarityCursed?: string;
  rarityHexed?: string;
  rarityUnholy?: string;
  rarityHoly?: string;
  rarityEnchanted?: string;
  rarityBlessed?: string;
  rarityChaotic?: string;
  rarityArtifact?: string;
  // Coin stacks, by denomination.
  coinCopper?: string;
  coinSilver?: string;
  coinGold?: string;

  // Type and shape.
  fontDisplay?: string;
  fontBody?: string;
  /** Always a monospace with lining, tabular figures, so numbers read in every pack. */
  fontNum?: string;
  /** Fonts the pack inlines into its bundle; loaded before the faces above are used. */
  fontFaces?: ThemeFontFace[];
  radius?: string;
  borderStyle?: 'bevel' | 'flat' | 'parchment';

  // Older names, derived from the roles above when a pack leaves them out. Canvas
  // overlays still read them; new code uses the roles.
  bg?: string;
  panel?: string;
  borderLight?: string;
  borderDark?: string;
  titlebarStart?: string;
  titlebarEnd?: string;
  titlebarText?: string;
  fontFamily?: string;
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
  healthBar?: string;
  manaBar?: string;
}
