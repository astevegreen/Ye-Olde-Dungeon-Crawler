import { Item, type ItemConfig } from './item';
import { itemIndex } from './itemIndex';
import { canStack, mergeItemStacks } from './stacking';
import {
  registerContainer,
  unregisterContainer,
  getRegisteredContainer,
  clearContainerRegistry,
} from './containerRegistry';

export type ContainerType = 'pack' | 'chest' | 'belt' | 'purse';
export type ContainerSortMode = 'category' | 'weight' | 'bulk';

export interface ContainerConfig extends ItemConfig {
  containerType: ContainerType;
  maxWeightCapacity: number; // in grams
  maxBulkCapacity: number; // in cm³
  maxSlots?: number; // optional limit on item count (e.g. for belts)
  acceptedCategories?: readonly string[]; // optional filter (e.g. currency only for purse)
}

export class Container extends Item {
  public static getContainer(id: string): Container | null {
    return getRegisteredContainer<Container>(id);
  }

  public static registerContainer(c: Container): void {
    registerContainer(c);
  }

  public static unregisterContainer(id: string): void {
    unregisterContainer(id);
  }

  public static clearContainerRegistry(): void {
    clearContainerRegistry();
  }

  public readonly containerType: ContainerType;
  public readonly maxWeightCapacity: number;
  public readonly maxBulkCapacity: number;
  public readonly maxSlots?: number;
  public readonly acceptedCategories?: readonly string[];
  private items: Item[];

  constructor(config: ContainerConfig) {
    super(config);
    this.containerType = config.containerType;
    this.maxWeightCapacity = config.maxWeightCapacity;
    this.maxBulkCapacity = config.maxBulkCapacity;
    this.maxSlots = config.maxSlots;
    this.acceptedCategories = config.acceptedCategories;
    this.items = [];
    registerContainer(this);
  }

  private opened = false;

  /** Whether the player has ever looked inside (opened, looted, or stored into) this
   *  container — the HUD flags unopened ground containers. Saved with the item. */
  public get wasOpened(): boolean {
    return this.opened;
  }

  public markOpened(): void {
    this.opened = true;
  }

  public getItems(): readonly Item[] {
    return this.items;
  }

  public get itemCount(): number {
    return this.items.length;
  }

  /**
   * Recursive total weight: empty container weight + recursive weight of all contained items.
   */
  public override totalWeight(): number {
    return this.weight + this.containedWeight();
  }

  /**
   * Sum of the weights of all contained items.
   */
  public containedWeight(): number {
    return this.items.reduce((sum, item) => sum + (typeof item.totalWeight === 'function' ? item.totalWeight() : (item.weight ?? 0)), 0);
  }

  /**
   * Total bulk in cm³:
   * - Rigid containers (chests) occupy their fixed maximum bulk regardless of contents.
   * - Expandable containers (packs, bags, belts, purses) occupy empty bulk + sum of contained items' bulk.
   */
  public override totalBulk(): number {
    if (this.containerType === 'chest') {
      return this.maxBulkCapacity;
    }
    return this.bulk + this.containedBulk();
  }

  /**
   * Sum of the bulk of all contained items.
   */
  public containedBulk(): number {
    return this.items.reduce(
      (sum, item) => sum + (typeof item.totalBulk === 'function' ? item.totalBulk() : (item.bulk ?? 0)),
      0
    );
  }

  /**
   * Verifies if an item can be added into this container based on category, slot,
   * max weight, max bulk, and circular container reference constraints.
   */
  public canContain(item: Item): { allowed: boolean; reason?: string } {
    // 1. Prevent inserting a container into itself
    if (item === this) {
      return { allowed: false, reason: 'Cannot place a container inside itself.' };
    }

    // 2. Prevent circular nesting
    if (item instanceof Container && this.isAncestorOf(item)) {
      return { allowed: false, reason: 'Cannot create circular container nesting.' };
    }

    // 3. Category restrictions (e.g. Purses only accept currency)
    if (this.acceptedCategories && this.acceptedCategories.length > 0) {
      if (!this.acceptedCategories.includes(item.category)) {
        return {
          allowed: false,
          reason: `${this.name} can only hold ${this.acceptedCategories.join(', ')}.`,
        };
      }
    }

    // 4. Slot limit check (e.g. Belts)
    const canMerge = this.items.some((i) => canStack(i, item));
    if (!canMerge && this.maxSlots !== undefined && this.items.length >= this.maxSlots) {
      return {
        allowed: false,
        reason: `${this.name} has reached its slot capacity (${this.maxSlots} slots).`,
      };
    }

    // 5. Weight limit check
    const itemWeight = typeof item.totalWeight === 'function' ? item.totalWeight() : (item.weight ?? 0);
    const newContainedWeight = this.containedWeight() + itemWeight;
    if (newContainedWeight > this.maxWeightCapacity) {
      return {
        allowed: false,
        reason: `Item exceeds ${this.name}'s weight capacity (${this.maxWeightCapacity}g).`,
      };
    }

    // 6. Bulk limit check
    const itemBulk = typeof item.totalBulk === 'function' ? item.totalBulk() : (item.bulk ?? 0);
    const newContainedBulk = this.containedBulk() + itemBulk;
    if (newContainedBulk > this.maxBulkCapacity) {
      return {
        allowed: false,
        reason: `Item exceeds ${this.name}'s volume capacity (${this.maxBulkCapacity}cm³).`,
      };
    }

    // 7. Recursive Ancestor Capacity Checks
    let currAncestorId = this.parentId;
    let currentDeltaBulk = this.containerType === 'chest' ? 0 : itemBulk;
    const currentDeltaWeight = itemWeight;

    while (currAncestorId) {
      const currAncestor = Container.getContainer(currAncestorId);
      if (!currAncestor) break;

      if (currAncestor.containedWeight() + currentDeltaWeight > currAncestor.maxWeightCapacity) {
        return {
          allowed: false,
          reason: `Item would cause ancestor container ${currAncestor.name} to exceed weight capacity (${currAncestor.maxWeightCapacity}g).`,
        };
      }

      if (currAncestor.containedBulk() + currentDeltaBulk > currAncestor.maxBulkCapacity) {
        return {
          allowed: false,
          reason: `Item would cause ancestor container ${currAncestor.name} to exceed volume capacity (${currAncestor.maxBulkCapacity}cm³).`,
        };
      }

      // Rigid containers (chests) maintain fixed outer bulk regardless of inner contents
      if (currAncestor.containerType === 'chest') {
        currentDeltaBulk = 0;
      }

      currAncestorId = currAncestor.parentId;
    }

    return { allowed: true };
  }

  public addItem(item: Item): boolean {
    const check = this.canContain(item);
    if (!check.allowed) {
      return false;
    }

    const stackTarget = this.items.find((i) => canStack(i, item));
    if (stackTarget) {
      mergeItemStacks(stackTarget, item);
      // The absorbed stack no longer exists as a distinct item.
      itemIndex.unregister(item.id);
      return true;
    }

    this.items.push(item);
    item.parentId = this.id;
    itemIndex.register(item, { kind: 'container', containerId: this.id });
    if (this.ownerId) {
      item.ownerId = this.ownerId;
      if (item instanceof Container) {
        item.setOwnerId(this.ownerId);
      }
    }
    return true;
  }

  public removeItem(itemId: string): Item | null {
    const index = this.items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      return null;
    }
    const [removed] = this.items.splice(index, 1);
    if (removed) {
      removed.parentId = null;
      itemIndex.unregister(removed.id);
    }
    return removed;
  }

  public setOwnerId(ownerId: string | null): void {
    this.ownerId = ownerId;
    for (const item of this.items) {
      item.ownerId = ownerId;
      if (item instanceof Container) {
        item.setOwnerId(ownerId);
      }
    }
  }

  public getItem(itemId: string): Item | null {
    return this.items.find((i) => i.id === itemId) ?? null;
  }

  public hasItem(itemId: string): boolean {
    return this.items.some((i) => i.id === itemId);
  }

  public sort(mode: ContainerSortMode): void {
    const categoryOrder: Record<string, number> = {
      weapon: 1,
      armor: 2,
      shield: 3,
      helmet: 4,
      boots: 5,
      gauntlets: 6,
      bracers: 7,
      cloak: 8,
      amulet: 9,
      ring: 10,
      consumable: 11,
      container: 12,
      currency: 13,
      quest: 14,
      misc: 15,
    };

    this.items.sort((a, b) => {
      if (mode === 'category') {
        const orderA = categoryOrder[a.category] ?? 99;
        const orderB = categoryOrder[b.category] ?? 99;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.displayName.localeCompare(b.displayName);
      } else if (mode === 'weight') {
        const wtA = typeof a.totalWeight === 'function' ? a.totalWeight() : a.weight;
        const wtB = typeof b.totalWeight === 'function' ? b.totalWeight() : b.weight;
        if (wtB !== wtA) {
          return wtB - wtA; // Heaviest first
        }
        return a.displayName.localeCompare(b.displayName);
      } else if (mode === 'bulk') {
        const blkA = typeof a.totalBulk === 'function' ? a.totalBulk() : a.bulk;
        const blkB = typeof b.totalBulk === 'function' ? b.totalBulk() : b.bulk;
        if (blkB !== blkA) {
          return blkB - blkA; // Bulkiest first
        }
        return a.displayName.localeCompare(b.displayName);
      }
      return 0;
    });
  }

  private isAncestorOf(potentialChild: Container): boolean {
    for (const child of potentialChild.getItems()) {
      if (child.id === this.id) {
        return true;
      }
      if (child instanceof Container && this.isAncestorOf(child)) {
        return true;
      }
    }
    return false;
  }
}
