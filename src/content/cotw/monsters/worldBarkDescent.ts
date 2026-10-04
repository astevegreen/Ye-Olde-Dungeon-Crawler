import type { MonsterDefinition } from '../../../engine';
import { itemDrop } from '../items/makeItem';
import { coinDrop } from '../coinage';

export const WORLD_BARK_MONSTERS: MonsterDefinition[] = [
  {
    id: 'amber_sap_weeper',
    name: 'Amber Sap-Weeper',
    minFloor: 34,
    stats: { hp: 95, maxHp: 95, attack: 18, defense: 9 },
    speed: 80,
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    hooks: [
      {
        event: 'onMove',
        chance: 0.8,
        action: { type: 'spawnSurface', surfaceType: 'mud', radius: 1, duration: 4 },
        description: 'Amber Sap-Weeper leaves a trail of thick sticky resin!',
      },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 360,
    tags: ['beast', 'insect'],
    lootTable: [
      {
        chance: 0.8,
        generate: coinDrop(1),
      },
    ],
  },
  {
    id: 'yggdrasil_parasite',
    name: 'Yggdrasil Parasite',
    minFloor: 34,
    stats: { hp: 35, maxHp: 35, attack: 12, defense: 4 },
    speed: 110,
    aiType: 'melee',
    resistances: { poison: 'resistant', fire: 'weak' },
    fleeHealthPercent: 0.1,
    xpValue: 70,
    tags: ['parasite', 'vermin', 'fodder'],
    lootTable: [
      {
        chance: 0.6,
        generate: coinDrop(0.5),
      },
    ],
  },
  {
    id: 'root_bound_berserker',
    name: 'Root-Bound Berserker',
    minFloor: 36,
    stats: { hp: 120, maxHp: 120, attack: 22, defense: 7 },
    speed: 90,
    aiType: 'brute',
    statusImmunities: ['paralysis', 'slow'],
    resistances: { physical: 'resistant', cold: 'resistant', fire: 'weak' },
    fleeHealthPercent: 0.0,
    xpValue: 420,
    tags: ['undead', 'warrior', 'elite'],
    lootTable: [
      {
        chance: 0.85,
        generate: coinDrop(1.25),
      },
      itemDrop(0.35, 'chainmail'),
    ],
  },
  {
    id: 'rotwood_crawler',
    name: 'Rotwood Crawler',
    minFloor: 37,
    stats: { hp: 80, maxHp: 80, attack: 19, defense: 6 },
    speed: 105,
    aiType: 'melee',
    resistances: { poison: 'immune', fire: 'weak' },
    onHitAffliction: {
      type: 'poison',
      chance: 0.4,
      duration: 5,
      potency: 3,
    },
    fleeHealthPercent: 0.0,
    xpValue: 380,
    tags: ['insect', 'vermin'],
    lootTable: [
      {
        chance: 0.75,
        generate: coinDrop(0.75),
      },
      itemDrop(0.3, 'cure_poison_potion'),
    ],
  },
  {
    id: 'ividja',
    name: 'Iviðja',
    minFloor: 38,
    stats: { hp: 130, maxHp: 130, attack: 20, defense: 8 },
    speed: 95,
    aiType: 'caster',
    spells: ['slow', 'paralyze'],
    spellCooldown: 2,
    telegraphedAbility: {
      requiresSpellId: 'paralyze',
      name: 'Grasping Roots',
      message: 'Iviðja commands the taproots beneath your feet, preparing Grasping Roots!',
      pattern: 'blast',
      range: 6,
      radius: 1,
      multiplier: 2.2,
      element: 'arcane',
      chance: 0.4,
      cooldown: 3,
    },
    spellPreferences: [
      { spellId: 'paralyze', skipIfTargetHasStatus: 'paralysis', chance: 0.5 },
      { spellId: 'slow', skipIfTargetHasStatus: 'slow' },
    ],
    resistances: { cold: 'resistant', arcane: 'resistant', fire: 'weak' },
    statusImmunities: ['paralysis', 'slow'],
    fleeHealthPercent: 0.1,
    xpValue: 480,
    tags: ['troll_witch', 'elite', 'caster'],
    lootTable: [
      {
        chance: 1.0,
        generate: coinDrop(1.25),
      },
      itemDrop(0.5, 'mana_potion'),
      {
        chance: 0.4,
        generate: coinDrop(0.5),
      },
    ],
  },
];
