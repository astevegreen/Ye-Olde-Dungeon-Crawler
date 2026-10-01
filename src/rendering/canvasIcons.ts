import type { SpriteAtlas } from './atlas/sprite-atlas';
import { UI_ICON_PREFIX, type UiIconName } from '../ui/icons';

/**
 * Pixel UI icons (src/ui/icons.ts) on the canvas: the overlays draw them beside their
 * text from the renderer's atlas, which holds the pack's `ui~<name>` recipes. An icon
 * the pack doesn't draw takes no space.
 */

let atlas: SpriteAtlas | undefined;

/** Set by CanvasRenderer when it builds its atlas. */
export function setIconAtlas(next: SpriteAtlas): void {
  atlas = next;
}

/** A run of text with icons in it, laid out left to right. */
export type IconTextPart = string | { icon: UiIconName };

function iconSize(ctx: CanvasRenderingContext2D): number {
  const px = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  return Math.round((px ? Number(px[1]) : 12) * 1.25);
}

function has(name: UiIconName): boolean {
  return atlas?.hasRecipe(UI_ICON_PREFIX + name) ?? false;
}

/** How wide the run is in the context's current font. */
export function measureIconText(ctx: CanvasRenderingContext2D, parts: IconTextPart[]): number {
  const size = iconSize(ctx);
  const gap = Math.round(size * 0.3);
  return parts.reduce((w, p) => w + (typeof p === 'string' ? ctx.measureText(p).width : has(p.icon) ? size + gap : 0), 0);
}

/**
 * Draws the run like `fillText` would draw its text: anchored by the context's textAlign
 * (left/start, center, right/end) and textBaseline (top, middle, bottom, alphabetic).
 * Icons are sized to the font.
 */
export function fillIconText(ctx: CanvasRenderingContext2D, parts: IconTextPart[], x: number, y: number): void {
  const size = iconSize(ctx);
  const gap = Math.round(size * 0.3);
  const total = measureIconText(ctx, parts);
  const align = ctx.textAlign;
  let cx = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x;
  const base = ctx.textBaseline;
  const iconTop = base === 'top' || base === 'hanging' ? y : base === 'middle' ? y - size / 2 : base === 'bottom' ? y - size : y - size * 0.8;
  ctx.save();
  ctx.textAlign = 'left';
  for (const part of parts) {
    if (typeof part === 'string') {
      ctx.fillText(part, cx, y);
      cx += ctx.measureText(part).width;
    } else if (has(part.icon) && atlas) {
      atlas.drawSprite(ctx, UI_ICON_PREFIX + part.icon, Math.round(cx), Math.round(iconTop), size);
      cx += size + gap;
    }
  }
  ctx.restore();
}

/** One icon centered on (cx, cy). Returns false when the pack doesn't draw it. */
export function drawIconCentered(ctx: CanvasRenderingContext2D, name: UiIconName, cx: number, cy: number, size: number): boolean {
  if (!has(name) || !atlas) return false;
  atlas.drawSprite(ctx, UI_ICON_PREFIX + name, Math.round(cx - size / 2), Math.round(cy - size / 2), size);
  return true;
}
