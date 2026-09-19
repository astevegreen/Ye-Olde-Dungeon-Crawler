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
import {
  SpellRegistryStore,
  setActiveSpellStore,
} from './spellRegistryStore';
import {
  CompanionRegistryStore,
  setActiveCompanionStore,
} from './companionRegistryStore';
import {
  AIStrategyRegistryStore,
  setActiveAIStrategyStore,
} from './aiStrategyRegistryStore';
import {
  AIBehaviorRegistryStore,
  setActiveAIBehaviorStore,
} from './aiBehaviorRegistryStore';
import {
  StatusHandlerRegistryStore,
  setActiveStatusHandlerStore,
} from './statusHandlerRegistryStore';
import {
  TileRegistryStore,
  setActiveTileStore,
} from './tileRegistryStore';
import {
  ContainerRegistryStore,
  setActiveContainerStore,
} from './containerRegistryStore';
import {
  type ItemIndex,
  setActiveItemIndex,
} from '../items/itemIndex';

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
export {
  SpellRegistryStore,
  activeSpellStore,
  processDefaultSpellStore,
  setActiveSpellStore,
} from './spellRegistryStore';
export {
  CompanionRegistryStore,
  activeCompanionStore,
  processDefaultCompanionStore,
  setActiveCompanionStore,
} from './companionRegistryStore';
export {
  AIStrategyRegistryStore,
  activeAIStrategyStore,
  processDefaultAIStrategyStore,
  setActiveAIStrategyStore,
} from './aiStrategyRegistryStore';
export {
  AIBehaviorRegistryStore,
  activeAIBehaviorStore,
  processDefaultAIBehaviorStore,
  setActiveAIBehaviorStore,
} from './aiBehaviorRegistryStore';
export {
  StatusHandlerRegistryStore,
  activeStatusHandlerStore,
  processDefaultStatusHandlerStore,
  setActiveStatusHandlerStore,
  setDefaultStatusHandlerRegistrar,
  getDefaultStatusHandlerRegistrar,
} from './statusHandlerRegistryStore';
export {
  TileRegistryStore,
  activeTileStore,
  processDefaultTileStore,
  setActiveTileStore,
} from './tileRegistryStore';
export {
  ContainerRegistryStore,
  activeContainerStore,
  processDefaultContainerStore,
  setActiveContainerStore,
} from './containerRegistryStore';
export {
  ItemIndex,
  activeItemIndex,
  processDefaultItemIndex,
  setActiveItemIndex,
} from '../items/itemIndex';

/**
 * Bundle of per-engine content and runtime state registries (ARCHITECTURE.md §3, §5, P-22).
 */
export interface EngineRegistries {
  monsters: MonsterRegistryStore;
  traps: TrapRegistryStore;
  actionCommands: ActionRegistryStore;
  spells: SpellRegistryStore;
  companions: CompanionRegistryStore;
  aiStrategies: AIStrategyRegistryStore;
  aiBehaviors: AIBehaviorRegistryStore;
  statusHandlers: StatusHandlerRegistryStore;
  tiles: TileRegistryStore;
  containers: ContainerRegistryStore;
  itemIndex: ItemIndex;
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
  setActiveSpellStore(registries ? registries.spells : null);
  setActiveCompanionStore(registries ? registries.companions : null);
  setActiveAIStrategyStore(registries ? registries.aiStrategies : null);
  setActiveAIBehaviorStore(registries ? registries.aiBehaviors : null);
  setActiveStatusHandlerStore(registries ? registries.statusHandlers : null);
  setActiveTileStore(registries ? registries.tiles : null);
  setActiveContainerStore(registries ? registries.containers : null);
  setActiveItemIndex(registries ? registries.itemIndex : null);
}
