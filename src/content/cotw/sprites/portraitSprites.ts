import type { PixelSprite } from '../../../engine';
import { bake, type Model } from './sculpt/kit';
import { PORTRAIT_GRID } from './sculpt/portraitKit';
import { mimirPortrait, nidhoggPortrait } from './sculpt/portraits';
import { covenThrallPortrait, draugrPortrait, draugrWarriorPortrait, pitDraugrPortrait } from './sculpt/portraitsDraugr';
import { kirkegrimPortrait, mylingPortrait, rootWraithPortrait } from './sculpt/portraitsRestless';
import { narPortrait, silverWightPortrait, skeletonPortrait } from './sculpt/portraitsWalkingDead';
import { brimHowlerPortrait, rimeWolfPortrait, wolfPortrait } from './sculpt/portraitsWolves';
import { giantRatPortrait, glacierBorerPortrait, quicksilverLeechPortrait, rotwoodCrawlerPortrait } from './sculpt/portraitsVermin';
import { chariotWardenPortrait, galmrPortrait, glodPortrait } from './sculpt/portraitsFrostFire';
import { berserkerPortrait, gloomTarrPortrait, svartrPortrait } from './sculpt/portraitsRot';
import { skollPortrait, vidnirPortrait, weaverPortrait } from './sculpt/portraitsMaw';
import { helWardenPortrait, ividjaPortrait, trollWifePortrait } from './sculpt/portraitsIronwoodHel';
import { astridPortrait, haakonPortrait, olafPortrait } from './sculpt/portraitsTraders';
import { guntherPortrait, ivaldaPortrait, thrainPortrait } from './sculpt/portraitsForge';
import { bjornPortrait, torvaldPortrait } from './sculpt/portraitsTempleGate';
import { emberWolfPortrait, frostHoundPortrait, ranvildPortrait } from './sculpt/portraitsKennel';

/** Every portrait idles over four frames. */
const PORTRAIT_FRAMES = 4;

/**
 * The near-black the art bible's sheets show portraits on. The baker keeps only each pixel's top
 * surface, so a translucent wisp (Gálmr's breath, the Chariot's heat, Gloom-Tarr's smoke) would
 * let the window show through: it is laid over this instead, as the approved sheet showed it.
 */
const BACKDROP = [0x0b, 0x0f, 0x14];

function opaque(px: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    if (a === 1) continue;
    for (let c = 0; c < 3; c++) px[i + c] = px[i + c] * a + BACKDROP[c] * (1 - a);
    px[i + 3] = 255;
  }
  return px;
}

const portrait = (model: Model): PixelSprite => ({ frames: PORTRAIT_FRAMES, render: (frame, size) => opaque(bake(model, { frame, grid: PORTRAIT_GRID, px: size })) });

/**
 * Large painted portraits, keyed like the map sprites: the bestiary, the shop greeting and the
 * companion panel show these, and anyone without one keeps their map sprite.
 */
export const COTW_PORTRAITS: Record<string, PixelSprite> = {
  nidhogg: portrait(nidhoggPortrait),
  draugr: portrait(draugrPortrait),
  // the townsfolk, each greeting in the shop dialog (Ivalda at her anvil in Gunther's armory)
  'npc-sage': portrait(mimirPortrait),
  'npc-olaf': portrait(olafPortrait),
  'npc-astrid': portrait(astridPortrait),
  'npc-banker': portrait(haakonPortrait),
  'npc-gunther': portrait(guntherPortrait),
  'npc-rune-smith': portrait(thrainPortrait),
  'npc-ivalda': portrait(ivaldaPortrait),
  'npc-priest': portrait(torvaldPortrait),
  'npc-guard': portrait(bjornPortrait),
  'npc-trainer': portrait(ranvildPortrait),
  // the Oath's two companions, in the companion panel
  hearth_frost_hound: portrait(frostHoundPortrait),
  ember_fang_wolf: portrait(emberWolfPortrait),
  // the bosses
  miniboss_frost_warden: portrait(galmrPortrait),
  sun_chariot_warden: portrait(chariotWardenPortrait),
  miniboss_tar_abomination: portrait(gloomTarrPortrait),
  miniboss_rot_matriarch: portrait(svartrPortrait),
  miniboss_maw_herald: portrait(vidnirPortrait),
  miniboss_marrow_eater: portrait(skollPortrait),
  glod: portrait(glodPortrait),
  ividja: portrait(ividjaPortrait),
  // the elites
  root_bound_berserker: portrait(berserkerPortrait),
  ironwood_troll_wife: portrait(trollWifePortrait),
  malice_weaver: portrait(weaverPortrait),
  hel_warden: portrait(helWardenPortrait),
  // the rank and file: the restless dead, the walking dead, the wolves, the draugr's kin, the vermin
  myling: portrait(mylingPortrait),
  kirkegrim: portrait(kirkegrimPortrait),
  root_wraith: portrait(rootWraithPortrait),
  skeleton: portrait(skeletonPortrait),
  nar: portrait(narPortrait),
  silver_wight: portrait(silverWightPortrait),
  wolf: portrait(wolfPortrait),
  prologue_rime_wolf: portrait(rimeWolfPortrait),
  brim_howler: portrait(brimHowlerPortrait),
  draugr_warrior: portrait(draugrWarriorPortrait),
  deep_lode_pit_draugr: portrait(pitDraugrPortrait),
  prologue_coven_thrall: portrait(covenThrallPortrait),
  giant_rat: portrait(giantRatPortrait),
  glacier_borer: portrait(glacierBorerPortrait),
  rotwood_crawler: portrait(rotwoodCrawlerPortrait),
  quicksilver_leech: portrait(quicksilverLeechPortrait),
};
