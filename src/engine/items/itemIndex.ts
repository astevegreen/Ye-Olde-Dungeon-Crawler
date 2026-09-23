import type { Item } from './item';

/**
 * Where an item currently lives. Recorded alongside the item so a lookup answers both
 * "which item is this id?" and "where is it?" without walking containers.
 */
export type ItemLocation =
  | { kind: 'container'; containerId: string }
  | { kind: 'ground'; x: number; y: number }
  | { kind: 'equipped'; ownerId: string; slot: string };

/**
 * Flat, ID-keyed index of every live item (ARCHITECTURE.md §5).
 *
 * Containers still *hold* their items; this is the lookup surface, so finding an item is a
 * map hit rather than a recursive walk of packs, belts, purses, paperdolls, and floor tiles.
 *
 * Keeping a second structure in sync is exactly what went wrong with the scheduler
 * partition (§6), so entries are written at the few choke points every item must pass
 * through — `Container.addItem`/`removeItem`, `Paperdoll.equip`/`unequip`, and
 * `GameMap.addItemAt`/`removeItemAt` — and `itemIndexMatchesWorld` (see the tests) audits
 * the index against a full structural scan.
 */
export class ItemIndex {
  private readonly byId = new Map<string, { item: Item; location: ItemLocation }>();

  public register(item: Item, location: ItemLocation): void {
    if (!item?.id) return;
    this.byId.set(item.id, { item, location });
  }

  public unregister(itemId: string): void {
    this.byId.delete(itemId);
  }

  public get(itemId: string): Item | undefined {
    return this.byId.get(itemId)?.item;
  }

  public locationOf(itemId: string): ItemLocation | undefined {
    return this.byId.get(itemId)?.location;
  }

  public has(itemId: string): boolean {
    return this.byId.has(itemId);
  }

  public get size(): number {
    return this.byId.size;
  }

  public entries(): Array<{ item: Item; location: ItemLocation }> {
    return [...this.byId.values()];
  }

  public clear(): void {
    this.byId.clear();
  }
}

const fallbackItemIndex = new ItemIndex();
let activeInstance: ItemIndex = fallbackItemIndex;

/** The ItemIndex instance the facade currently resolves against. */
export function activeItemIndex(): ItemIndex {
  return activeInstance;
}

export function processDefaultItemIndex(): ItemIndex {
  return fallbackItemIndex;
}

/**
 * Points the facade at an engine's own item index. Called when a `GameEngine` is activated.
 */
export function setActiveItemIndex(index: ItemIndex | null): void {
  activeInstance = index ?? fallbackItemIndex;
}

/**
 * Facade forwarding to the currently active engine's ItemIndex (ARCHITECTURE.md §3, §5; docs/architecture/content-extensibility.md).
 */
export const itemIndex = {
  register(item: Item, location: ItemLocation): void {
    activeItemIndex().register(item, location);
  },
  unregister(itemId: string): void {
    activeItemIndex().unregister(itemId);
  },
  get(itemId: string): Item | undefined {
    return activeItemIndex().get(itemId);
  },
  locationOf(itemId: string): ItemLocation | undefined {
    return activeItemIndex().locationOf(itemId);
  },
  has(itemId: string): boolean {
    return activeItemIndex().has(itemId);
  },
  get size(): number {
    return activeItemIndex().size;
  },
  entries(): Array<{ item: Item; location: ItemLocation }> {
    return activeItemIndex().entries();
  },
  clear(): void {
    activeItemIndex().clear();
  },
};

/** Convenience lookup: the item with this id, wherever it lives in the active engine. */
export function getItemById(itemId: string): Item | undefined {
  return activeItemIndex().get(itemId);
}
