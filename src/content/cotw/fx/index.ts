import type { SpellFxCatalog } from '../../../engine';
import { ARCANE_FX } from './arcane';
import { BLOOD_FX } from './blood';
import { FIRE_FX } from './fire';
import { FROST_FX } from './frost';
import { HOLY_FX } from './holy';
import { LIGHTNING_FX } from './lightning';
import { MELEE_FX } from './melee';
import { POISON_FX } from './poison';
import { DRAIN_FX, SHADOW_FX } from './shadow';

/**
 * The pack's drawn spell and melee effects, from the style bible. Keyed by an effect's `fx`:
 * the engine's element names and the art's own names both resolve, so a spell may say
 * `cold` or `frost`. Physical has no entry (plain melee steel is the melee art's).
 */
export const COTW_SPELL_FX: SpellFxCatalog = {
  elements: {
    fire: FIRE_FX,
    cold: FROST_FX,
    frost: FROST_FX,
    lightning: LIGHTNING_FX,
    poison: POISON_FX,
    acid: POISON_FX,
    arcane: ARCANE_FX,
    healing: HOLY_FX,
    holy: HOLY_FX,
    shadow: SHADOW_FX,
    unholy: SHADOW_FX,
    blood: BLOOD_FX,
    drain: DRAIN_FX,
  },
  melee: MELEE_FX,
};
