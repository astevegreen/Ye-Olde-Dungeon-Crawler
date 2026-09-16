import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { EquipmentSlot, Item } from '../items/item';
import { recordMilestone } from '../renown/renownLedger';

export interface UncurseTarget {
  slot?: EquipmentSlot;
  itemId?: string;
}

export class UncurseAction implements Action {
  public readonly actor: Entity;
  public readonly target?: UncurseTarget;

  constructor(actor: Entity, target?: UncurseTarget) {
    this.actor = actor;
    this.target = target;
  }

  public perform(engine: GameEngine): ActionResult {
    const actorAny = this.actor as any;
    const uncursedItems: Item[] = [];
    const removedAllModifiers: string[] = [];

    const tryUncurse = (item: Item | null): boolean => {
      if (!item) return false;
      if (item.isCursed()) {
        const res = item.uncurse();
        if (res.uncursed) {
          uncursedItems.push(item);
          removedAllModifiers.push(...res.removedModifiers);
          engine.emitGameEvent({
            type: 'uncurse',
            turn: engine.turnCount,
            actorId: this.actor.id,
            itemId: item.id,
            removedModifiers: res.removedModifiers,
          });
          return true;
        }
      }
      return false;
    };

    if (this.target?.slot && actorAny.inventory?.paperdoll) {
      const item = actorAny.inventory.paperdoll.getItem(this.target.slot);
      tryUncurse(item);
    } else if (this.target?.itemId && actorAny.inventory) {
      const item = actorAny.inventory.findItemById
        ? actorAny.inventory.findItemById(this.target.itemId)
        : null;
      tryUncurse(item);
    } else {
      // Uncurse all equipped and carried cursed items
      if (actorAny.inventory?.paperdoll) {
        for (const equipped of actorAny.inventory.paperdoll.getEquippedItems()) {
          tryUncurse(equipped);
        }
      }
      if (actorAny.inventory?.primaryPack) {
        for (const carried of actorAny.inventory.primaryPack.getItems()) {
          tryUncurse(carried);
        }
      }
    }

    const actionCost = this.actor.getActionCost(BASE_ACTION_COST);
    this.actor.consumeEnergy(actionCost);

    if (uncursedItems.length === 0) {
      const msg = `${this.actor.name} invokes purifying power, but no cursed items were found.`;
      engine.log(msg);
      return {
        success: true,
        cost: actionCost,
        message: msg,
      };
    }

    const itemNames = uncursedItems.map((i) => i.name).join(', ');
    const msg = `Purifying light envelops ${this.actor.name}! The curse on ${itemNames} has been broken!`;
    engine.log(msg);
    recordMilestone(engine, 'item_uncursed');
    engine.recordVisualEffects([
      {
        type: 'burst',
        epicenter: { x: this.actor.x, y: this.actor.y },
        radius: 1,
        color: '#38bdf8',
        durationMs: 200,
      },
    ]);

    return {
      success: true,
      cost: actionCost,
      message: msg,
    };
  }
}
