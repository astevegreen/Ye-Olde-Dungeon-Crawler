import { Paperdoll, type EquipmentStats, type EquipmentSlotDefinition } from './paperdoll';
import { Container } from '../items/container';
import { freshItemId } from '../items/itemIndex';
import type { Item, EquipmentSlot } from '../items/item';
import { CoinItem, coinRoom, stowCoins } from '../economy/currency';
import { COIN_BULK_CM3, COIN_VALUES } from '../economy/types';
import {
  getEncumbranceLevel,
  getEncumbranceMultiplier,
  calculateEncumberedActionCost,
  type EncumbranceLevel,
} from './encumbrance';

/** Why the worn pack can't be taken off: it is where everything else carried is. */
const PACK_STAYS = 'Your pack holds everything you carry; it stays on your back.';

export interface InventoryManagerConfig {
  primaryPack?: Container;
  slots?: EquipmentSlotDefinition[];
  ownerId?: string;
}

export class InventoryManager {
  public readonly paperdoll: Paperdoll;
  public primaryPack: Container;
  public ownerId: string | null = null;

  constructor(config?: InventoryManagerConfig) {
    this.paperdoll = new Paperdoll(config?.slots);
    this.ownerId = config?.ownerId ?? null;

    // Default adventurer pack if none provided
    this.primaryPack =
      config?.primaryPack ??
      new Container({
        id: 'default-pack',
        name: "Adventurer's Backpack",
        value: 5000,
        category: 'container',
        slot: 'pack',
        containerType: 'pack',
        weight: 1200, // 1.2kg empty
        bulk: 2500, // 2.5L empty
        maxWeightCapacity: 30000, // 30kg capacity
        maxBulkCapacity: 25000, // 25L capacity
        identified: true,
        ownerId: this.ownerId,
      });

    if (this.ownerId) {
      this.primaryPack.setOwnerId(this.ownerId);
    }

    // Equip pack into paperdoll pack slot
    this.paperdoll.equip(this.primaryPack, 'pack');
  }

  public setOwnerId(ownerId: string | null): void {
    this.ownerId = ownerId;
    this.primaryPack.setOwnerId(ownerId);
    for (const eq of this.paperdoll.getAllEquipped()) {
      eq.item.ownerId = ownerId;
      if (eq.item instanceof Container) {
        eq.item.setOwnerId(ownerId);
      }
    }
  }

  public get belt(): Container | null {
    const item = this.paperdoll.getItem('waist');
    return item instanceof Container ? item : null;
  }

  public get purse(): Container | null {
    const item = this.paperdoll.getItem('purse');
    return item instanceof Container ? item : null;
  }

  /**
   * Calculates total carried weight in grams.
   * Traverses paperdoll equipped items (which includes equipped containers and their contents).
   */
  public totalWeight(): number {
    let weight = this.paperdoll.totalWeight();

    // If primary pack is not currently equipped in the pack slot, add its weight separately
    if (this.paperdoll.getItem('pack') !== this.primaryPack) {
      weight += this.primaryPack.totalWeight();
    }

    return weight;
  }

  public getEncumbrance(strength: number): EncumbranceLevel {
    return getEncumbranceLevel(this.totalWeight(), strength);
  }

  public getEncumbranceMultiplier(strength: number): number {
    return getEncumbranceMultiplier(this.getEncumbrance(strength));
  }

  public calculateActionCost(baseCost: number, strength: number): number {
    return calculateEncumberedActionCost(baseCost, this.getEncumbrance(strength));
  }

  public getEquipmentStats(): EquipmentStats {
    return this.paperdoll.calculateStats();
  }

  /**
   * Attempts to pick up an item and stash it:
   * First tries utility belt (if quick-draw slot available), then primary pack.
   */
  public storeItem(item: Item): { success: boolean; destination: string; reason?: string } {
    // 1. Coins fill the purse, and what it has no room for goes to the pack.
    if (item instanceof CoinItem) {
      const stored = this.storeCoins(item);
      if (stored.success && this.ownerId) item.ownerId = this.ownerId;
      return stored;
    }
    //    Other currency goes to the purse (if equipped), then the pack. Container.addItem
    //    merges it into a same-denomination pile there; the absorbed pile's id retires.
    if (item.category === 'currency') {
      const targets: Array<{ container: Container | null; dest: string }> = [
        { container: this.purse, dest: 'purse' },
        { container: this.primaryPack, dest: 'pack' },
      ];
      for (const { container, dest } of targets) {
        if (container?.addItem(item)) {
          if (this.ownerId) item.ownerId = this.ownerId;
          return { success: true, destination: dest };
        }
      }
    }

    // 2. Try utility belt if equipped
    if (this.belt && this.belt.canContain(item).allowed) {
      if (this.belt.addItem(item)) {
        if (this.ownerId) item.ownerId = this.ownerId;
        return { success: true, destination: 'belt' };
      }
    }

    // 3. Store in primary pack
    const packCheck = this.primaryPack.canContain(item);
    if (packCheck.allowed) {
      this.primaryPack.addItem(item);
      if (this.ownerId) item.ownerId = this.ownerId;
      return { success: true, destination: 'pack' };
    }

    return {
      success: false,
      destination: 'none',
      reason: packCheck.reason ?? 'No container has enough room.',
    };
  }

  /**
   * Equips an item directly from the pack to the paperdoll.
   */
  public equipFromPack(itemId: string, targetSlot?: EquipmentSlot): { success: boolean; reason?: string } {
    const item = this.primaryPack.getItem(itemId);
    if (!item) {
      return { success: false, reason: 'Item not found in pack.' };
    }

    const check = this.paperdoll.canEquip(item, targetSlot);
    if (!check.allowed || !check.slot) {
      return { success: false, reason: check.reason };
    }

    if (check.slot === 'pack' && item instanceof Container && this.paperdoll.getItem('pack') === this.primaryPack) {
      return this.switchPrimaryPack(item);
    }

    // Pre-flight check: Ensure the pack can hold any displaced items
    const displacedItems: Item[] = [];
    const currentInSlot = this.paperdoll.getItem(check.slot);
    if (currentInSlot) displacedItems.push(currentInSlot);
    const pushedOut = this.paperdoll.displacedBy(item, check.slot);
    if (pushedOut) displacedItems.push(pushedOut.item);

    if (displacedItems.length > 0) {
      // Each counts with all it holds, as `addItem` counts it: a worn belt full of torches
      // comes back to the pack torches and all.
      const itemWeight = item.totalWeight();
      const itemBulk = item.totalBulk();
      const displacedWeight = displacedItems.reduce((acc, i) => acc + i.totalWeight(), 0);
      const displacedBulk = displacedItems.reduce((acc, i) => acc + i.totalBulk(), 0);

      const netWeightChange = displacedWeight - itemWeight;
      const netBulkChange = displacedBulk - itemBulk;

      if (this.primaryPack.containedWeight() + netWeightChange > this.primaryPack.maxWeightCapacity) {
        return {
          success: false,
          reason: `Pack cannot hold displaced equipment (weight limit exceeded by ${
            this.primaryPack.containedWeight() + netWeightChange - this.primaryPack.maxWeightCapacity
          } stones).`,
        };
      }

      if (this.primaryPack.containedBulk() + netBulkChange > this.primaryPack.maxBulkCapacity) {
        return {
          success: false,
          reason: `Pack cannot hold displaced equipment (bulk limit exceeded by ${
            this.primaryPack.containedBulk() + netBulkChange - this.primaryPack.maxBulkCapacity
          }).`,
        };
      }
    }

    // Remove from pack first
    this.primaryPack.removeItem(itemId);

    const equipResult = this.paperdoll.equip(item, check.slot);
    const displaced = equipResult.unequippedItems?.length
      ? equipResult.unequippedItems
      : equipResult.unequippedItem
        ? [equipResult.unequippedItem]
        : [];
    for (const unequipped of displaced) {
      if (check.slot === 'purse' && unequipped instanceof Container) this.spillPurse(unequipped);
      // Put previously equipped item back into pack. The pre-flight made room; whatever it
      // could not foresee, the item is kept rather than lost.
      if (!this.primaryPack.addItem(unequipped)) this.primaryPack.placeItem(unequipped);
    }
    // A new purse takes in the coins loose in the pack too, as far as it has room.
    if (check.slot === 'purse') this.consolidateCoins();

    return { success: true };
  }

  /**
   * A purse leaving the purse slot hands its coins back to the hero, into the purse now worn
   * or else the pack: a coin inside a purse in the pack is one nothing counts or spends.
   */
  private spillPurse(purse: Container): void {
    for (const coins of [...purse.getItems()]) {
      if (!(coins instanceof CoinItem)) continue;
      purse.removeItem(coins.id);
      if (!this.storeItem(coins).success) stowCoins(this.primaryPack, coins);
    }
  }

  /**
   * Wears `newPack`, which the current pack holds, as the pack: it takes everything the old
   * pack held, then the emptied old pack itself, and becomes the pack pickups and purchases go
   * to. All or nothing: if anything doesn't fit, everything goes back where it was.
   */
  private switchPrimaryPack(newPack: Container): { success: boolean; reason?: string } {
    const oldPack = this.primaryPack;
    oldPack.removeItem(newPack.id);

    const moved: Item[] = [];
    const rollBack = (reason: string) => {
      for (const item of moved) {
        newPack.removeItem(item.id);
        oldPack.addItem(item, false);
      }
      oldPack.addItem(newPack, false);
      return { success: false, reason };
    };

    for (const item of [...oldPack.getItems()]) {
      if (!newPack.canContain(item, false).allowed) {
        return rollBack(`The ${newPack.name} cannot hold everything in your ${oldPack.name}.`);
      }
      oldPack.removeItem(item.id);
      newPack.addItem(item, false);
      moved.push(item);
    }
    if (!newPack.canContain(oldPack, false).allowed) {
      return rollBack(`The ${newPack.name} cannot hold your ${oldPack.name} as well.`);
    }

    this.paperdoll.equip(newPack, 'pack');
    newPack.addItem(oldPack, false);
    this.primaryPack = newPack;
    this.setOwnerId(this.ownerId);
    return { success: true };
  }

  /**
   * Unequips an item from the paperdoll into the pack.
   */
  public unequipToPack(slot: EquipmentSlot): { success: boolean; reason?: string } {
    const check = this.paperdoll.canUnequip(slot);
    if (!check.allowed) {
      return { success: false, reason: check.reason };
    }

    const item = this.paperdoll.getItem(slot);
    if (!item) {
      return { success: false, reason: `No item equipped in ${slot}.` };
    }
    if (item === this.primaryPack) {
      return { success: false, reason: PACK_STAYS };
    }

    const packCheck = this.primaryPack.canContain(item);
    if (!packCheck.allowed) {
      return {
        success: false,
        reason: `Cannot unequip: pack is full (${packCheck.reason}).`,
      };
    }

    this.paperdoll.unequip(slot);
    if (slot === 'purse' && item instanceof Container) this.spillPurse(item);
    this.primaryPack.addItem(item);
    return { success: true };
  }

  /**
   * Takes off what `slot` holds so it can leave the hero (a drop). Refused for a curse, and
   * for the pack itself, which holds everything else carried. A purse hands back its coins
   * first, as it does when unequipped.
   */
  public takeOffToDrop(slot: EquipmentSlot): { success: true; item: Item } | { success: false; reason: string } {
    const check = this.paperdoll.canUnequip(slot);
    if (!check.allowed) return { success: false, reason: check.reason ?? 'Cannot remove cursed item.' };
    const item = this.paperdoll.getItem(slot);
    if (!item) return { success: false, reason: `No item equipped in ${slot}.` };
    if (item === this.primaryPack) return { success: false, reason: PACK_STAYS };
    this.paperdoll.unequip(slot);
    if (slot === 'purse' && item instanceof Container) this.spillPurse(item);
    return { success: true, item };
  }

  /**
   * The containers the hero carries at the top: the pack, belt, purse and any other worn
   * container. Items inside them, at any depth, are carried.
   */
  private topContainers(): Container[] {
    const roots: Container[] = [this.primaryPack];
    if (this.belt) roots.push(this.belt);
    if (this.purse) roots.push(this.purse);
    for (const { item } of this.paperdoll.getAllEquipped()) {
      if (item instanceof Container && !roots.includes(item)) roots.push(item);
    }
    return roots;
  }

  /** The container holding `itemId`, at any depth (a potion in a bag in the pack), if any. */
  private holderOf(itemId: string): Container | undefined {
    const search = (container: Container): Container | undefined => {
      if (container.getItem(itemId)) return container;
      for (const child of container.getItems()) {
        if (child instanceof Container) {
          const hit = search(child);
          if (hit) return hit;
        }
      }
      return undefined;
    };
    for (const root of this.topContainers()) {
      const hit = search(root);
      if (hit) return hit;
    }
    return undefined;
  }

  /**
   * Scoped lookup: is this item in *this* inventory? Searches every carried container at
   * any depth, as `getAllCarriedItems` lists them, then the worn items themselves.
   */
  public findItemById(itemId: string): Item | undefined {
    const held = this.holderOf(itemId)?.getItem(itemId);
    if (held) return held;
    return this.paperdoll.getAllEquipped().find((eq) => eq.item.id === itemId)?.item;
  }

  /**
   * Safely removes an item from anywhere in the inventory (any carried container at any
   * depth, or the paperdoll) and clears its parentId pointer.
   */
  public removeItem(itemId: string): Item | null {
    const fromContainer = this.holderOf(itemId)?.removeItem(itemId);
    if (fromContainer) {
      fromContainer.parentId = null;
      return fromContainer;
    }

    for (const { slot, item } of this.paperdoll.getAllEquipped()) {
      if (item.id === itemId) {
        this.paperdoll.unequip(slot);
        item.parentId = null;
        return item;
      }
    }

    return null;
  }

  /**
   * Uses up one unit of a carried item: a stack loses one, a single item leaves the inventory.
   * Returns false when the item is not carried.
   */
  public consumeOne(itemId: string): boolean {
    const item = this.findItemById(itemId);
    if (!item) return false;
    if ((item.quantity ?? 1) > 1) {
      item.quantity -= 1;
      return true;
    }
    return this.removeItem(itemId) !== null;
  }

  /**
   * Coins fill the purse while it has room and the rest go to the pack, so a pile that only
   * partly fits is split. All or nothing overall: a pile the two can't hold between them
   * stays whole where it was.
   */
  private storeCoins(coins: CoinItem): { success: boolean; destination: string; reason?: string } {
    const purse = this.purse;
    const toPurse = purse ? Math.min(coins.count, coinRoom(purse, coins.denomination)) : 0;
    const rest = coins.count - toPurse;
    if (rest > 0 && rest > coinRoom(this.primaryPack, coins.denomination)) {
      return { success: false, destination: 'none', reason: 'Your purse and pack have no room for that many coins.' };
    }
    if (purse && rest === 0) {
      purse.addItem(coins);
      return { success: true, destination: 'purse' };
    }
    if (purse && toPurse > 0) {
      purse.addItem(new CoinItem({ id: freshItemId(`${coins.id}-purse`), denomination: coins.denomination, count: toPurse }));
      coins.setCount(rest);
      this.primaryPack.addItem(coins);
      return { success: true, destination: 'purse and pack' };
    }
    this.primaryPack.addItem(coins);
    return { success: true, destination: 'pack' };
  }

  /**
   * A load puts back what the save held, and an older save's purse may hold more coins than
   * it has room for now: the excess goes to the pack, cheapest coins first.
   */
  public settlePurse(): void {
    const purse = this.purse;
    if (!purse) return;
    let excess = Math.ceil((purse.containedBulk() - purse.maxBulkCapacity) / COIN_BULK_CM3);
    const piles = purse
      .getItems()
      .filter((i): i is CoinItem => i instanceof CoinItem)
      .sort((a, b) => COIN_VALUES[a.denomination] - COIN_VALUES[b.denomination]);
    for (const pile of piles) {
      if (excess <= 0) break;
      const moved = Math.min(pile.count, excess);
      excess -= moved;
      if (moved === pile.count) {
        purse.removeItem(pile.id);
        stowCoins(this.primaryPack, pile);
      } else {
        pile.setCount(pile.count - moved);
        stowCoins(this.primaryPack, new CoinItem({ id: freshItemId(`${pile.id}-spill`), denomination: pile.denomination, count: moved }));
      }
    }
  }

  /**
   * Fast Purse Consolidation:
   * Automatically sweeps loose coins from general pack containers (and sub-containers)
   * directly into the equipped coin purse.
   */
  public consolidateCoins(): { count: number; value: number } {
    const purse = this.purse;
    if (!purse) {
      return { count: 0, value: 0 };
    }

    let movedCount = 0;
    let movedValue = 0;

    // As many coins as the purse has room for: a pile that only partly fits is split.
    const sweepContainer = (c: Container) => {
      const items = [...c.getItems()];
      for (const item of items) {
        if (item instanceof CoinItem) {
          const room = coinRoom(purse, item.denomination);
          if (room <= 0) continue;
          let moving = item;
          if (room >= item.count) {
            c.removeItem(item.id);
          } else {
            item.setCount(item.count - room);
            moving = new CoinItem({ id: freshItemId(`${item.id}-purse`), denomination: item.denomination, count: room });
          }
          purse.addItem(moving);
          movedCount += 1;
          movedValue += moving.valueInCp;
        } else if (item instanceof Container && item !== purse) {
          sweepContainer(item);
        }
      }
    };

    sweepContainer(this.primaryPack);

    if (this.belt) {
      sweepContainer(this.belt);
    }

    return { count: movedCount, value: movedValue };
  }

  /**
   * Returns a flat array of all items currently carried by the player
   * (primary pack, equipped slots, belt, purse, and all sub-containers).
   */
  public getAllCarriedItems(): Item[] {
    const all: Item[] = [];
    const collectFromContainer = (c: Container) => {
      for (const item of c.getItems()) {
        all.push(item);
        if (item instanceof Container) {
          collectFromContainer(item);
        }
      }
    };

    collectFromContainer(this.primaryPack);

    for (const eq of this.paperdoll.getAllEquipped()) {
      all.push(eq.item);
      if (eq.item instanceof Container && eq.item !== this.primaryPack) {
        collectFromContainer(eq.item);
      }
    }

    return all;
  }
}


