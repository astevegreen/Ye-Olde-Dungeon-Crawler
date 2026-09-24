import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { makeItem } from '../items/makeItem';

export const DWARVEN_WORKS_MONSTERS: MonsterDefinition[] = [
  {
    id: 'cinder_gilded_duergar',
    name: 'Cinder-Gilded Duergar',
    minFloor: 10,
    stats: { hp: 38, maxHp: 38, attack: 10, defense: 5 },
    speed: 90,
    aiType: 'melee',
    resistances: { fire: 'resistant', cold: 'weak' },
    onHitAffliction: {
      type: 'poison',
      chance: 0.35,
      duration: 4,
      potency: 2,
    },
    fleeHealthPercent: 0.1,
    xpValue: 90,
    tags: ['undead', 'dwarf', 'duergar'],
    lootTable: [
      {
        chance: 0.7,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 25) + 15),
      },
      {
        chance: 0.25,
        generate: (id, rng) => makeItem('cursed_mace', id, 1, rng),
      },
      {
        chance: 0.2,
        generate: (id, rng) => makeItem('iron_shield', id, 1, rng),
      },
    ],
  },
  {
    id: 'bellows_automaton',
    name: 'Bellows-Automaton',
    minFloor: 12,
    stats: { hp: 60, maxHp: 60, attack: 11, defense: 8 },
    speed: 70,
    aiType: 'brute',
    statusImmunities: ['poison', 'paralysis'],
    resistances: { fire: 'resistant', lightning: 'weak' },
    hooks: [
      {
        event: 'onDamageTaken',
        chance: 0.45,
        action: { type: 'applyStatus', status: 'blindness', duration: 3, target: 'target' },
        description: '✦ The Bellows-Automaton belches a blinding cloud of soot!',
      },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 130,
    tags: ['construct', 'hazard'],
    lootTable: [
      {
        chance: 0.8,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 40) + 20),
      },
      {
        chance: 0.3,
        generate: (id, rng) => makeItem('chest', id, 1, rng),
      },
    ],
  },
  {
    id: 'slag_amorphous',
    name: 'Slag Amorphous',
    minFloor: 13,
    stats: { hp: 45, maxHp: 45, attack: 8, defense: 3 },
    speed: 75,
    aiType: 'melee',
    resistances: { fire: 'resistant', cold: 'weak' },
    statusImmunities: ['poison', 'paralysis'],
    hooks: [
      {
        event: 'onTurnStart',
        chance: 0.5,
        action: { type: 'heal', amount: 4, target: 'self' },
        description: '✦ Slag Amorphous absorbs slag from the floor, mending its form!',
      },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 100,
    tags: ['amorphous', 'hazard'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 25) + 10),
      },
    ],
  },
  {
    id: 'haugbui',
    name: 'Haugbui',
    minFloor: 14,
    stats: { hp: 55, maxHp: 55, attack: 12, defense: 7 },
    speed: 85,
    aiType: 'melee',
    resistances: { physical: 'resistant', cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison', 'paralysis'],
    fleeHealthPercent: 0.0,
    xpValue: 140,
    tags: ['undead', 'dwarf', 'duergar', 'guardian'],
    lootTable: [
      {
        chance: 0.8,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 45) + 25),
      },
      {
        chance: 0.35,
        generate: (id, rng) => makeItem('iron_shield', id, 1, rng),
      },
      {
        chance: 0.25,
        generate: (id, rng) => makeItem('broadsword', id, 1, rng),
      },
    ],
  },
  {
    id: 'forge_wretch',
    name: 'Forge Wretch',
    minFloor: 10,
    stats: { hp: 16, maxHp: 16, attack: 6, defense: 1 },
    speed: 95,
    aiType: 'melee',
    statusImmunities: ['blindness'],
    fleeHealthPercent: 0.25,
    xpValue: 20,
    tags: ['dwarf', 'thrall', 'fodder'],
    lootTable: [
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 10) + 5),
      },
      {
        chance: 0.2,
        generate: (id, rng) => makeItem('dagger', id, 1, rng),
      },
    ],
  },
];
