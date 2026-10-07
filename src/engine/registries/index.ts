import {
  MonsterRegistryStore,
  activeMonsterStore,
  setActiveMonsterStore,
} from './monsterRegistryStore';
import {
  TrapRegistryStore,
  activeTrapStore,
  setActiveTrapStore,
} from './trapRegistryStore';
import {
  ActionRegistryStore,
  activeActionStore,
  setActiveActionStore,
} from './actionRegistryStore';
import {
  SpellRegistryStore,
  activeSpellStore,
  setActiveSpellStore,
} from './spellRegistryStore';
import {
  CompanionRegistryStore,
  activeCompanionStore,
  setActiveCompanionStore,
} from './companionRegistryStore';
import {
  AIStrategyRegistryStore,
  activeAIStrategyStore,
  setActiveAIStrategyStore,
} from './aiStrategyRegistryStore';
import {
  AIBehaviorRegistryStore,
  activeAIBehaviorStore,
  setActiveAIBehaviorStore,
} from './aiBehaviorRegistryStore';
import {
  StatusHandlerRegistryStore,
  activeStatusHandlerStore,
  setActiveStatusHandlerStore,
} from './statusHandlerRegistryStore';
import {
  TileRegistryStore,
  activeTileStore,
  setActiveTileStore,
} from './tileRegistryStore';
import {
  ContainerRegistryStore,
  activeContainerStore,
  setActiveContainerStore,
} from './containerRegistryStore';
import {
  type ItemIndex,
  activeItemIndex,
  setActiveItemIndex,
} from '../items/itemIndex';

export { MonsterRegistryStore, processDefaultMonsterStore } from './monsterRegistryStore';
export { TrapRegistryStore, processDefaultTrapStore } from './trapRegistryStore';
export {
  ActionRegistryStore,
  /** @public Unused; goes with the action registry, which is being removed. */
  activeActionStore,
  processDefaultActionStore,
  /** @public Unused; goes with the action registry, which is being removed. */
  setActiveActionStore,
} from './actionRegistryStore';
export { SpellRegistryStore, processDefaultSpellStore } from './spellRegistryStore';
export { CompanionRegistryStore, processDefaultCompanionStore } from './companionRegistryStore';
export { AIStrategyRegistryStore, processDefaultAIStrategyStore } from './aiStrategyRegistryStore';
export { AIBehaviorRegistryStore, processDefaultAIBehaviorStore } from './aiBehaviorRegistryStore';
export { StatusHandlerRegistryStore, processDefaultStatusHandlerStore } from './statusHandlerRegistryStore';
export { TileRegistryStore, processDefaultTileStore } from './tileRegistryStore';
export { ContainerRegistryStore } from './containerRegistryStore';
export { ItemIndex } from '../items/itemIndex';

/**
 * Bundle of per-engine content and runtime state registries (ARCHITECTURE.md §3, §5; docs/architecture/content-extensibility.md).
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

/**
 * The bundle the facades resolve against right now, store by store, so work done under
 * another bundle can hand back exactly this one through `activateRegistries`.
 */
export function activeRegistries(): EngineRegistries {
  return {
    monsters: activeMonsterStore(),
    traps: activeTrapStore(),
    actionCommands: activeActionStore(),
    spells: activeSpellStore(),
    companions: activeCompanionStore(),
    aiStrategies: activeAIStrategyStore(),
    aiBehaviors: activeAIBehaviorStore(),
    statusHandlers: activeStatusHandlerStore(),
    tiles: activeTileStore(),
    containers: activeContainerStore(),
    itemIndex: activeItemIndex(),
  };
}
