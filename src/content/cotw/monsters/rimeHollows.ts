import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';

export const RIME_HOLLOWS_MONSTERS: MonsterDefinition[] = [
  {
    id: 'hoarfrost_skraeling',
    name: 'Hoarfrost Skraeling',
    minFloor: 2,
    stats: { hp: 16, maxHp: 16, attack: 4, defense: 2 },
    speed: 105,
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    fleeHealthPercent: 0.15,
    xpValue: 25,
    tags: ['goblinoid', 'pack'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 12) + 6),
      },
      {
        chance: 0.25,
        generate: (id) => ItemFactory.createDagger(id),
      },
      {
        chance: 0.15,
        generate: (id) => ItemFactory.createWoodenShield(id),
      },
    ],
  },
  {
    id: 'brim_howler',
    name: 'Brim-Howler',
    minFloor: 4,
    stats: { hp: 22, maxHp: 22, attack: 7, defense: 2 },
    speed: 125,
    aiType: 'caster',
    targetingMode: 'nearest_hostile',
    resistances: { cold: 'resistant', fire: 'weak' },
    spells: ['slow'],
    telegraphedAbility: {
      requiresSpellId: 'slow',
      name: 'Freezing Mist Cone',
      message: 'The {monster} exhales a chilling fog, preparing a Freezing Mist Cone!',
      pattern: 'cone',
      range: 3,
      radius: 2,
      multiplier: 1.8,
      element: 'cold',
      chance: 0.4,
      cooldown: 3,
    },
    spellPreferences: [
      { spellId: 'slow', skipIfTargetHasStatus: 'slow' },
    ],
    fleeHealthPercent: 0.15,
    xpValue: 45,
    tags: ['beast', 'pack'],
    lootTable: [
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 16) + 8),
      },
      {
        chance: 0.2,
        generate: (id) => ItemFactory.createLeatherArmor(id),
      },
    ],
  },
  {
    id: 'glacier_borer',
    name: 'Glacier-Borer',
    minFloor: 5,
    stats: { hp: 32, maxHp: 32, attack: 9, defense: 5 },
    speed: 70,
    aiType: 'brute',
    statusImmunities: ['paralysis', 'blindness'],
    resistances: { cold: 'immune', fire: 'weak' },
    fleeHealthPercent: 0.0,
    xpValue: 50,
    tags: ['beast', 'hazard'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 20) + 10),
      },
    ],
  },
  {
    id: 'skratti',
    name: 'Skratti',
    minFloor: 2,
    stats: { hp: 8, maxHp: 8, attack: 2, defense: 1 },
    speed: 130,
    aiType: 'coward',
    resistances: { cold: 'resistant', fire: 'weak' },
    fleeHealthPercent: 0.8,
    xpValue: 12,
    tags: ['imp', 'fae', 'fodder'],
    lootTable: [
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createHealthPotion(id),
      },
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
      {
        chance: 0.4,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 8) + 4),
      },
    ],
  },
  {
    id: 'winter_hag',
    name: 'Winter Hag (Vetrarkona)',
    minFloor: 7,
    stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
    speed: 100,
    aiType: 'caster',
    spells: ['slow', 'cold_ray'],
    spellPreferences: [
      { spellId: 'slow', skipIfTargetHasStatus: 'slow', chance: 0.5 },
      { spellId: 'cold_ray' },
    ],
    resistances: { cold: 'immune', fire: 'weak' },
    onHitAffliction: {
      type: 'slow',
      chance: 0.4,
      duration: 4,
    },
    fleeHealthPercent: 0.3,
    xpValue: 60,
    tags: ['hag', 'humanoid', 'caster'],
    lootTable: [
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createScrollOfIdentify(id),
      },
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 25) + 15),
      },
    ],
  },
];
