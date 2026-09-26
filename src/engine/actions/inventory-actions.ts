import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import { Player } from '../entities/player';
import type { Item, EquipmentSlot } from '../items/item';
import { Container } from '../items/container';
import { CombatLogger } from '../logging/combatLogger';

export class PickUpAction implements Action {
  public readonly player: Player;
  public readonly itemId?: string;

  constructor(player: Player, itemId?: string) {
    this.player = player;
    this.itemId = itemId;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot pick up items while dead.' };
    }

    const groundItems = engine.map.getItemsAt(this.player.x, this.player.y);
    if (groundItems.length === 0) {
      const msg = 'There is nothing here to pick up.';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const itemToPick = this.itemId
      ? groundItems.find((i) => i.id === this.itemId)
      : groundItems[groundItems.length - 1]; // Pick top item

    if (!itemToPick) {
      return { success: false, cost: 0, message: 'Specified item was not found on the ground.' };
    }

    // Try storing in player inventory (purse, belt, or pack)
    const storeResult = this.player.inventory.storeItem(itemToPick);
    if (!storeResult.success) {
      // If the item is a container with nested items (e.g. heavy chest), loot from inside it
      if (itemToPick instanceof Container && itemToPick.getItems().length > 0) {
        itemToPick.markOpened();
        const contained = itemToPick.getItems()[0];
        const removed = itemToPick.removeItem(contained.id);
        if (removed) {
          const subStore = this.player.inventory.storeItem(removed);
          if (subStore.success) {
            const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
            this.player.consumeEnergy(cost);
            const msg = `Took ${removed.displayName} from ${itemToPick.displayName} (stored in ${subStore.destination}).`;
            engine.log(msg);
            return { success: true, cost, message: msg };
          } else {
            itemToPick.addItem(removed);
            const msg = `Cannot loot from ${itemToPick.displayName}: ${subStore.reason}`;
            engine.log(msg);
            return { success: false, cost: 0, message: msg };
          }
        }
      }

      const msg = `Cannot pick up ${itemToPick.displayName}: ${storeResult.reason}`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    // Remove from map ground
    engine.map.removeItemAt(this.player.x, this.player.y, itemToPick.id);

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const msg = CombatLogger.formatPickupMessage(itemToPick, storeResult.destination);
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class DropAction implements Action {
  public readonly player: Player;
  public readonly item: Item;
  public readonly source: 'paperdoll' | 'pack';
  public readonly slot?: EquipmentSlot;

  constructor(player: Player, item: Item, source: 'paperdoll' | 'pack' = 'pack', slot?: EquipmentSlot) {
    this.player = player;
    this.item = item;
    this.source = source;
    this.slot = slot;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot drop items while dead.' };
    }

    if (this.source === 'paperdoll' && this.slot) {
      const unequipCheck = this.player.inventory.paperdoll.canUnequip(this.slot);
      if (!unequipCheck.allowed) {
        engine.log(unequipCheck.reason ?? 'Cannot remove cursed item.');
        return { success: false, cost: 0, message: unequipCheck.reason };
      }
      this.player.inventory.paperdoll.unequip(this.slot);
    } else {
      const removed = this.player.inventory.primaryPack.removeItem(this.item.id);
      if (!removed) {
        return { success: false, cost: 0, message: 'Item is not in your pack.' };
      }
    }

    this.item.parentId = null;
    this.item.ownerId = null;
    if (this.item instanceof Container) {
      this.item.setOwnerId(null);
    }
    engine.map.addItemAt(this.player.x, this.player.y, this.item);

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const msg = `Dropped ${this.item.displayName} onto the floor.`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class EquipAction implements Action {
  public readonly player: Player;
  public readonly itemId: string;
  public readonly targetSlot?: EquipmentSlot;

  constructor(player: Player, itemId: string, targetSlot?: EquipmentSlot) {
    this.player = player;
    this.itemId = itemId;
    this.targetSlot = targetSlot;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot equip items while dead.' };
    }

    const item = this.player.inventory.primaryPack.getItem(this.itemId);
    if (!item) {
      return { success: false, cost: 0, message: 'Item not found in pack.' };
    }

    const result = this.player.inventory.equipFromPack(this.itemId, this.targetSlot);
    if (!result.success) {
      engine.log(result.reason ?? 'Cannot equip item.');
      return { success: false, cost: 0, message: result.reason };
    }

    // Auto-identify upon equipping (or reveal curses)
    if (item.isCursed()) {
      item.identified = true;
    }

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    let msg = `Equipped ${item.displayName}.`;
    if (item.isCursed()) {
      msg += ' Oh no! The item is cursed and binds tightly to you!';
    }
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class UnequipAction implements Action {
  public readonly player: Player;
  public readonly slot: EquipmentSlot;

  constructor(player: Player, slot: EquipmentSlot) {
    this.player = player;
    this.slot = slot;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot unequip items while dead.' };
    }

    const item = this.player.inventory.paperdoll.getItem(this.slot);
    if (!item) {
      return { success: false, cost: 0, message: `No item equipped in ${this.slot}.` };
    }

    const result = this.player.inventory.unequipToPack(this.slot);
    if (!result.success) {
      engine.log(result.reason ?? 'Cannot unequip item.');
      return { success: false, cost: 0, message: result.reason };
    }

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const msg = `Unequipped ${item.displayName} to pack.`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class QuickLootAction implements Action {
  public readonly player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot pick up items while dead.' };
    }

    const groundItems = [...engine.map.getItemsAt(this.player.x, this.player.y)];
    if (groundItems.length === 0) {
      const msg = 'There is nothing here to pick up.';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const lootedItems: Item[] = [];
    let failureReason: string | undefined;

    for (const item of groundItems) {
      if (item instanceof Container && item.getItems().length > 0) {
        // If the ground item is a container with nested items, loot its contents directly
        item.markOpened();
        const containedItems = [...item.getItems()];
        for (const subItem of containedItems) {
          const removed = item.removeItem(subItem.id);
          if (!removed) continue;
          const subStore = this.player.inventory.storeItem(removed);
          if (subStore.success) {
            lootedItems.push(removed);
          } else {
            item.addItem(removed);
            failureReason = subStore.reason;
            break;
          }
        }
        if (failureReason) {
          break;
        }
      }

      const storeResult = this.player.inventory.storeItem(item);
      if (storeResult.success) {
        engine.map.removeItemAt(this.player.x, this.player.y, item.id);
        lootedItems.push(item);
      } else {
        // If it was a container whose contents were looted, leaving the heavy empty container on the floor is expected
        if (item instanceof Container && lootedItems.length > 0) {
          continue;
        }
        failureReason = storeResult.reason;
        // Cease looting further items if containers cannot store
        break;
      }
    }

    if (lootedItems.length === 0) {
      const msg = `Could not quick-loot items: ${failureReason ?? 'Inventory is full.'}`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const names = lootedItems.map((i) => i.displayName).join(', ');
    let msg = `Quick-looted ${lootedItems.length} item${lootedItems.length > 1 ? 's' : ''}: ${names}.`;
    if (failureReason) {
      msg += ` (Remaining items left on ground: ${failureReason})`;
    }
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class LootFromContainerAction implements Action {
  public readonly player: Player;
  public readonly container: Container;
  public readonly item: Item;

  constructor(player: Player, container: Container, item: Item) {
    this.player = player;
    this.container = container;
    this.item = item;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot loot items while dead.' };
    }

    this.container.markOpened();
    const removed = this.container.removeItem(this.item.id);
    if (!removed) {
      return { success: false, cost: 0, message: 'Item is no longer inside the container.' };
    }

    const storeResult = this.player.inventory.storeItem(removed);
    if (!storeResult.success) {
      this.container.addItem(removed);
      const msg = `Cannot loot ${this.item.displayName}: ${storeResult.reason}`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const msg = `Took ${this.item.displayName} from ${this.container.displayName} (stored in ${storeResult.destination}).`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class StoreInContainerAction implements Action {
  public readonly player: Player;
  public readonly container: Container;
  public readonly item: Item;

  constructor(player: Player, container: Container, item: Item) {
    this.player = player;
    this.container = container;
    this.item = item;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot store items while dead.' };
    }

    this.container.markOpened();
    const check = this.container.canContain(this.item);
    if (!check.allowed) {
      const msg = `Cannot place into ${this.container.displayName}: ${check.reason}`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const removed = this.player.inventory.primaryPack.removeItem(this.item.id);
    if (!removed) {
      return { success: false, cost: 0, message: 'Item is not in your pack.' };
    }

    this.container.addItem(this.item);

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const msg = `Placed ${this.item.displayName} into ${this.container.displayName}.`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class LootAllFromContainerAction implements Action {
  public readonly player: Player;
  public readonly container: Container;

  constructor(player: Player, container: Container) {
    this.player = player;
    this.container = container;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot loot items while dead.' };
    }

    this.container.markOpened();
    const items = [...this.container.getItems()];
    if (items.length === 0) {
      const msg = `${this.container.displayName} is empty.`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const looted: Item[] = [];
    let failureReason: string | undefined;

    for (const item of items) {
      const removed = this.container.removeItem(item.id);
      if (!removed) continue;
      const res = this.player.inventory.storeItem(removed);
      if (res.success) {
        looted.push(removed);
      } else {
        this.container.addItem(removed);
        failureReason = res.reason;
        break;
      }
    }

    if (looted.length === 0) {
      const msg = `Could not loot from ${this.container.displayName}: ${failureReason ?? 'Pack is full.'}`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const cost = this.player.inventory.calculateActionCost(BASE_ACTION_COST, this.player.strength);
    this.player.consumeEnergy(cost);

    const names = looted.map((i) => i.displayName).join(', ');
    let msg = `Looted ${looted.length} item${looted.length > 1 ? 's' : ''} from ${this.container.displayName}: ${names}.`;
    if (failureReason) {
      msg += ` (${failureReason})`;
    }
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}


