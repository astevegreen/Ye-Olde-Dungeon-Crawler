import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';

export const OBSIDIAN_SIPHON_MONSTERS: MonsterDefinition[] = [
  {
    id: 'sol_brand_zealot',
    name: 'Sól-Brand Zealot',
    minFloor: 18,
    stats: { hp: 52, maxHp: 52, attack: 14, defense: 5 },
    speed: 100,
    aiType: 'melee',
    resistances: { fire: 'resistant', cold: 'weak' },
    fleeHealthPercent: 0.0,
    xpValue: 140,
    tags: ['zealot', 'humanoid'],
    lootTable: [
      {
        chance: 0.75,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 50) + 25),
      },
      {
        chance: 0.25,
        generate: (id) => ItemFactory.createBroadsword(id),
      },
    ],
  },
  {
    id: 'ironwood_troll_wife',
    name: 'Ironwood Troll-Wife',
    minFloor: 18,
    stats: { hp: 65, maxHp: 65, attack: 13, defense: 6 },
    speed: 95,
    aiType: 'caster',
    resistances: { cold: 'resistant', fire: 'weak' },
    onHitAffliction: {
      type: 'slow',
      chance: 0.4,
      duration: 5,
    },
    spells: ['slow', 'firebolt'],
    spellCooldown: 2,
    telegraphedAbility: {
      requiresSpellId: 'firebolt',
      name: 'Blood-Curse Siphon',
      message: 'The {monster} chants blood-curses through petrified black boughs, preparing Blood-Curse Siphon!',
      pattern: 'blast',
      range: 5,
      radius: 1,
      multiplier: 2.2,
      element: 'fire',
      spawnSurface: 'fire',
      chance: 0.4,
      cooldown: 2,
    },
    spellPreferences: [
      { spellId: 'slow', skipIfTargetHasStatus: 'slow', chance: 0.4 },
      { spellId: 'firebolt' },
    ],
    fleeHealthPercent: 0.2,
    xpValue: 250,
    tags: ['troll', 'elite', 'caster'],
    lootTable: [
      {
        chance: 0.8,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 70) + 35),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createFrostBlade(id),
      },
      {
        chance: 0.5,
        generate: (id) =>
          ItemFactory.createQuestRelic(
            id,
            'Shard of the Hearth-Tear',
            'A splinter of Sól’s stolen sun-chariot, still warm despite the permafrost. The warlocks siphoned its fire to freeze Járnviðr.'
          ),
      },
    ],
  },
  {
    id: 'prismatic_mirror_skulker',
    name: 'Prismatic Mirror-Skulker',
    minFloor: 20,
    stats: { hp: 35, maxHp: 35, attack: 18, defense: 4 },
    speed: 105,
    aiType: 'caster',
    resistances: { fire: 'immune', lightning: 'resistant' },
    statusImmunities: ['poison', 'paralysis'],
    spells: ['lightning_bolt'],
    telegraphedAbility: {
      requiresSpellId: 'lightning_bolt',
      name: 'Focused Solar Beam',
      message: 'The {monster} aligns quartz prisms, focusing a searing solar beam!',
      pattern: 'line',
      range: 6,
      radius: 0,
      multiplier: 2.5,
      element: 'lightning',
      chance: 0.5,
      cooldown: 2,
    },
    fleeHealthPercent: 0.1,
    xpValue: 180,
    tags: ['construct', 'hazard'],
    lootTable: [
      {
        chance: 0.7,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 60) + 30),
      },
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createWandOfFireballs(id),
      },
    ],
  },
  {
    id: 'captive_of_the_chariot',
    name: 'Captive of the Chariot',
    minFloor: 22,
    stats: { hp: 80, maxHp: 80, attack: 16, defense: 8 },
    speed: 60,
    aiType: 'immobile_turret',
    resistances: { fire: 'immune', arcane: 'resistant' },
    statusImmunities: ['paralysis', 'poison', 'slow'],
    spells: ['firebolt'],
    telegraphedAbility: {
      requiresSpellId: 'firebolt',
      name: 'Light-Chain Sweep',
      message: 'The {monster} lashes with chains of solidified light, preparing Light-Chain Sweep!',
      pattern: 'blast',
      range: 4,
      radius: 2,
      multiplier: 2.2,
      element: 'fire',
      chance: 0.5,
      cooldown: 2,
    },
    fleeHealthPercent: 0.0,
    xpValue: 220,
    tags: ['spirit', 'hazard'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 100) + 50),
      },
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createPlatinumCoins(id, 2),
      },
    ],
  },
  {
    id: 'glod',
    name: 'Glóð',
    minFloor: 21,
    stats: { hp: 75, maxHp: 75, attack: 15, defense: 6 },
    speed: 125,
    aiType: 'melee',
    resistances: { fire: 'immune', cold: 'weak' },
    statusImmunities: ['paralysis'],
    hooks: [
      {
        event: 'onMove',
        chance: 1.0,
        action: { type: 'spawnSurface', surfaceType: 'fire', radius: 1, duration: 3 },
        description: '✦ Glóð leaves scorching ember-tracks in its wake!',
      },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 260,
    tags: ['salamander', 'elite', 'beast'],
    lootTable: [
      {
        chance: 0.85,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 80) + 40),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createHealthPotion(id),
      },
    ],
  },
];
