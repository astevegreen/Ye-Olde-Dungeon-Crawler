import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { makeLootItem } from '../items/makeItem';

/**
 * The night raid's creatures (`prologue.ts`): placed by the prologue only, never drawn at
 * random, and weak enough for a level-1 hero with no giant blood yet (the town is floor 0).
 * Their XP is token: a level gained mid-raid would heal the hero to full and offer points
 * to spend, both of which the raid's lessons (drink when hurt) are better without.
 * The rime-wolf turns tail early, so a wounded one running out of reach is there to be
 * shot down with Magic Arrow; the warlocks stand at the fountain, lost in their rite.
 */
export const PROLOGUE_MONSTERS: MonsterDefinition[] = [
  {
    id: 'prologue_rime_wolf',
    name: 'Rime-Wolf',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 11, maxHp: 11, attack: 10, defense: 1 },
    speed: 105,
    aiType: 'melee',
    resistances: { cold: 'resistant' },
    fleeHealthPercent: 0.45,
    xpValue: 4,
    tags: ['beast'],
    lootTable: [],
  },
  {
    id: 'prologue_coven_thrall',
    name: 'Coven Thrall',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 14, maxHp: 14, attack: 12, defense: 2 },
    speed: 90,
    aiType: 'melee',
    resistances: { cold: 'resistant' },
    fleeHealthPercent: 0,
    xpValue: 5,
    tags: ['draugr', 'undead'],
    lootTable: [
      {
        chance: 0.35,
        generate: (id, rng) => makeLootItem('hearth_broth_flask', id, rng),
      },
    ],
  },
  {
    id: 'prologue_coven_warlock',
    name: 'Troll-Wife Warlock',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 12, maxHp: 12, attack: 11, defense: 1 },
    speed: 90,
    aiType: 'cotw_coven_channeler', // prologue.ts
    resistances: { cold: 'resistant', fire: 'weak' },
    fleeHealthPercent: 0,
    xpValue: 6,
    tags: ['troll_witch'],
    lootTable: [
      {
        chance: 1,
        generate: (id) => ItemFactory.createGoldCoins(id, 15),
      },
    ],
  },
];
