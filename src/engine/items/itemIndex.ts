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
class ItemIndex {
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

  /** Drops every entry. Used when a process starts a different game. */
  public clear(): void {
    this.byId.clear();
  }
}

/**
 * Process-wide, like the container registry beside it. Scoping registries per engine is
 * tracked separately (§9, P-22).
 */
export const itemIndex = new ItemIndex();

/** Convenience lookup: the item with this id, wherever it lives. */
export function getItemById(itemId: string): Item | undefined {
  return itemIndex.get(itemId);
}
