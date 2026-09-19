import {
  MonsterRegistryStore,
  setActiveMonsterStore,
} from './monsterRegistryStore';

export { RegistryStore } from './registryStore';
export {
  MonsterRegistryStore,
  activeMonsterStore,
  processDefaultMonsterStore,
  setActiveMonsterStore,
} from './monsterRegistryStore';

/**
 * Bundle of per-engine content registries (ARCHITECTURE.md §3, P-22).
 */
export interface EngineRegistries {
  monsters: MonsterRegistryStore;
}

/**
 * Activates an engine's registry bundle across all facades.
 * Called at engine entry points: constructor, handlePlayerAction,
 * advanceWorldUntilPlayerTurn, changeFloor, and post-deserialization.
 */
export function activateRegistries(registries: EngineRegistries | null): void {
  setActiveMonsterStore(registries ? registries.monsters : null);
}
