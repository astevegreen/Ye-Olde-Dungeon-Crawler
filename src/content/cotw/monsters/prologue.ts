import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { makeLootItem } from '../items/makeItem';

/**
 * The night raid's creatures (`prologue.ts`): placed by the prologue only, never drawn at
 * random, and weak enough for a level-1 hero with no giant blood yet (the town is floor 0).
 * The rime-wolf turns tail early, so a wounded one running out of reach is there to be
 * shot down with Magic Arrow; the warlocks stand at the fountain, lost in their rite.
 */
export const PROLOGUE_MONSTERS: MonsterDefinition[] = [
  {
    id: 'prologue_rime_wolf',
    name: 'Rime-Wolf',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 11, maxHp: 11, attack: 4, defense: 1 },
    speed: 105,
    aiType: 'melee',
    resistances: { cold: 'resistant' },
    fleeHealthPercent: 0.45,
    xpValue: 12,
    tags: ['beast'],
    lootTable: [],
  },
  {
    id: 'prologue_coven_thrall',
    name: 'Coven Thrall',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 14, maxHp: 14, attack: 5, defense: 2 },
    speed: 90,
    aiType: 'melee',
    resistances: { cold: 'resistant' },
    fleeHealthPercent: 0,
    xpValue: 15,
    tags: ['draugr', 'undead'],
    lootTable: [
      {
        chance: 0.5,
        generate: (id, rng) => makeLootItem('hearth_broth_flask', id, rng),
      },
    ],
  },
  {
    id: 'prologue_coven_warlock',
    name: 'Troll-Wife Warlock',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 12, maxHp: 12, attack: 3, defense: 1 },
    speed: 90,
    aiType: 'immobile_turret',
    resistances: { cold: 'resistant', fire: 'weak' },
    fleeHealthPercent: 0,
    xpValue: 25,
    tags: ['troll_witch'],
    lootTable: [
      {
        chance: 1,
        generate: (id) => ItemFactory.createGoldCoins(id, 15),
      },
    ],
  },
];
