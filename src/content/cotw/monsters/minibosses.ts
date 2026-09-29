import { ItemFactory, createScaledItem } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { COTW_CATALOG_RECORD } from '../items';
import { makeLootItem } from '../items/makeItem';

export const MINIBOSS_MONSTERS: MonsterDefinition[] = [
  {
    id: 'miniboss_frost_warden',
    name: 'Gálmr the Frost-Warden',
    minFloor: 5,
    stats: { hp: 68, maxHp: 68, attack: 12, defense: 5 },
    speed: 95,
    aiType: 'caster',
    resistances: { cold: 'immune', fire: 'weak' },
    statusImmunities: ['paralysis', 'slow'],
    spells: ['cold_ray'],
    spellCooldown: 3,
    telegraphedAbility: {
      requiresSpellId: 'cold_ray',
      name: 'Rime Shockwave',
      message: 'Gálmr the Frost-Warden raises his rime-frosted maul, channeling a shattering Rime Shockwave!',
      pattern: 'blast',
      range: 5,
      radius: 2,
      multiplier: 2.2,
      element: 'cold',
      spawnSurface: 'shallow_water',
      chance: 0.45,
      cooldown: 3,
    },
    spellPreferences: [
      { spellId: 'cold_ray' },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 250,
    tags: ['jotun', 'humanoid', 'miniboss', 'boss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) =>
          createScaledItem(COTW_CATALOG_RECORD['brim_wolf_pelt_hood'], id, 5, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => makeLootItem('health_potion', id, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => makeLootItem('mana_potion', id, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 30) + 30),
      },
    ],
  },
  {
    id: 'miniboss_rot_matriarch',
    name: 'Svartr, the Taproot Matriarch',
    minFloor: 36,
    stats: { hp: 180, maxHp: 180, attack: 22, defense: 10 },
    speed: 90,
    aiType: 'caster',
    resistances: { poison: 'immune', cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison', 'paralysis'],
    spells: ['lightning_bolt'],
    spellCooldown: 2,
    fleeHealthPercent: 0.0,
    xpValue: 800,
    tags: ['undead', 'boss', 'miniboss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) =>
          createScaledItem(COTW_CATALOG_RECORD['rot_porous_cleaver'], id, 36, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 50) + 50),
      },
    ],
  },
  {
    id: 'miniboss_tar_abomination',
    name: 'Gloom-Tarr, the Bile-Drinker',
    minFloor: 44,
    stats: { hp: 250, maxHp: 250, attack: 25, defense: 14 },
    speed: 85,
    aiType: 'brute',
    resistances: { physical: 'resistant', fire: 'resistant' },
    statusImmunities: ['poison', 'slow'],
    fleeHealthPercent: 0.0,
    xpValue: 1100,
    tags: ['aberration', 'boss', 'miniboss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) =>
          createScaledItem(COTW_CATALOG_RECORD['nid_dripping_hauberk'], id, 44, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createPlatinumCoins(id, Math.floor(rng() * 5) + 5),
      },
    ],
  },
  {
    id: 'miniboss_maw_herald',
    name: 'Víðnir, Herald of the Wyrm',
    minFloor: 45,
    stats: { hp: 280, maxHp: 280, attack: 26, defense: 12 },
    speed: 100,
    aiType: 'caster',
    resistances: { poison: 'immune', cold: 'resistant', lightning: 'resistant' },
    statusImmunities: ['poison', 'paralysis', 'blindness'],
    spells: ['lightning_bolt', 'firebolt'],
    spellCooldown: 2,
    telegraphedAbility: {
      requiresSpellId: 'lightning_bolt',
      name: 'Wyrm-Fang Arc',
      message: 'Víðnir brandishes Níðhögg’s shed relic fang, channeling a lethal Wyrm-Fang Arc!',
      pattern: 'line',
      range: 6,
      radius: 0,
      multiplier: 2.5,
      element: 'poison',
      spawnSurface: 'acid_pool',
      chance: 0.4,
      cooldown: 2,
    },
    spellPreferences: [
      { spellId: 'lightning_bolt' },
      { spellId: 'firebolt' },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 1500,
    tags: ['dragon', 'boss', 'miniboss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) =>
          createScaledItem(COTW_CATALOG_RECORD['nidhogg_fang'], id, 45, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createPlatinumCoins(id, Math.floor(rng() * 12) + 8),
      },
    ],
  },
  {
    id: 'miniboss_marrow_eater',
    name: 'Sköll of the Void Bone',
    minFloor: 47,
    stats: { hp: 290, maxHp: 290, attack: 28, defense: 13 },
    speed: 105,
    aiType: 'melee',
    resistances: { cold: 'immune', physical: 'resistant' },
    statusImmunities: ['poison', 'paralysis', 'slow'],
    fleeHealthPercent: 0.0,
    xpValue: 1600,
    tags: ['undead', 'boss', 'miniboss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) =>
          createScaledItem(COTW_CATALOG_RECORD['marrow_gnawed_ring'], id, 47, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createPlatinumCoins(id, Math.floor(rng() * 15) + 10),
      },
    ],
  },
];
