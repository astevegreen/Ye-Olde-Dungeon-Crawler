import type { LootRatesDefinition } from '../../engine';

/**
 * Loot volume for Castle of the Winds (Q2 "C": about 8–10 items a floor, down from 17–29, more
 * of them worth a decision). `npm run balance` measures the result; `lootVolume.test.ts` pins it.
 *
 * - Per room past the arrival room: about a third of the rooms hold a loose drop, a little
 *   over half of those coins; one room in eighteen holds a chest. Chests (room, vault, monster
 *   and the hoard) hold 1–3 entries, under half of them coins.
 * - The newest-item rule spreads its 75% over the eight newest definitions the floor has
 *   unlocked, so no single item fills a floor (it was one: floor 5 was 68% Mammut-Hide
 *   Brigandine, floors 46–49 37% the cursed Marrow-Gnawed Ring).
 */
export const COTW_LOOT_RATES: LootRatesDefinition = {
  // 0.55 and 0.08 until tracker 5.7: a roll on a wall or pillar then placed nothing, about a
  // quarter of them. Every roll lands now, so the chances fell by about a third.
  roomDropChance: 0.36,
  roomCoinShare: 0.55,
  roomChestChance: 0.055,
  chestEntries: [1, 3],
  // A secret cache's chest (tracker 5.6): small, so the caches stay inside 8–10 items a floor.
  cacheEntries: [1, 2],
  chestCoinShare: 0.45,
  newestShare: 0.75,
  newestDefinitions: 8,
};

/**
 * Monster item drops (`itemDrop`): each table chance is the drop's weight against the monster's
 * other drops, times this scale for its kind. Gear falls harder than potions and scrolls, which
 * weigh little and are always worth carrying. Signature drops (`makeLootItem`) are not scaled.
 */
export const COTW_MONSTER_DROP_SCALE = { gear: 0.4, consumable: 0.5 } as const;
