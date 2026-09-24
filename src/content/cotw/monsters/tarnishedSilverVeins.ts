import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { makeItem } from '../items/makeItem';

export const SILVER_VEINS_MONSTERS: MonsterDefinition[] = [
  {
    id: 'quicksilver_leech',
    name: 'Quicksilver Leech',
    minFloor: 26,
    stats: { hp: 58, maxHp: 58, attack: 16, defense: 6 },
    speed: 115,
    aiType: 'melee',
    onHitAffliction: {
      type: 'poison',
      chance: 0.6,
      duration: 6,
      potency: 4,
    },
    statusImmunities: ['blindness'],
    resistances: { poison: 'immune', lightning: 'weak' },
    fleeHealthPercent: 0.0,
    xpValue: 240,
    tags: ['parasite', 'beast'],
    lootTable: [
      {
        chance: 0.75,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 70) + 30),
      },
      {
        chance: 0.35,
        generate: (id, rng) => makeItem('cure_poison_potion', id, 1, rng),
      },
    ],
  },
  {
    id: 'choke_damp_phantasm',
    name: 'Choke-Damp Phantasm',
    minFloor: 27,
    stats: { hp: 62, maxHp: 62, attack: 17, defense: 4 },
    speed: 100,
    aiType: 'melee',
    resistances: { physical: 'resistant', poison: 'immune', fire: 'weak' },
    statusImmunities: ['poison', 'paralysis'],
    hooks: [
      {
        event: 'onDamageTaken',
        chance: 0.35,
        action: { type: 'spawnGas', gasType: 'poison_cloud', radius: 1, duration: 4 },
        description: '✦ Choke-Damp Phantasm ruptures, discharging noxious mine gas!',
      },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 260,
    tags: ['spectral', 'hazard'],
    lootTable: [
      {
        chance: 0.7,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 80) + 40),
      },
      {
        chance: 0.35,
        generate: (id, rng) => makeItem('mana_potion', id, 1, rng),
      },
    ],
  },
  {
    id: 'deep_lode_pit_draugr',
    name: 'Deep-Lode Pit-Draugr',
    minFloor: 28,
    stats: { hp: 85, maxHp: 85, attack: 18, defense: 10 },
    speed: 80,
    aiType: 'brute',
    resistances: { cold: 'resistant', fire: 'weak', physical: 'resistant' },
    statusImmunities: ['poison', 'paralysis'],
    onHitAffliction: {
      type: 'slow',
      chance: 0.3,
      duration: 4,
    },
    fleeHealthPercent: 0.0,
    xpValue: 300,
    tags: ['undead', 'draugr'],
    lootTable: [
      {
        chance: 0.85,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 90) + 45),
      },
      {
        chance: 0.35,
        generate: (id, rng) => makeItem('chest', id, 1, rng),
      },
    ],
  },
  {
    id: 'silver_wight',
    name: 'Silver Wight',
    minFloor: 29,
    stats: { hp: 76, maxHp: 76, attack: 17, defense: 7 },
    speed: 95,
    aiType: 'melee',
    resistances: { cold: 'resistant', poison: 'immune' },
    statusImmunities: ['poison', 'paralysis'],
    fleeHealthPercent: 0.0,
    xpValue: 290,
    tags: ['undead', 'wight', 'guardian'],
    lootTable: [
      {
        chance: 0.8,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 100) + 50),
      },
      {
        chance: 0.3,
        generate: (id, rng) => makeItem('frost_blade', id, 1, rng),
      },
    ],
  },
  {
    id: 'nar',
    name: 'Nár',
    minFloor: 26,
    stats: { hp: 28, maxHp: 28, attack: 11, defense: 3 },
    speed: 85,
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison'],
    fleeHealthPercent: 0.0,
    xpValue: 60,
    tags: ['undead', 'zombie', 'fodder'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 30) + 10),
      },
    ],
  },
];
