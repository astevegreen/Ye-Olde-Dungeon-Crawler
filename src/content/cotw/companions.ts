import type { CompanionDefinition } from '../../engine';

export const COTW_COMPANIONS: CompanionDefinition[] = [
  {
    id: 'battle_hound',
    name: 'Fenrir-kin Battle-Hound',
    stats: { hp: 30, maxHp: 30, attack: 6, defense: 2 },
    speed: 110,
    packWeightCapacity: 15000, // 15kg — a loyal pack-mule, lighter than the player's own pack
    packBulkCapacity: 12000, // 12L
  },
  /**
   * The Oath's two companions (ARCHITECTURE.md §3, `choices.ts`'s `oath_hearth`
   * choice grants exactly one via `grantCompanion`, never both). Support/utility vs.
   * offense mirrors the honor/break branches' own attack-vs-defense tradeoff.
   */
  {
    id: 'hearth_frost_hound',
    name: 'Frost-Ward Hound',
    stats: { hp: 26, maxHp: 26, attack: 4, defense: 5 },
    speed: 100,
    packWeightCapacity: 10000,
    packBulkCapacity: 8000,
  },
  {
    id: 'ember_fang_wolf',
    name: 'Ember-Fang Wolf',
    stats: { hp: 22, maxHp: 22, attack: 9, defense: 2 },
    speed: 130,
    packWeightCapacity: 8000,
    packBulkCapacity: 6000,
  },
];
