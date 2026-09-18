import type { StarterKitDefinition, ProgressionConfig } from '../../engine';

export const COTW_STARTER_KIT: StarterKitDefinition = {
  weaponItemId: 'dagger',
  purseItemId: 'coin_purse',
  coins: [
    { denomination: 'copper', count: 50 },
    { denomination: 'silver', count: 10 },
    { denomination: 'gold', count: 2 },
  ],
  beltItemId: 'utility_belt',
  beltSlotItemIds: ['wand_lightning'],
  packItemIds: ['travel_bread', 'health_potion', 'mana_potion', 'scroll_phase_door', 'rune_of_return'],
};

/**
 * The Hearth-Tear of Járnviðr (ARCHITECTURE.md §3, `stats/levelScaledResistance.ts`):
 * the protagonist's frost-giant heritage (descended from Thrym, centuries removed)
 * carries them easily through Járnviðr's permafrost early on, and just as surely
 * fails them as the dungeon inverts into soot-choked obsidian depths deeper into
 * Act 1 — not because their cold tolerance *weakens*, but because it never helped
 * against heat, and levels here track roughly with how deep into that inversion
 * the player has gone. Neither curve is read by combat's categorical
 * `elementalResistances`; a content-defined status effect (`cotw:permafrost_exposure`
 * / `cotw:forge_heat_exposure`, see `monsters.ts`'s Járnviðr encounter dressing)
 * consults it explicitly when applying environmental exposure damage.
 */
export const COTW_PROGRESSION: ProgressionConfig = {
  elementalResistanceCurve: {
    cold: [
      { level: 1, resistance: 0.5 },
      { level: 10, resistance: 0.65 },
      { level: 20, resistance: 0.75 },
    ],
    fire: [
      { level: 1, resistance: -0.1 },
      { level: 15, resistance: -0.3 },
      { level: 25, resistance: -0.5 },
    ],
  },
};
