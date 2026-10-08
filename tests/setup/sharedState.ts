/**
 * Vitest setup file (`test.setupFiles` in vite.config.ts): runs before each test file is
 * imported. Without isolation a worker keeps one module graph across files, so whatever
 * process-level state a file leaves behind is what the next file starts from.
 */
import { afterAll } from 'vitest';
import {
  activateRegistries,
  processDefaultCompanionStore,
  processDefaultMonsterStore,
  processDefaultSpellStore,
  processDefaultTrapStore,
} from '../../src/engine/registries';

// `new GameEngine` makes that engine's registries the active bundle the facades forward
// to (ARCHITECTURE.md §3), and nothing switches it back. A file starts against the process
// defaults, as in a fresh process, so its fixtures land where its engines are seeded from.
activateRegistries(null);

// No engine module registers a monster, spell, companion or trap at import, so these
// process defaults hold only what a test put there, and every engine built after it would
// be seeded with it. A file that registers fixtures before building its engine removes them:
// `activateRegistries(null)` first (an engine is active by then), then the facade's `clear()`.
afterAll(() => {
  activateRegistries(null);
  const left = Object.entries({
    monsters: processDefaultMonsterStore(),
    spells: processDefaultSpellStore(),
    companions: processDefaultCompanionStore(),
    traps: processDefaultTrapStore(),
  }).filter(([, store]) => store.getAll().length > 0);
  if (left.length > 0) {
    const what = left.map(([name, store]) => `${store.getAll().length} ${name}`).join(', ');
    for (const [, store] of left) store.clear(); // fail this file only, not every file after it
    throw new Error(`This file left ${what} in the process-default registries; remove them in afterAll.`);
  }
});
