import { Container } from './container';
import type { GameEngine } from '../engine';

/**
 * Reconstructs an engine's containerRegistry and itemIndex by scanning
 * live world structures (ARCHITECTURE.md §3, §5; docs/architecture/content-extensibility.md).
 *
 * Scans active map ground items, stored floors, player inventory (pack,
 * purse, paperdoll), and companion inventory, registering containers into
 * `engine.registries.containers` and items into `engine.registries.itemIndex`.
 */
export function rebuildItemRegistries(engine: GameEngine): void {
  if (!engine.registries?.containers || !engine.registries?.itemIndex) {
    return;
  }

  const containerStore = engine.registries.containers;
  const itemIndex = engine.registries.itemIndex;

  containerStore.clear();
  itemIndex.clear();

  const walkContainer = (container: Container) => {
    containerStore.register(container.id, container);
    for (const item of container.getItems()) {
      itemIndex.register(item, { kind: 'container', containerId: container.id });
      if (item instanceof Container) {
        walkContainer(item);
      }
    }
  };

  // 1. Active map ground items
  if (engine.map) {
    for (const pile of engine.map.getAllGroundItems()) {
      for (const item of pile.items) {
        itemIndex.register(item, { kind: 'ground', x: pile.x, y: pile.y });
        if (item instanceof Container) {
          walkContainer(item);
        }
      }
    }
  }

  // 2. Stored floors ground items
  if (engine.storedFloors) {
    for (const [_floorNum, storedMap] of engine.storedFloors) {
      if (storedMap && storedMap !== engine.map) {
        for (const pile of storedMap.getAllGroundItems()) {
          for (const item of pile.items) {
            itemIndex.register(item, { kind: 'ground', x: pile.x, y: pile.y });
            if (item instanceof Container) {
              walkContainer(item);
            }
          }
        }
      }
    }
  }

  // 3. Player inventory (primary pack, purse, equipped paperdoll)
  if (engine.player?.inventory) {
    if (engine.player.inventory.primaryPack) {
      walkContainer(engine.player.inventory.primaryPack);
    }
    if (engine.player.inventory.purse) {
      walkContainer(engine.player.inventory.purse);
    }
    for (const eq of engine.player.inventory.paperdoll.getAllEquipped()) {
      itemIndex.register(eq.item, {
        kind: 'equipped',
        ownerId: eq.item.ownerId ?? engine.player.id,
        slot: eq.slot,
      });
      if (eq.item instanceof Container) {
        walkContainer(eq.item);
      }
    }
  }

  // 4. Companion inventory (if attached)
  if (engine.companion?.inventory) {
    if (engine.companion.inventory.primaryPack) {
      walkContainer(engine.companion.inventory.primaryPack);
    }
    for (const eq of engine.companion.inventory.paperdoll.getAllEquipped()) {
      itemIndex.register(eq.item, {
        kind: 'equipped',
        ownerId: eq.item.ownerId ?? engine.companion.id,
        slot: eq.slot,
      });
      if (eq.item instanceof Container) {
        walkContainer(eq.item);
      }
    }
  }
}
