import type { SpriteAtlas } from './atlas/sprite-atlas';
import { UI_ICON_PREFIX, type UiIconName } from '../ui/icons';

/**
 * Pixel UI icons (src/ui/icons.ts) drawn on the map itself (the radial menu, the mouse
 * cursor's attack mark), from the renderer's atlas, which holds the pack's `ui~<name>`
 * recipes. The cards over the map are DOM and use iconHtml(). An icon the pack doesn't
 * draw is not drawn.
 */

let atlas: SpriteAtlas | undefined;

/** Set by CanvasRenderer when it builds its atlas. */
export function setIconAtlas(next: SpriteAtlas): void {
  atlas = next;
}

function has(name: UiIconName): boolean {
  return atlas?.hasRecipe(UI_ICON_PREFIX + name) ?? false;
}

/** One icon centered on (cx, cy). Returns false when the pack doesn't draw it. */
export function drawIconCentered(ctx: CanvasRenderingContext2D, name: UiIconName, cx: number, cy: number, size: number): boolean {
  if (!has(name) || !atlas) return false;
  atlas.drawSprite(ctx, UI_ICON_PREFIX + name, Math.round(cx - size / 2), Math.round(cy - size / 2), size);
  return true;
}
