import {
  MonsterRegistryStore,
  setActiveMonsterStore,
} from './monsterRegistryStore';
import {
  TrapRegistryStore,
  setActiveTrapStore,
} from './trapRegistryStore';
import {
  ActionRegistryStore,
  setActiveActionStore,
} from './actionRegistryStore';

export { RegistryStore } from './registryStore';
export {
  MonsterRegistryStore,
  activeMonsterStore,
  processDefaultMonsterStore,
  setActiveMonsterStore,
} from './monsterRegistryStore';
export {
  TrapRegistryStore,
  activeTrapStore,
  processDefaultTrapStore,
  setActiveTrapStore,
} from './trapRegistryStore';
export {
  ActionRegistryStore,
  activeActionStore,
  processDefaultActionStore,
  setActiveActionStore,
} from './actionRegistryStore';

/**
 * Bundle of per-engine content registries (ARCHITECTURE.md §3, P-22).
 */
export interface EngineRegistries {
  monsters: MonsterRegistryStore;
  traps: TrapRegistryStore;
  actionCommands: ActionRegistryStore;
}

/**
 * Activates an engine's registry bundle across all facades.
 * Called at engine entry points: constructor, handlePlayerAction,
 * advanceWorldUntilPlayerTurn, changeFloor, and post-deserialization.
 */
export function activateRegistries(registries: EngineRegistries | null): void {
  setActiveMonsterStore(registries ? registries.monsters : null);
  setActiveTrapStore(registries ? registries.traps : null);
  setActiveActionStore(registries ? registries.actionCommands : null);
}
