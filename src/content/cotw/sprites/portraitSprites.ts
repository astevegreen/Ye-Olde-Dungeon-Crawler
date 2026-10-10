import type { PixelSprite } from '../../../engine';
import { bake, type Model } from './sculpt/kit';
import { PORTRAIT_GRID, draugrPortrait, mimirPortrait, nidhoggPortrait } from './sculpt/portraits';

/** Every portrait idles over four frames. */
const PORTRAIT_FRAMES = 4;

const portrait = (model: Model): PixelSprite => ({ frames: PORTRAIT_FRAMES, render: (frame, size) => bake(model, { frame, grid: PORTRAIT_GRID, px: size }) });

/**
 * Large painted portraits, keyed like the map sprites: the bestiary, the shop greeting and the
 * companion panel show these, and anyone without one keeps their map sprite.
 */
export const COTW_PORTRAITS: Record<string, PixelSprite> = {
  nidhogg: portrait(nidhoggPortrait),
  draugr: portrait(draugrPortrait),
  'npc-sage': portrait(mimirPortrait),
};
