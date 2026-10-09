import { greyColor, mixColor, shadeColor, withAlpha, type ThemeTokens } from '../theme';
import type { ContainerState } from '../atlas/fixture-art';

/** The theme roles the badge is drawn from. */
export type BadgeTheme = Pick<Required<ThemeTokens>, 'markerInk' | 'badgeWood' | 'gold' | 'look'>;

/**
 * The badge as a tiny pixel chest, one character a pixel: shut with a gold glint; lid up with
 * things inside; lid up and empty. Inks: w wood, W lit wood, k bands, L lid, l lid shade,
 * d the dark inside, g gold, G the glint.
 */
const BADGE: Record<ContainerState, readonly string[]> = {
  unopened: ['.......G.', 'WWWWWWGGG', 'wwwwww.G.', 'kkkgkkk..', 'wwwgwww..', 'wwwwwww..', 'kkkkkkk..'],
  opened: ['LLLLLLL..', 'lllllll..', 'dgdGdgd..', 'kkkkkkk..', 'wwwwwww..', 'wwwwwww..', 'kkkkkkk..'],
  empty: ['LLLLLLL..', 'lllllll..', 'ddddddd..', 'kkkkkkk..', 'wwwwwww..', 'wwwwwww..', 'kkkkkkk..'],
};

/** Each wood ink as a shade of `badgeWood`; an emptied chest's own, greyer ladder. */
const WOOD_SHADES = { w: 1, W: 1.3, k: 0.37, L: 0.73, l: 0.54, d: 0.09 } as const;
const SPENT_SHADES = { w: 1, W: 1.25, k: 0.47, L: 0.76, l: 0.6, d: 0.09 } as const;

/** The chest's inks for a state: warm wood and gold, or, once empty, all gone grey. */
export function containerBadgeInks(state: ContainerState, theme: BadgeTheme): Record<string, string> {
  if (state === 'empty') {
    const grey = greyColor(theme.badgeWood);
    const ink: Record<string, string> = {};
    for (const [ch, f] of Object.entries(SPENT_SHADES)) ink[ch] = shadeColor(grey, f);
    return { ...ink, g: ink.w, G: ink.W };
  }
  const ink: Record<string, string> = {};
  for (const [ch, f] of Object.entries(WOOD_SHADES)) ink[ch] = shadeColor(theme.badgeWood, f);
  return { ...ink, g: theme.gold, G: mixColor(theme.gold, theme.look, 0.8) };
}

/**
 * The top-right flag on a container drawn without its own state art: a little chest on a
 * dark plate whose corners are clipped like a pixel button. Sized by the cell, in whole
 * pixels of `cs / 32`.
 */
export function drawChestBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cs: number,
  state: ContainerState,
  theme: BadgeTheme
): void {
  const map = BADGE[state];
  const ink = containerBadgeInks(state, theme);
  const p = Math.max(1, Math.round(cs / 32));
  const cols = 9;
  const rows = map.length;
  const ix = Math.round(x + cs - (cols + 1) * p - p);
  const iy = Math.round(y + p * 2);
  ctx.save();
  ctx.fillStyle = withAlpha(theme.markerInk, 0.86);
  ctx.fillRect(ix - p, iy, (cols + 2) * p, rows * p);
  ctx.fillRect(ix, iy - p, cols * p, (rows + 2) * p);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ink[ch];
      ctx.fillRect(ix + c * p, iy + r * p, p, p);
    }
  }
  ctx.restore();
}
