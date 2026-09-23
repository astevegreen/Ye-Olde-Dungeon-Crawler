import type { TileDefinition } from '../types';
import { RegistryStore } from './registryStore';

/**
 * One engine's tile definitions (ARCHITECTURE.md §3).
 */
export class TileRegistryStore extends RegistryStore<string, TileDefinition> {
  constructor() {
    super((tile) => tile.type);
  }

  public override registerAll(
    items: readonly TileDefinition[] | TileDefinition[] | Record<string, TileDefinition> | Map<string, TileDefinition>
  ): void {
    if (items instanceof Map) {
      for (const [, item] of items.entries()) {
        this.register(item);
      }
    } else {
      const list = Array.isArray(items) ? items : Object.values(items);
      for (const item of list) {
        this.register(item);
      }
    }
  }

  public getMap(): ReadonlyMap<string, TileDefinition> {
    return this.entries;
  }
}

const processDefaultStore = new TileRegistryStore();
let activeStore: TileRegistryStore = processDefaultStore;

export function activeTileStore(): TileRegistryStore {
  return activeStore;
}

export function processDefaultTileStore(): TileRegistryStore {
  return processDefaultStore;
}

export function setActiveTileStore(store: TileRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
