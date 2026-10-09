import type { PixelSprite } from '../../../engine';
import { bake, type Model } from './sculpt/kit';
import type { FamilyVariant } from './sculpt/family';
import { draugrModel } from './sculpt/draugr';
import { ghostModel } from './sculpt/ghost';
import { wolfModel } from './sculpt/wolf';
import { verminModel } from './sculpt/vermin';
import { goblinModel } from './sculpt/goblin';
import { casterModel } from './sculpt/caster';
import { trollModel } from './sculpt/troll';
import { trollWifeModel } from './sculpt/trollWife';

/** Every family model idles over four frames. */
const FAMILY_FRAMES = 4;

const sculpted = (model: Model<FamilyVariant>, variant: FamilyVariant): PixelSprite => ({
  frames: FAMILY_FRAMES,
  render: (frame, size) => bake(model, { frame, px: size, variant }),
});

/**
 * The regular monsters, keyed by definition id. A family is one model; `kind` picks each
 * member's body and gear, `pal` recolours it, so no two definitions look the same. Monsters
 * not listed here still draw from the pack's tag rules.
 */
export const COTW_FAMILY_SPRITES: Record<string, PixelSprite> = {
  // the dead: four draugr, four restless spirits
  draugr_warrior: sculpted(draugrModel, { kind: 'warrior' }),
  draugr: sculpted(draugrModel, { kind: 'ancient' }),
  deep_lode_pit_draugr: sculpted(draugrModel, {
    kind: 'pit',
    pal: { mon1_rustMail: 'mon1_dustMail', mon1_corpse: 'mon1_corpseDust', mon1_beard: '#c8c0ae', mon1_shroud: '#5a5246' },
  }),
  prologue_coven_thrall: sculpted(draugrModel, { kind: 'thrall' }),
  myling: sculpted(ghostModel, { kind: 'myling' }),
  kirkegrim: sculpted(ghostModel, { kind: 'grim' }),
  root_wraith: sculpted(ghostModel, { kind: 'root' }),
  hel_warden: sculpted(ghostModel, { kind: 'warden' }),
  // beasts and vermin
  wolf: sculpted(wolfModel, { kind: 'wolf' }),
  prologue_rime_wolf: sculpted(wolfModel, { kind: 'rime' }),
  brim_howler: sculpted(wolfModel, { kind: 'brim' }),
  giant_rat: sculpted(verminModel, { kind: 'rat' }),
  glacier_borer: sculpted(verminModel, { kind: 'borer' }),
  rotwood_crawler: sculpted(verminModel, { kind: 'crawler' }),
  quicksilver_leech: sculpted(verminModel, { kind: 'leech' }),
  // goblins and casters
  kobold: sculpted(goblinModel, { kind: 'kobold' }),
  kobold_shaman: sculpted(goblinModel, { kind: 'shaman' }),
  goblin: sculpted(goblinModel, { kind: 'goblin' }),
  hoarfrost_skraeling: sculpted(goblinModel, { kind: 'skraeling' }),
  winter_hag: sculpted(casterModel, { kind: 'hag' }),
  dark_sorcerer: sculpted(casterModel, { kind: 'sorcerer' }),
  sol_brand_zealot: sculpted(casterModel, { kind: 'zealot' }),
  // trolls, giants and their kin
  cave_troll: sculpted(trollModel, { kind: 'troll' }),
  ogre: sculpted(trollModel, { kind: 'ogre' }),
  jotun_champion: sculpted(trollModel, { kind: 'jotun' }),
  fire_giant: sculpted(trollModel, { kind: 'fire' }),
  orc: sculpted(trollModel, { kind: 'orc' }),
  troll_wife_warlock: sculpted(trollWifeModel, { kind: 'warlock' }),
  prologue_coven_warlock: sculpted(trollWifeModel, { kind: 'coven' }),
  ironwood_troll_wife: sculpted(trollWifeModel, { kind: 'ironwood' }),
};
