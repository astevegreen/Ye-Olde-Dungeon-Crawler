import type { GameContentManifest, ThemeFontFace, ThemeTokens } from '../engine';
export type { ThemeTokens };

/**
 * The neutral defaults every pack starts from (ADR-0011): a slate surface ladder with an
 * amber accent. A pack's `manifest.theme` overrides any of them; nothing here names a pack.
 * This module and `src/ui/styles/tokens.css` are the only presentation files allowed to
 * hold color literals (`check:ui-palette`).
 */
export const DEFAULT_THEME_TOKENS: Required<ThemeTokens> = {
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

  rarityCursed: '#ef4444',
  rarityHexed: '#f97316',
  rarityUnholy: '#0d9488',
  rarityHoly: '#fbbf24',
  rarityEnchanted: '#c084fc',
  rarityBlessed: '#38bdf8',
  rarityChaotic: '#e879f9',
  rarityArtifact: '#b45309',
  coinCopper: '#cd7f32',
  coinSilver: '#e2e8f0',
  coinGold: '#ffd700',

  fontDisplay: '"Courier New", Courier, monospace',
  fontBody: '"Courier New", Courier, monospace',
  fontNum: '"Courier New", Courier, monospace',
  fontFaces: [],
  radius: '2px',
  borderStyle: 'bevel',

  // Older names: derived from the roles in resolveThemeTokens(); listed so the object is
  // complete as a Required<ThemeTokens>.
  bg: '#0a0c14',
  panel: '#161a26',
  borderLight: '#3b455b',
  borderDark: '#0a0c14',
  titlebarStart: '#1c2433',
  titlebarEnd: '#161a26',
  titlebarText: '#fde047',
  fontFamily: '"Courier New", Courier, monospace',
  canvasBg: '#05070c',
  hudBg: '#161a26',
  hudBorder: '#252e40',
  hudText: '#f8fafc',
  hudAccent: '#f59e0b',
  modalBg: '#161a26',
  modalBorder: '#d97706',
  modalTitlebar: '#1c2433',
  modalTitlebarText: '#fde047',
  modalBackdrop: 'rgba(4, 6, 12, 0.88)',
  cardBg: '#1c2433',
  cardBorder: '#252e40',
  healthBar: '#ef4444',
  manaBar: '#0ea5e9',
};

/**
 * Fills every token. Roles come from the pack, then from the pack's older names where it
 * only set those, then from the defaults; the older names are derived from the roles.
 */
export function resolveThemeTokens(tokens?: Partial<ThemeTokens>): Required<ThemeTokens> {
  const t = tokens ?? {};
  const D = DEFAULT_THEME_TOKENS;

  const surface0 = t.surface0 ?? t.bg ?? D.surface0;
  const surface1 = t.surface1 ?? t.panel ?? D.surface1;
  const surface2 = t.surface2 ?? t.cardBg ?? D.surface2;
  const surface3 = t.surface3 ?? t.canvasBg ?? D.surface3;
  const line = t.line ?? t.cardBorder ?? t.hudBorder ?? D.line;
  const lineStrong = t.lineStrong ?? t.borderLight ?? D.lineStrong;
  const accent = t.accent ?? D.accent;
  const frame = t.frame ?? t.modalBorder ?? D.frame;
  const text = t.text ?? D.text;
  const title = t.title ?? t.titlebarText ?? D.title;
  const health = t.health ?? t.healthBar ?? D.health;
  const mana = t.mana ?? t.manaBar ?? D.mana;
  const fontBody = t.fontBody ?? t.fontFamily ?? D.fontBody;
  const fontDisplay = t.fontDisplay ?? fontBody;

  return {
    surface0,
    surface1,
    surface2,
    surface3,
    line,
    lineStrong,
    frame,
    text,
    textSoft: t.textSoft ?? D.textSoft,
    textMuted: t.textMuted ?? D.textMuted,
    textFaint: t.textFaint ?? D.textFaint,
    title,
    accent,
    accentInk: t.accentInk ?? D.accentInk,
    good: t.good ?? D.good,
    warn: t.warn ?? D.warn,
    bad: t.bad ?? D.bad,
    info: t.info ?? D.info,
    health,
    mana,
    xp: t.xp ?? D.xp,
    gold: t.gold ?? D.gold,
    rarityCursed: t.rarityCursed ?? D.rarityCursed,
    rarityHexed: t.rarityHexed ?? D.rarityHexed,
    rarityUnholy: t.rarityUnholy ?? D.rarityUnholy,
    rarityHoly: t.rarityHoly ?? D.rarityHoly,
    rarityEnchanted: t.rarityEnchanted ?? D.rarityEnchanted,
    rarityBlessed: t.rarityBlessed ?? D.rarityBlessed,
    rarityChaotic: t.rarityChaotic ?? D.rarityChaotic,
    rarityArtifact: t.rarityArtifact ?? D.rarityArtifact,
    coinCopper: t.coinCopper ?? D.coinCopper,
    coinSilver: t.coinSilver ?? D.coinSilver,
    coinGold: t.coinGold ?? D.coinGold,
    fontDisplay,
    fontBody,
    fontNum: t.fontNum ?? D.fontNum,
    fontFaces: t.fontFaces ?? D.fontFaces,
    radius: t.radius ?? D.radius,
    borderStyle: t.borderStyle ?? D.borderStyle,

    bg: t.bg ?? surface0,
    panel: t.panel ?? surface1,
    borderLight: t.borderLight ?? lineStrong,
    borderDark: t.borderDark ?? surface0,
    titlebarStart: t.titlebarStart ?? surface2,
    titlebarEnd: t.titlebarEnd ?? surface1,
    titlebarText: t.titlebarText ?? title,
    fontFamily: t.fontFamily ?? fontBody,
    canvasBg: t.canvasBg ?? surface3,
    hudBg: t.hudBg ?? surface1,
    hudBorder: t.hudBorder ?? line,
    hudText: t.hudText ?? text,
    hudAccent: t.hudAccent ?? accent,
    modalBg: t.modalBg ?? surface1,
    modalBorder: t.modalBorder ?? frame,
    modalTitlebar: t.modalTitlebar ?? surface2,
    modalTitlebarText: t.modalTitlebarText ?? title,
    modalBackdrop: t.modalBackdrop ?? D.modalBackdrop,
    cardBg: t.cardBg ?? surface2,
    cardBorder: t.cardBorder ?? line,
    healthBar: t.healthBar ?? health,
    manaBar: t.manaBar ?? mana,
  };
}

/**
 * Every token CSS reads, as `--ui-*` custom properties. The static scales (type, space,
 * layers, motion) that no pack changes live in `src/ui/styles/tokens.css`.
 */
export const THEME_CSS_VARIABLES: ReadonlyArray<readonly [string, keyof ThemeTokens]> = [
  ['--ui-surface-0', 'surface0'],
  ['--ui-surface-1', 'surface1'],
  ['--ui-surface-2', 'surface2'],
  ['--ui-surface-3', 'surface3'],
  ['--ui-line', 'line'],
  ['--ui-line-strong', 'lineStrong'],
  ['--ui-frame', 'frame'],
  ['--ui-text', 'text'],
  ['--ui-text-soft', 'textSoft'],
  ['--ui-text-muted', 'textMuted'],
  ['--ui-text-faint', 'textFaint'],
  ['--ui-title', 'title'],
  ['--ui-accent', 'accent'],
  ['--ui-accent-ink', 'accentInk'],
  ['--ui-good', 'good'],
  ['--ui-warn', 'warn'],
  ['--ui-bad', 'bad'],
  ['--ui-info', 'info'],
  ['--ui-health', 'health'],
  ['--ui-mana', 'mana'],
  ['--ui-xp', 'xp'],
  ['--ui-gold', 'gold'],
  ['--ui-rarity-cursed', 'rarityCursed'],
  ['--ui-rarity-hexed', 'rarityHexed'],
  ['--ui-rarity-unholy', 'rarityUnholy'],
  ['--ui-rarity-holy', 'rarityHoly'],
  ['--ui-rarity-enchanted', 'rarityEnchanted'],
  ['--ui-rarity-blessed', 'rarityBlessed'],
  ['--ui-rarity-chaotic', 'rarityChaotic'],
  ['--ui-rarity-artifact', 'rarityArtifact'],
  ['--ui-coin-copper', 'coinCopper'],
  ['--ui-coin-silver', 'coinSilver'],
  ['--ui-coin-gold', 'coinGold'],
  ['--ui-font-display', 'fontDisplay'],
  ['--ui-font-body', 'fontBody'],
  ['--ui-font-num', 'fontNum'],
  ['--ui-radius', 'radius'],
  // Older names still read by the Windows-era stylesheet (base.css).
  ['--ui-bg', 'bg'],
  ['--ui-panel', 'panel'],
  ['--ui-border-light', 'borderLight'],
  ['--ui-border-dark', 'borderDark'],
  ['--ui-titlebar-start', 'titlebarStart'],
  ['--ui-titlebar-end', 'titlebarEnd'],
  ['--ui-titlebar-text', 'titlebarText'],
  ['--ui-font-family', 'fontFamily'],
];

const loadedFaces = new Set<string>();

/**
 * Writes the pack's tokens onto the document root and loads the fonts it ships. Resolves
 * once those fonts are ready, so a caller can redraw the canvas in them.
 */
export function applyThemeTokens(tokens?: Partial<ThemeTokens>): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const root = document.documentElement;
  const merged = resolveThemeTokens(tokens);
  for (const [cssName, key] of THEME_CSS_VARIABLES) {
    root.style.setProperty(cssName, String(merged[key]));
  }
  // The pack's border style picks the codex material (menu.css, Q62).
  root.setAttribute?.('data-border-style', merged.borderStyle);
  return loadFontFaces(merged.fontFaces);
}

function loadFontFaces(faces: ThemeFontFace[]): Promise<void> {
  if (faces.length === 0 || typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve();
  const loads: Promise<unknown>[] = [];
  for (const face of faces) {
    const key = `${face.family}|${face.weight ?? ''}|${face.style ?? ''}|${face.unicodeRange ?? ''}`;
    if (loadedFaces.has(key)) continue;
    loadedFaces.add(key);
    const font = new FontFace(face.family, `url(${face.src})`, {
      weight: face.weight ?? 'normal',
      style: face.style ?? 'normal',
      ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
    });
    document.fonts.add(font);
    loads.push(font.load().catch((err: unknown) => console.warn(`[theme] font ${face.family} failed to load`, err)));
  }
  return Promise.all(loads).then(() => undefined);
}

/** The type scale in CSS pixels (ADR-0011). `xs` is the floor: nothing renders smaller. */
export const UI_TEXT_PX = { xs: 11, sm: 12, md: 13, lg: 15, xl: 18, '2xl': 22 } as const;
export type UiTextRole = keyof typeof UI_TEXT_PX;

/** CSS pixels per virtual canvas pixel; the viewport keeps it current. */
let canvasTextScale = 1;
/** The player's UI scale (tracker 4.5), the same factor the DOM is zoomed by. */
let uiTextScale = 1;

/** Sets the UI scale canvas text grows by (`src/ui/uiScale.ts`); 1 or more. */
export function setUiTextScale(scale: number): void {
  if (Number.isFinite(scale) && scale >= 1) uiTextScale = scale;
}

export function setCanvasTextScale(cssPerVirtualPx: number): void {
  if (Number.isFinite(cssPerVirtualPx) && cssPerVirtualPx > 0) canvasTextScale = cssPerVirtualPx;
}

/**
 * A canvas font string whose text renders at the role's size in CSS pixels, times the UI
 * scale, whatever the window size, so canvas text matches DOM text and never drops under the 11px floor.
 * Canvas draws in the 960×600 virtual space, which the viewport scales to the window.
 */
export function uiFont(
  role: UiTextRole,
  family: string,
  style: 'normal' | 'bold' | 'italic' | 'bold italic' = 'normal'
): string {
  const px = uiFontPx(role);
  // The canvas font shorthand puts the style before the weight.
  const prefix = style === 'normal' ? '' : style === 'bold italic' ? 'italic bold ' : `${style} `;
  return `${prefix}${px}px ${family}`;
}

/**
 * A color at the given opacity, for canvas drawing: canvas has no `color-mix`, so the
 * translucent shades CSS mixes from a role are made here. Hex colors (#rgb, #rrggbb,
 * #rrggbbaa, whose own alpha is replaced) become rgba(); any other color is returned as is.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return color;
  const rgb = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
  const n = parseInt(rgb, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The pack's color for a damage element (`manifest.affinityMatrix.elements[].color`), or
 * undefined when the pack gives none: element colors are pack data, like the roles.
 */
export function elementColor(manifest: GameContentManifest | undefined, element: string | undefined): string | undefined {
  if (!element) return undefined;
  return manifest?.affinityMatrix?.elements?.find((e) => e.id === element)?.color;
}

/** The size `uiFont` gives a role, in virtual canvas pixels: for boxes drawn around text. */
export function uiFontPx(role: UiTextRole): number {
  return Math.round(((UI_TEXT_PX[role] * uiTextScale) / canvasTextScale) * 10) / 10;
}
