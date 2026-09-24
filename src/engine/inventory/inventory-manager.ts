import { Paperdoll, type EquipmentStats, type EquipmentSlotDefinition } from './paperdoll';
import { Container } from '../items/container';
import type { Item, EquipmentSlot } from '../items/item';
import {
  getEncumbranceLevel,
  getEncumbranceMultiplier,
  calculateEncumberedActionCost,
  type EncumbranceLevel,
} from './encumbrance';
import { parseCoinItem, CoinItem } from '../economy/currency';
import { COIN_WEIGHT_GRAMS } from '../economy/types';
import { itemIndex } from '../items/itemIndex';

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
    // 1. If item is currency, route into purse first (if equipped), then primaryPack
    if (item.category === 'currency') {
      const parsed = parseCoinItem(item);
      const targetContainers: Array<{ container: Container; dest: string }> = [];
      if (this.purse) targetContainers.push({ container: this.purse, dest: 'purse' });
      targetContainers.push({ container: this.primaryPack, dest: 'pack' });

      for (const { container, dest } of targetContainers) {
        if (parsed) {
          const existing = container.getItems().find(
            (i) => i instanceof CoinItem && i.denomination === parsed.denomination
          ) as CoinItem | undefined;

          if (existing) {
            const addedWeight = parsed.count * COIN_WEIGHT_GRAMS;
            const addedBulk = Math.max(0, Math.ceil((existing.count + parsed.count) * 0.5) - existing.bulk);
            if (
              container.totalWeight() + addedWeight <= container.maxWeightCapacity &&
              container.totalBulk() + addedBulk <= container.maxBulkCapacity
            ) {
              existing.add(parsed.count, item.id);
              if (item.id && item.id !== existing.id) itemIndex.unregister(item.id);
              return { success: true, destination: dest };
            }
          } else {
            if (item instanceof CoinItem) {
              if (container.canContain(item).allowed && container.addItem(item)) {
                if (this.ownerId) item.ownerId = this.ownerId;
                return { success: true, destination: dest };
              }
            } else {
              const newCoin = new CoinItem({
                id: item.id,
                denomination: parsed.denomination,
                count: parsed.count,
                ownerId: this.ownerId,
              });
              if (container.canContain(newCoin).allowed && container.addItem(newCoin)) {
                return { success: true, destination: dest };
              }
            }
          }
        } else {
          if (container.canContain(item).allowed && container.addItem(item)) {
            if (this.ownerId) item.ownerId = this.ownerId;
            return { success: true, destination: dest };
          }
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

    // Pre-flight check: Ensure the pack can hold any displaced items
    const blockedSlot = (item.blocksSlot ?? (item.twoHanded && check.slot === 'mainHand' ? 'offHand' : undefined)) as EquipmentSlot | undefined;
    const displacedItems: Item[] = [];
    const currentInSlot = this.paperdoll.getItem(check.slot);
    if (currentInSlot) displacedItems.push(currentInSlot);
    if (blockedSlot) {
      const currentInBlocked = this.paperdoll.getItem(blockedSlot);
      if (currentInBlocked) displacedItems.push(currentInBlocked);
    }

    if (displacedItems.length > 0) {
      const itemWeight = item.unitWeight ?? item.weight;
      const itemBulk = item.bulk;
      const displacedWeight = displacedItems.reduce((acc, i) => acc + (i.unitWeight ?? i.weight), 0);
      const displacedBulk = displacedItems.reduce((acc, i) => acc + i.bulk, 0);

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
    if (equipResult.unequippedItems && equipResult.unequippedItems.length > 0) {
      for (const unequipped of equipResult.unequippedItems) {
        this.primaryPack.addItem(unequipped);
      }
    } else if (equipResult.unequippedItem) {
      // Put previously equipped item back into pack
      this.primaryPack.addItem(equipResult.unequippedItem);
    }

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

    const packCheck = this.primaryPack.canContain(item);
    if (!packCheck.allowed) {
      return {
        success: false,
        reason: `Cannot unequip: pack is full (${packCheck.reason}).`,
      };
    }

    this.paperdoll.unequip(slot);
    this.primaryPack.addItem(item);
    return { success: true };
  }

  /**
   * Finds an item anywhere in the inventory (pack, equipped items, or sub-containers).
   */
  /**
   * Scoped lookup: is this item in *this* inventory? Belt and purse are searched too —
   * `removeItem` has always checked them, so an item there was removable but not findable.
   */
  public findItemById(itemId: string): Item | undefined {
    const checkItem = (it: Item): boolean => {
      if (it.id === itemId) return true;
      if (it instanceof CoinItem && it.mergedIds?.has(itemId)) return true;
      return false;
    };

    const fromPack = this.primaryPack.getItem(itemId) ?? this.primaryPack.getItems().find(checkItem);
    if (fromPack) return fromPack;
    const fromBelt = this.belt ? (this.belt.getItem(itemId) ?? this.belt.getItems().find(checkItem)) : undefined;
    if (fromBelt) return fromBelt;
    const fromPurse = this.purse ? (this.purse.getItem(itemId) ?? this.purse.getItems().find(checkItem)) : undefined;
    if (fromPurse) return fromPurse;
    const equipped = this.paperdoll.getAllEquipped();
    for (const eq of equipped) {
      if (checkItem(eq.item)) return eq.item;
      if (eq.item instanceof Container) {
        const sub = eq.item.getItem(itemId) ?? eq.item.getItems().find(checkItem);
        if (sub) return sub;
      }
    }
    return undefined;
  }

  /**
   * Safely removes an item from anywhere in the inventory (pack, belt, purse, or paperdoll)
   * and clears its parentId pointer.
   */
  public removeItem(itemId: string): Item | null {
    // 1. Check primary pack
    const fromPack = this.primaryPack.removeItem(itemId);
    if (fromPack) {
      fromPack.parentId = null;
      return fromPack;
    }

    // 2. Check utility belt
    if (this.belt) {
      const fromBelt = this.belt.removeItem(itemId);
      if (fromBelt) {
        fromBelt.parentId = null;
        return fromBelt;
      }
    }

    // 3. Check purse
    if (this.purse) {
      const fromPurse = this.purse.removeItem(itemId);
      if (fromPurse) {
        fromPurse.parentId = null;
        return fromPurse;
      }
    }

    // 4. Check paperdoll equipped items & equipped subcontainers
    for (const { slot, item } of this.paperdoll.getAllEquipped()) {
      if (item.id === itemId) {
        this.paperdoll.unequip(slot);
        item.parentId = null;
        return item;
      }
      if (item instanceof Container) {
        const fromSub = item.removeItem(itemId);
        if (fromSub) {
          fromSub.parentId = null;
          return fromSub;
        }
      }
    }

    return null;
  }

  /**
   * Fast Purse Consolidation:
   * Automatically sweeps loose coins from general pack containers (and sub-containers)
   * directly into the equipped coin purse.
   */
  public consolidateCoins(): { count: number; value: number } {
    if (!this.purse) {
      return { count: 0, value: 0 };
    }

    let movedCount = 0;
    let movedValue = 0;

    const sweepContainer = (c: Container) => {
      const items = [...c.getItems()];
      for (const item of items) {
        if (item.category === 'currency') {
          if (this.purse && this.purse.canContain(item).allowed) {
            c.removeItem(item.id);
            this.purse.addItem(item);
            movedCount += 1;
            movedValue += item.value ?? 0;
          }
        } else if (item instanceof Container && item !== this.purse) {
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


