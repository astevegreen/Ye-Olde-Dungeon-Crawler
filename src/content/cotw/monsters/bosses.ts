import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';
import { makeLootItem } from '../items/makeItem';

export const BOSS_MONSTERS: MonsterDefinition[] = [
  {
    id: 'sun_chariot_warden',
    name: 'The Sun-Chariot Warden',
    minFloor: 25,
    stats: { hp: 220, maxHp: 220, attack: 22, defense: 9 },
    speed: 95,
    aiType: 'caster',
    resistances: { fire: 'immune', physical: 'resistant', lightning: 'resistant' },
    statusImmunities: ['paralysis', 'poison', 'blindness'],
    spells: ['firebolt', 'lightning_bolt'],
    spellCooldown: 2,
    telegraphedAbility: {
      requiresSpellId: 'lightning_bolt',
      name: 'Radiant Chariot Beam',
      message: 'The Sun-Chariot Warden aligns the stolen solar core, focusing a colossal Radiant Chariot Beam!',
      pattern: 'line',
      range: 7,
      radius: 0,
      multiplier: 2.8,
      element: 'fire',
      spawnSurface: 'fire',
      chance: 0.45,
      cooldown: 2,
    },
    spellPreferences: [
      { spellId: 'lightning_bolt' },
      { spellId: 'firebolt' },
    ],
    fleeHealthPercent: 0.0,
    xpValue: 1200,
    tags: ['construct', 'boss', 'miniboss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => makeLootItem('hearth_tear_fragment', id, rng),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createPlatinumCoins(id, Math.floor(rng() * 10) + 10),
      },
    ],
  },
  {
    id: 'nidhogg',
    name: 'Níðhögg, the Root-Gnawer',
    minFloor: 50,
    stats: { hp: 400, maxHp: 400, attack: 30, defense: 14 },
    speed: 95,
    aiType: 'caster',
    resistances: { poison: 'immune', physical: 'resistant', cold: 'resistant' },
    statusImmunities: ['paralysis', 'poison', 'slow'],
    spells: ['lightning_bolt', 'firebolt'],
    spellCooldown: 2,
    telegraphedAbility: {
      requiresSpellId: 'lightning_bolt',
      name: 'Rootbound Ruin',
      message: 'Níðhögg coils around the World Root, gnawing rot into it before Rootbound Ruin erupts!',
      pattern: 'blast',
      range: 6,
      radius: 2,
      multiplier: 2.5,
      element: 'poison',
      spawnSurface: 'acid_pool',
      chance: 0.35,
      cooldown: 3,
    },
    spellPreferences: [
      { spellId: 'lightning_bolt' },
      { spellId: 'firebolt' },
    ],
    hooks: [
      {
        event: 'onDamageTaken',
        chance: 0.35,
        action: { type: 'spawnSurface', surfaceType: 'acid_pool', radius: 1, duration: 5 },
        description: '✦ Necrotic venom seeps from Níðhögg’s wounds onto the floor!',
      },
    ],
    fleeHealthPercent: 0.15,
    xpValue: 5000,
    tags: ['dragon', 'boss'],
    lootTable: [
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createPlatinumCoins(id, Math.floor(rng() * 20) + 20),
      },
    ],
  },
];
