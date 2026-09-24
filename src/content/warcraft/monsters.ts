import { ItemFactory } from '../../engine';
import type { MonsterDefinition } from '../../engine';
import { makeWarcraftItem } from './items';

export const WARCRAFT_MONSTERS: MonsterDefinition[] = [
  {
    id: 'peon',
    name: 'Orc Peon',
    minFloor: 1,
    stats: { hp: 12, maxHp: 12, attack: 4, defense: 1 },
    speed: 90,
    aiType: 'melee',
    fleeHealthPercent: 0.2,
    xpValue: 15,
    lootTable: [
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 10) + 5),
      },
    ],
  },
  {
    id: 'grunt',
    name: 'Orc Grunt',
    minFloor: 2,
    stats: { hp: 26, maxHp: 26, attack: 8, defense: 3 },
    speed: 100,
    aiType: 'melee',
    fleeHealthPercent: 0.15,
    xpValue: 40,
    lootTable: [
      {
        chance: 0.3,
        generate: (id) => makeWarcraftItem('broadsword', id, 2),
      },
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 20) + 10),
      },
    ],
  },
  {
    id: 'raider',
    name: 'Wolf Raider',
    minFloor: 3,
    stats: { hp: 35, maxHp: 35, attack: 11, defense: 4 },
    speed: 120,
    aiType: 'melee',
    fleeHealthPercent: 0.1,
    xpValue: 70,
    lootTable: [
      {
        chance: 0.4,
        generate: (id) => makeWarcraftItem('health_potion', id, 3),
      },
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 30) + 15),
      },
    ],
  },
  {
    id: 'ogre_mage',
    name: 'Ogre Mage',
    minFloor: 4,
    stats: { hp: 50, maxHp: 50, attack: 12, defense: 4 },
    speed: 95,
    aiType: 'caster',
    spells: ['fel_fireball'],
    fleeHealthPercent: 0.15,
    xpValue: 120,
    lootTable: [
      {
        chance: 0.5,
        generate: (id) => makeWarcraftItem('mana_potion', id, 4),
      },
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 50) + 25),
      },
    ],
  },
  {
    id: 'warchief_blackhand',
    name: 'Warchief Blackhand',
    minFloor: 5,
    stats: { hp: 120, maxHp: 120, attack: 18, defense: 7 },
    speed: 105,
    aiType: 'warchief',
    fleeHealthPercent: 0.0,
    xpValue: 500,
    lootTable: [
      {
        chance: 1.0,
        generate: (id) => ItemFactory.createGoldCoins(id, 250),
      },
    ],
  },
];
