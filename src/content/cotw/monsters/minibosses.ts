import { ItemFactory } from '../../../engine';
import type { MonsterDefinition } from '../../../engine';

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
        generate: (id) => ItemFactory.createHealthPotion(id),
      },
      {
        chance: 1.0,
        generate: (id) => ItemFactory.createManaPotion(id),
      },
      {
        chance: 1.0,
        generate: (id, rng) => ItemFactory.createGoldCoins(id, Math.floor(rng() * 30) + 30),
      },
    ],
  },
];
