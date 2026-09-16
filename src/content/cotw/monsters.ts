import {
  ItemFactory,
  MonsterRegistry,
} from '../../engine';
import type { MonsterDefinition } from '../../engine';

export const COTW_BESTIARY: Record<string, MonsterDefinition> = {
  // --- Tier 1 (Floors 1–4) ---
  giant_rat: {
    id: 'giant_rat',
    name: 'Giant Rat',
    minFloor: 1,
    stats: { hp: 8, maxHp: 8, attack: 4, defense: 1 },
    speed: 120,
    aiType: 'melee',
    resistances: { fire: 'weak', lightning: 'weak' },
    onHitAffliction: {
      type: 'poison',
      chance: 0.25,
      duration: 4,
      potency: 2,
    },
    fleeHealthPercent: 0.0,
    xpValue: 10,
    lootTable: [
      {
        chance: 0.4,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 6) + 1),
      },
      {
        chance: 0.15,
        generate: (id) => ItemFactory.createHealthPotion(id),
      },
    ],
  },
  kobold: {
    id: 'kobold',
    name: 'Kobold',
    minFloor: 1,
    stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
    speed: 110,
    aiType: 'coward',
    resistances: { cold: 'weak' },
    fleeHealthPercent: 0.25,
    xpValue: 15,
    lootTable: [
      {
        chance: 0.7,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 10) + 5),
      },
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createDagger(id),
      },
    ],
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    minFloor: 2,
    stats: { hp: 16, maxHp: 16, attack: 5, defense: 2 },
    speed: 105,
    aiType: 'melee',
    resistances: { fire: 'neutral' },
    fleeHealthPercent: 0.2,
    xpValue: 25,
    lootTable: [
      {
        chance: 0.65,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 15) + 10),
      },
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createWoodenShield(id),
      },
      {
        chance: 0.25,
        generate: (id) => ItemFactory.createDagger(id),
      },
    ],
  },

  // --- Tier 2 (Floors 5–11) ---
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    minFloor: 5,
    stats: { hp: 18, maxHp: 18, attack: 7, defense: 3 },
    speed: 90,
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison'],
    fleeHealthPercent: 0.0,
    xpValue: 35,
    tags: ['undead'],
    lootTable: [
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createBroadsword(id),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createWoodenShield(id),
      },
      {
        chance: 0.3,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 20) + 10),
      },
    ],
  },
  kobold_shaman: {
    id: 'kobold_shaman',
    name: 'Kobold Shaman',
    minFloor: 6,
    stats: { hp: 14, maxHp: 14, attack: 3, defense: 1 },
    speed: 100,
    aiType: 'caster',
    resistances: { cold: 'weak' },
    spells: ['firebolt', 'slow'],
    fleeHealthPercent: 0.3,
    xpValue: 50,
    lootTable: [
      {
        chance: 0.55,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
      {
        chance: 0.45,
        generate: (id) => ItemFactory.createScrollOfTeleport(id),
      },
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createWandOfFireballs(id),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createScrollOfIdentify(id),
      },
    ],
  },
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    minFloor: 7,
    stats: { hp: 22, maxHp: 22, attack: 8, defense: 2 },
    speed: 125,
    aiType: 'melee',
    resistances: { cold: 'resistant' },
    fleeHealthPercent: 0.15,
    xpValue: 45,
    // Pack hunters notice whichever prey is closest, including a companion
    // (ARCHITECTURE.md P-14 Phase 2 — opt-in, no effect on monsters that omit this).
    targetingMode: 'nearest_hostile',
    lootTable: [
      {
        chance: 0.5,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 15) + 5),
      },
      {
        chance: 0.2,
        generate: (id) => ItemFactory.createLeatherArmor(id),
      },
    ],
  },

  // --- Tier 3 (Floors 12–19) ---
  ogre: {
    id: 'ogre',
    name: 'Ogre',
    minFloor: 12,
    stats: { hp: 50, maxHp: 50, attack: 12, defense: 4 },
    speed: 75,
    aiType: 'brute',
    statusImmunities: ['paralysis'],
    fleeHealthPercent: 0.0,
    xpValue: 120,
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 50) + 40),
      },
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createIronChest(id),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createChainmail(id),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createFrostBlade(id),
      },
    ],
  },
  draugr_warrior: {
    id: 'draugr_warrior',
    name: 'Draugr Warrior',
    minFloor: 14,
    stats: { hp: 40, maxHp: 40, attack: 11, defense: 5 },
    speed: 85,
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison', 'paralysis'],
    onHitAffliction: {
      type: 'slow',
      chance: 0.25,
      duration: 5,
    },
    fleeHealthPercent: 0.0,
    xpValue: 95,
    tags: ['undead'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 35) + 20),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createCursedMace(id),
      },
      {
        chance: 0.25,
        generate: (id) => ItemFactory.createIronShield(id),
      },
    ],
  },
  draugr: {
    id: 'draugr',
    name: 'Ancient Draugr',
    minFloor: 14,
    stats: { hp: 40, maxHp: 40, attack: 11, defense: 5 },
    speed: 85,
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison', 'paralysis'],
    onHitAffliction: {
      type: 'slow',
      chance: 0.25,
      duration: 5,
    },
    fleeHealthPercent: 0.0,
    xpValue: 95,
    tags: ['undead'],
    lootTable: [
      {
        chance: 0.6,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 35) + 20),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createCursedMace(id),
      },
    ],
  },
  cave_troll: {
    id: 'cave_troll',
    name: 'Cave Troll',
    minFloor: 16,
    stats: { hp: 70, maxHp: 70, attack: 15, defense: 5 },
    speed: 80,
    aiType: 'brute',
    resistances: { fire: 'weak' },
    fleeHealthPercent: 0.0,
    xpValue: 160,
    lootTable: [
      {
        chance: 0.8,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 60) + 40),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createChainmail(id),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createIronHelmet(id),
      },
    ],
  },

  // --- Tier 4 (Floors 20–34) ---
  fire_giant: {
    id: 'fire_giant',
    name: 'Fire Giant',
    minFloor: 20,
    stats: { hp: 95, maxHp: 95, attack: 18, defense: 7 },
    speed: 85,
    aiType: 'brute',
    resistances: { fire: 'immune', cold: 'weak' },
    statusImmunities: ['paralysis'],
    fleeHealthPercent: 0.0,
    xpValue: 250,
    lootTable: [
      {
        chance: 0.9,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 100) + 50),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createBroadsword(id),
      },
    ],
  },
  frost_drake: {
    id: 'frost_drake',
    name: 'Frost Drake',
    minFloor: 24,
    stats: { hp: 85, maxHp: 85, attack: 17, defense: 8 },
    speed: 110,
    aiType: 'caster',
    resistances: { cold: 'immune', fire: 'weak' },
    spells: ['slow'],
    spellCooldown: 3,
    fleeHealthPercent: 0.1,
    xpValue: 300,
    lootTable: [
      {
        chance: 0.8,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 120) + 60),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createFrostBlade(id),
      },
      {
        chance: 0.3,
        generate: (id) => ItemFactory.createHealthPotion(id),
      },
    ],
  },
  dark_sorcerer: {
    id: 'dark_sorcerer',
    name: 'Dark Sorcerer',
    minFloor: 28,
    stats: { hp: 60, maxHp: 60, attack: 10, defense: 5 },
    speed: 100,
    aiType: 'caster',
    resistances: { lightning: 'resistant' },
    spells: ['firebolt', 'lightning_bolt', 'slow'],
    spellCooldown: 2,
    fleeHealthPercent: 0.25,
    xpValue: 350,
    lootTable: [
      {
        chance: 0.6,
        generate: (id) => ItemFactory.createWandOfFireballs(id),
      },
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createScrollOfTeleport(id),
      },
    ],
  },

  // --- Tier 5 (Floors 35–50) ---
  ancient_wyrm: {
    id: 'ancient_wyrm',
    name: 'Ancient Wyrm',
    minFloor: 35,
    stats: { hp: 140, maxHp: 140, attack: 22, defense: 10 },
    speed: 105,
    aiType: 'caster',
    resistances: { fire: 'resistant', cold: 'resistant' },
    statusImmunities: ['paralysis', 'poison'],
    spells: ['firebolt', 'lightning_bolt'],
    spellCooldown: 3,
    fleeHealthPercent: 0.0,
    xpValue: 500,
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 200) + 100),
      },
      {
        chance: 0.6,
        generate: (id) => ItemFactory.createFrostBlade(id),
      },
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createHealthPotion(id),
      },
    ],
  },
  jotun_champion: {
    id: 'jotun_champion',
    name: 'Jotun Champion',
    minFloor: 40,
    stats: { hp: 175, maxHp: 175, attack: 26, defense: 12 },
    speed: 90,
    aiType: 'brute',
    resistances: { cold: 'immune' },
    statusImmunities: ['paralysis'],
    fleeHealthPercent: 0.0,
    xpValue: 650,
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 250) + 150),
      },
      {
        chance: 0.6,
        generate: (id) => ItemFactory.createIronChest(id),
      },
      {
        chance: 0.4,
        generate: (id) => ItemFactory.createChainmail(id),
      },
    ],
  },
  shadow_fiend: {
    id: 'shadow_fiend',
    name: 'Shadow Fiend',
    minFloor: 45,
    stats: { hp: 130, maxHp: 130, attack: 24, defense: 9 },
    speed: 130,
    aiType: 'caster',
    resistances: { cold: 'resistant', fire: 'neutral' },
    statusImmunities: ['poison', 'paralysis'],
    onHitAffliction: {
      type: 'slow',
      chance: 0.4,
      duration: 6,
    },
    spells: ['slow', 'lightning_bolt'],
    spellCooldown: 2,
    fleeHealthPercent: 0.0,
    xpValue: 750,
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 300) + 200),
      },
      {
        chance: 0.6,
        generate: (id) => ItemFactory.createScrollOfTeleport(id),
      },
      {
        chance: 0.5,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
    ],
  },

  // --- Campaign Climax Boss ---
  boss_hrungnir: {
    id: 'boss_hrungnir',
    name: 'Hrungnir the Hill Giant Chieftain',
    minFloor: 25,
    stats: { hp: 120, maxHp: 120, attack: 18, defense: 8 },
    speed: 90,
    aiType: 'brute',
    statusImmunities: ['paralysis', 'poison'],
    spells: ['firebolt'],
    spellCooldown: 3,
    fleeHealthPercent: 0.0,
    xpValue: 500,
    lootTable: [
      {
        chance: 1.0,
        generate: (id) =>
          ItemFactory.createQuestRelic(
            id,
            'The Sun-Stone of Freyr',
            'The ancient radiant relic of Freyr, warm to the touch. Returning it to town will bring lasting peace and light.'
          ),
      },
      {
        chance: 1.0,
        generate: (id) => ItemFactory.createPlatinumCoins(id, 5),
      },
      {
        chance: 0.8,
        generate: (id) => ItemFactory.createFrostBlade(id),
      },
    ],
  },
};

export const COTW_MONSTERS: MonsterDefinition[] = [
  ...Object.values(COTW_BESTIARY),
  {
    id: 'orc',
    name: 'Orc Warrior',
    minFloor: 3,
    stats: { hp: 28, maxHp: 28, attack: 8, defense: 3 },
    speed: 85,
    aiType: 'melee',
    resistances: { lightning: 'neutral' },
    fleeHealthPercent: 0.15,
    xpValue: 45,
    lootTable: [
      {
        chance: 0.35,
        generate: (id) => ItemFactory.createBroadsword(id),
      },
      {
        chance: 0.25,
        generate: (id) => ItemFactory.createWoodenShield(id),
      },
      {
        chance: 0.4,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 20) + 10),
      },
    ],
  },
];

/** Alias for backward compatibility */
export const BESTIARY = COTW_BESTIARY;

// Register with MonsterRegistry for runtime access
MonsterRegistry.registerAll(COTW_MONSTERS);


