import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { makeItem } from '../items/makeItem';

export const FOLKLORE_DETOUR_MONSTERS: MonsterDefinition[] = [
  {
    id: 'huldra_hollow_back',
    name: 'Huldra Hollow-Back',
    minFloor: 8,
    stats: { hp: 38, maxHp: 38, attack: 10, defense: 3 },
    speed: 105,
    aiType: 'caster',
    resistances: { arcane: 'resistant' },
    onHitAffliction: {
      type: 'slow',
      chance: 0.4,
      duration: 4,
    },
    spells: ['slow'],
    spellCooldown: 3,
    fleeHealthPercent: 0.3,
    xpValue: 130,
    tags: ['fae', 'spirit'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 50) + 20),
      },
      {
        chance: 0.3,
        generate: (id, rng) => makeItem('health_potion', id, 1, rng),
      },
    ],
  },
  {
    id: 'kirkegrim',
    name: 'Kirkegrim (Tomb-Vættir)',
    minFloor: 12,
    stats: { hp: 48, maxHp: 48, attack: 12, defense: 5 },
    speed: 95,
    aiType: 'melee',
    resistances: { cold: 'resistant', physical: 'resistant' },
    statusImmunities: ['poison', 'paralysis', 'blindness'],
    fleeHealthPercent: 0.0,
    xpValue: 140,
    tags: ['spectral', 'undead', 'guardian'],
    lootTable: [
      {
        chance: 0.7,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 40) + 20),
      },
      {
        chance: 0.25,
        generate: (id, rng) => makeItem('cursed_mace', id, 1, rng),
      },
    ],
  },
  {
    id: 'myling',
    name: 'Myling',
    minFloor: 10,
    stats: { hp: 14, maxHp: 14, attack: 3, defense: 1 },
    speed: 110,
    aiType: 'coward',
    resistances: { physical: 'resistant', cold: 'resistant' },
    onHitAffliction: {
      type: 'slow',
      chance: 0.5,
      duration: 3,
    },
    fleeHealthPercent: 0.5,
    xpValue: 30,
    tags: ['undead', 'spirit', 'ghost', 'hazard', 'fodder'],
    lootTable: [
      {
        chance: 0.4,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 15) + 5),
      },
    ],
  },
  {
    id: 'fylgja',
    name: 'Fylgja',
    minFloor: 15,
    stats: { hp: 45, maxHp: 45, attack: 8, defense: 4 },
    speed: 110,
    aiType: 'coward',
    resistances: { arcane: 'resistant', physical: 'resistant' },
    fleeHealthPercent: 0.4,
    xpValue: 80,
    tags: ['spirit', 'neutral', 'hazard'],
    lootTable: [
      {
        chance: 0.5,
        generate: (id, rng) => makeItem('scroll_identify', id, 1, rng),
      },
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 30) + 15),
      },
    ],
  },
  {
    id: 'nacken',
    name: 'Näcken',
    minFloor: 14,
    stats: { hp: 40, maxHp: 40, attack: 4, defense: 3 },
    speed: 100,
    aiType: 'immobile_turret',
    spells: ['slow'],
    resistances: { cold: 'immune', fire: 'weak' },
    hooks: [
      {
        event: 'onTurnStart',
        chance: 0.4,
        action: { type: 'applyStatus', status: 'slow', duration: 4, target: 'target' },
        description: "✦ Näcken's mournful fiddle echoes across the ice, mesmerizing you!",
      },
    ],
    fleeHealthPercent: 0.2,
    xpValue: 120,
    tags: ['fae', 'spirit', 'hazard'],
    lootTable: [
      {
        chance: 0.65,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 45) + 20),
      },
      {
        chance: 0.3,
        generate: (id, rng) => makeItem('mana_potion', id, 1, rng),
      },
    ],
  },
];
