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
 * Complete COTW Bestiary containing all 37 roster monsters plus legacy entries
 * and aliases to ensure 100% backward compatibility with existing unit/integration tests.
 */
export const COTW_BESTIARY: Record<string, MonsterDefinition> = {
  ...LEGACY_COTW_MONSTERS,
  ...COTW_ROSTER_BESTIARY,
  ...Object.fromEntries(MINIBOSS_MONSTERS.map((m) => [m.id, m])),
};

// Aliases for quest continuity and backward compatibility
if (COTW_BESTIARY.ironwood_troll_wife && !COTW_BESTIARY.troll_wife_warlock) {
  COTW_BESTIARY.troll_wife_warlock = COTW_BESTIARY.ironwood_troll_wife;
}
if (COTW_BESTIARY.huldra_hollow_back && !COTW_BESTIARY.huldra) {
  COTW_BESTIARY.huldra = COTW_BESTIARY.huldra_hollow_back;
}

/**
 * Array of monster definitions for registration and dungeon generation.
 * Starts with legacy monsters to preserve deterministic ordering in spawner tests,
 * followed by any new roster monsters not already included.
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

for (const m of MINIBOSS_MONSTERS) {
  if (!seenIds.has(m.id)) {
    seenIds.add(m.id);
    allMonsters.push(m);
  }
}

export const COTW_MONSTERS: MonsterDefinition[] = allMonsters;
