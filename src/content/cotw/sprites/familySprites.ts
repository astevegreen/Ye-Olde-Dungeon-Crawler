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
import { huldraModel } from './sculpt/huldra';
import { faeModel } from './sculpt/fae';
import { boundSpiritModel } from './sculpt/boundSpirit';
import { constructModel } from './sculpt/construct';
import { slagModel } from './sculpt/slag';
import { fiendModel } from './sculpt/fiend';
import { weaverModel } from './sculpt/weaver';
import { drakeModel } from './sculpt/drake';

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
  // vættir and spirits
  huldra: sculpted(huldraModel, { kind: 'huldra' }),
  huldra_hollow_back: sculpted(huldraModel, { kind: 'old' }),
  fylgja: sculpted(huldraModel, { kind: 'fylgja' }),
  nacken: sculpted(huldraModel, { kind: 'nacken' }),
  nisse: sculpted(faeModel, { kind: 'nisse' }),
  skratti: sculpted(faeModel, { kind: 'skratti' }),
  captive_of_the_chariot: sculpted(boundSpiritModel, { kind: 'captive' }),
  choke_damp_phantasm: sculpted(boundSpiritModel, { kind: 'damp' }),
  // made things and the formless
  bark_husk_miner: sculpted(constructModel, { kind: 'husk' }),
  bellows_automaton: sculpted(constructModel, { kind: 'bellows' }),
  prismatic_mirror_skulker: sculpted(constructModel, { kind: 'mirror' }),
  slag_amorphous: sculpted(slagModel, {}),
  // fiends and horrors
  shadow_fiend: sculpted(fiendModel, { kind: 'shadow' }),
  garmling: sculpted(fiendModel, { kind: 'garm' }),
  nastrond_feaster: sculpted(fiendModel, { kind: 'feaster' }),
  malice_weaver: sculpted(weaverModel, {}),
  // drakes and wyrms
  frost_drake: sculpted(drakeModel, { kind: 'frost' }),
  ancient_wyrm: sculpted(drakeModel, { kind: 'ancient' }),
  grave_wyrmling: sculpted(drakeModel, { kind: 'grave' }),
};
