import type { MonsterDefinition } from '../../../engine';

import { RIME_HOLLOWS_MONSTERS } from './rimeHollows';
import { DWARVEN_WORKS_MONSTERS } from './abandonedDwarvenWorks';
import { OBSIDIAN_SIPHON_MONSTERS } from './obsidianSiphon';
import { FOLKLORE_DETOUR_MONSTERS } from './folkloreDetour';
import { SILVER_VEINS_MONSTERS } from './tarnishedSilverVeins';
import { WORLD_BARK_MONSTERS } from './worldBarkDescent';
import { MAW_OF_MALICE_MONSTERS } from './mawOfMalice';
import { BOSS_MONSTERS } from './bosses';
import { MINIBOSS_MONSTERS } from './minibosses';
import { LEGACY_COTW_MONSTERS } from './legacy';
import { PROLOGUE_MONSTERS } from './prologue';
import { COTW_KILL_RITES } from '../killRites';

export * from './rimeHollows';
export * from './abandonedDwarvenWorks';
export * from './obsidianSiphon';
export * from './folkloreDetour';
export * from './tarnishedSilverVeins';
export * from './worldBarkDescent';
export * from './mawOfMalice';
export * from './bosses';
export * from './minibosses';
export * from './legacy';
export * from './prologue';

/**
 * The canonical 37-entry monster roster specified for Castle of the Winds:
 * - 35 zone encounters across 7 level bands
 * - 2 major boss encounters (The Sun-Chariot Warden, Níðhögg)
 */
export const COTW_ROSTER_37: MonsterDefinition[] = [
  ...RIME_HOLLOWS_MONSTERS,
  ...DWARVEN_WORKS_MONSTERS,
  ...OBSIDIAN_SIPHON_MONSTERS,
  ...FOLKLORE_DETOUR_MONSTERS,
  ...SILVER_VEINS_MONSTERS,
  ...WORLD_BARK_MONSTERS,
  ...MAW_OF_MALICE_MONSTERS,
  ...BOSS_MONSTERS,
];

/** Bestiary dictionary of the 37 roster monsters indexed by ID */
export const COTW_ROSTER_BESTIARY: Record<string, MonsterDefinition> = Object.fromEntries(
  COTW_ROSTER_37.map((m) => [m.id, m])
);

/**
 * Complete COTW Bestiary, by id: the classic monsters of `legacy.ts`, the 37 roster monsters,
 * the minibosses and the prologue's.
 */
export const COTW_BESTIARY: Record<string, MonsterDefinition> = {
  ...LEGACY_COTW_MONSTERS,
  ...COTW_ROSTER_BESTIARY,
  ...Object.fromEntries(MINIBOSS_MONSTERS.map((m) => [m.id, m])),
  ...Object.fromEntries(PROLOGUE_MONSTERS.map((m) => [m.id, m])),
};

/**
 * Array of monster definitions for registration and dungeon generation: the classic monsters
 * of `legacy.ts` first, then the roster, minibosses and prologue monsters not already
 * included. The order is part of what a seed spawns (a depth-weighted pick walks the array),
 * so reordering it changes every seeded floor and the spawner tests that pin them.
 */
const seenIds = new Set<string>();
const allMonsters: MonsterDefinition[] = [];

for (const m of Object.values(LEGACY_COTW_MONSTERS)) {
  if (!seenIds.has(m.id)) {
    seenIds.add(m.id);
    allMonsters.push(m);
  }
}

for (const m of COTW_ROSTER_37) {
  if (!seenIds.has(m.id)) {
    seenIds.add(m.id);
    allMonsters.push(m);
  }
}

for (const m of [...MINIBOSS_MONSTERS, ...PROLOGUE_MONSTERS]) {
  if (!seenIds.has(m.id)) {
    seenIds.add(m.id);
    allMonsters.push(m);
  }
}

// Attach each monster's kill rite from the single pacing table (killRites.ts).
for (const m of [...allMonsters, ...Object.values(COTW_BESTIARY)]) {
  const rite = COTW_KILL_RITES[m.id];
  if (rite) m.killRite = rite;
}

export const COTW_MONSTERS: MonsterDefinition[] = allMonsters;
