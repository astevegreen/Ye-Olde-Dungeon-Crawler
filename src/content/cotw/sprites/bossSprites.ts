import type { PixelSprite } from '../../../engine';
import { bake, type Model } from './sculpt/kit';
import { galmrModel } from './sculpt/galmr';
import { chariotWardenModel } from './sculpt/chariotWarden';
import { gloomTarrModel } from './sculpt/gloomTarr';
import { svartrModel } from './sculpt/svartr';
import { vidnirModel } from './sculpt/vidnir';
import { skollModel } from './sculpt/skoll';
import { nidhoggModel } from './sculpt/nidhogg';
import { glodModel } from './sculpt/glod';
import { ividjaModel } from './sculpt/ividja';

/** Every boss model idles over four frames. */
const BOSS_FRAMES = 4;

const sculpted = (model: Model): PixelSprite => ({ frames: BOSS_FRAMES, render: (frame, size) => bake(model, { frame, px: size }) });

/**
 * The bosses and named elites, each its own sculpted, hearth-lit drawing that fills the cell,
 * keyed by monster definition id; without these every boss and miniboss shares the giant.
 */
export const COTW_BOSS_SPRITES: Record<string, PixelSprite> = {
  miniboss_frost_warden: sculpted(galmrModel),
  sun_chariot_warden: sculpted(chariotWardenModel),
  miniboss_tar_abomination: sculpted(gloomTarrModel),
  miniboss_rot_matriarch: sculpted(svartrModel),
  miniboss_maw_herald: sculpted(vidnirModel),
  miniboss_marrow_eater: sculpted(skollModel),
  nidhogg: sculpted(nidhoggModel),
  glod: sculpted(glodModel),
  ividja: sculpted(ividjaModel),
};
