import type { CompanionDefinition } from '../../engine';

/**
 * Each companion grows with the hero's level (`growthPerLevel`; owner 2026-10-07, R-cotw-18),
 * about the hero's own +5 HP a level, so one given on floor 25 is no longer a one-hit kill
 * there. The Frost-Ward Hound takes blows, the Ember-Fang Wolf deals them. At hero level
 * 25 / 50 (HP, attack, defense): Frost-Ward Hound 146, 14, 17 / 271, 24, 30; Ember-Fang Wolf
 * 118, 28, 8 / 218, 48, 14.
 *
 * These are the only companions: the Oath (`choices.ts`'s `oath_hearth` choice) grants exactly
 * one via `grantCompanion`, never both (owner, 10 Oct). Support/utility vs. offense mirrors the
 * honor/break branches' own attack-vs-defense tradeoff.
 */
export const COTW_COMPANIONS: CompanionDefinition[] = [
  {
    id: 'hearth_frost_hound',
    name: 'Frost-Ward Hound',
    stats: { hp: 26, maxHp: 26, attack: 4, defense: 5 },
    growthPerLevel: { hp: 5, attack: 0.4, defense: 0.5 },
    speed: 100,
    packWeightCapacity: 10000,
    packBulkCapacity: 8000,
  },
  {
    id: 'ember_fang_wolf',
    name: 'Ember-Fang Wolf',
    stats: { hp: 22, maxHp: 22, attack: 9, defense: 2 },
    growthPerLevel: { hp: 4, attack: 0.8, defense: 0.25 },
    speed: 130,
    packWeightCapacity: 8000,
    packBulkCapacity: 6000,
  },
];
