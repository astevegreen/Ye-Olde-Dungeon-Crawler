import type { PixelSprite } from '../../../engine';
import { bake, type Model } from './sculpt/kit';
import type { FamilyVariant } from './sculpt/family';
import { houndModel } from './sculpt/hound';
import { mimirModel } from './sculpt/mimir';
import { ranvildModel } from './sculpt/ranvild';
import { guntherModel } from './sculpt/gunther';
import { ivaldaModel } from './sculpt/ivalda';
import { olafModel } from './sculpt/olaf';
import { astridModel } from './sculpt/astrid';
import { torvaldModel } from './sculpt/torvald';
import { haakonModel } from './sculpt/haakon';
import { bjornModel } from './sculpt/bjorn';
import { thrainModel } from './sculpt/thrain';

/** Every companion and townsfolk model idles over four frames. */
const ALLY_FRAMES = 4;

const sculpted = <V extends FamilyVariant>(model: Model<V>, variant?: V): PixelSprite => ({
  frames: ALLY_FRAMES,
  render: (frame, size) => bake(model, { frame, px: size, variant }),
});

/**
 * The companion hounds, keyed by companion definition id. Each wears the kin-mark (a collar
 * with a glowing gold rune-tag) and stands calm, so it reads as yours without a marker; without
 * these both draw as the enemy wolf.
 */
export const COTW_COMPANION_SPRITES: Record<string, PixelSprite> = {
  hearth_frost_hound: sculpted(houndModel, { kind: 'frost' }),
  ember_fang_wolf: sculpted(houndModel, { kind: 'ember' }),
};

/**
 * The townsfolk, keyed by NPC id: each named NPC is its own drawing, with the trade in hand.
 * Without these they share six role sprites, and Ivalda borrows the dwarf. Mimir, Ranvild,
 * Gunther and Ivalda come from the style bible; the other six were drawn new in its style.
 */
export const COTW_TOWNSFOLK_SPRITES: Record<string, PixelSprite> = {
  'npc-sage': sculpted(mimirModel),
  'npc-trainer': sculpted(ranvildModel),
  'npc-gunther': sculpted(guntherModel),
  'npc-ivalda': sculpted(ivaldaModel),
  'npc-olaf': sculpted(olafModel),
  'npc-astrid': sculpted(astridModel),
  'npc-priest': sculpted(torvaldModel),
  'npc-banker': sculpted(haakonModel),
  'npc-guard': sculpted(bjornModel),
  'npc-rune-smith': sculpted(thrainModel),
};
