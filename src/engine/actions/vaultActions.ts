import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import type { Actor } from '../entities/actor';
import type { Item } from '../items/item';
import { depositToVault, removeFromVault, getVaultItems } from '../state/worldState';

/**
 * Deposits an item from an actor's carried inventory into a remote vault partitioned by `vaultId`.
 */
export class DepositToVaultAction implements Action {
  public readonly actor: Actor;
  public readonly item: Item;
  public readonly vaultId: string;
  public readonly quantity?: number;

  constructor(actor: Actor, item: Item, vaultId: string, quantity?: number) {
    this.actor = actor;
    this.item = item;
    this.vaultId = vaultId;
    this.quantity = quantity;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.actor.isAlive()) {
      return { success: false, cost: 0, message: `${this.actor.name} cannot access storage while dead.` };
    }

    if (!engine.worldState) {
      return { success: false, cost: 0, message: 'World state is unavailable.' };
    }

    // Check if actor carries the item
    const inventory = this.actor.inventory;
    let removedItem: Item | null = null;

    {
      if (this.quantity && this.quantity < this.item.quantity) {
        // Partial split deposit
        this.item.quantity -= this.quantity;
        const clonedConfig = {
          ...this.item,
          id: engine.nextSimulationId(`${this.item.id}_vault`),
          quantity: this.quantity,
          stats: { ...this.item.stats },
          durability: this.item.durability ? { ...this.item.durability } : undefined,
        };
        // Use item constructor from prototype
        const ItemCtor = Object.getPrototypeOf(this.item).constructor;
        removedItem = new ItemCtor(clonedConfig);
      } else {
        removedItem = inventory.primaryPack.removeItem(this.item.id);
        if (!removedItem && inventory.belt) {
          removedItem = inventory.belt.removeItem(this.item.id);
        }
        if (!removedItem && inventory.purse) {
          removedItem = inventory.purse.removeItem(this.item.id);
        }
        if (!removedItem) {
          // If equipped, unequip first
          const slot = this.item.slot;
          if (slot && inventory.paperdoll.getItem(slot) === this.item) {
            inventory.paperdoll.unequip(slot);
            removedItem = this.item;
          }
        }
      }
    }

    if (!removedItem) {
      return {
        success: false,
        cost: 0,
        message: `${this.actor.name} does not possess ${this.item.name}.`,
      };
    }

    depositToVault(engine.worldState, this.vaultId, removedItem);

    const cost = this.actor.getActionCost ? this.actor.getActionCost(BASE_ACTION_COST) : BASE_ACTION_COST;
    this.actor.consumeEnergy(cost);

    const msg = `Deposited ${removedItem.displayName} into vault [${this.vaultId}].`;
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}

/**
 * Withdraws an item from a remote vault partitioned by `vaultId` into the actor's inventory.
 */
export class WithdrawFromVaultAction implements Action {
  public readonly actor: Actor;
  public readonly itemOrId: Item | string;
  public readonly vaultId: string;

  constructor(actor: Actor, itemOrId: Item | string, vaultId: string) {
    this.actor = actor;
    this.itemOrId = itemOrId;
    this.vaultId = vaultId;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.actor.isAlive()) {
      return { success: false, cost: 0, message: `${this.actor.name} cannot access storage while dead.` };
    }

    if (!engine.worldState) {
      return { success: false, cost: 0, message: 'World state is unavailable.' };
    }

    const items = getVaultItems(engine.worldState, this.vaultId);
    const targetId = typeof this.itemOrId === 'string' ? this.itemOrId : this.itemOrId.id;
    const itemInVault = items.find((i) => i.id === targetId);

    if (!itemInVault) {
      return {
        success: false,
        cost: 0,
        message: `Item not found in vault [${this.vaultId}].`,
      };
    }

    if (!this.actor.inventory.primaryPack.addItem(itemInVault)) {
      return {
        success: false,
        cost: 0,
        message: `${this.actor.name}'s pack cannot hold ${itemInVault.displayName}.`,
      };
    }

    // Remove from vault now that it was successfully transferred
    removeFromVault(engine.worldState, this.vaultId, itemInVault);

    const cost = this.actor.getActionCost ? this.actor.getActionCost(BASE_ACTION_COST) : BASE_ACTION_COST;
    this.actor.consumeEnergy(cost);

    const msg = `Withdrew ${itemInVault.displayName} from vault [${this.vaultId}].`;
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}
