import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import type { Item } from '../items/item';

/**
 * Action to identify an item, revealing its enchantments, affixes, quality, and full power.
 */
export class IdentifyAction implements Action {
  public readonly player: Player;
  public readonly itemOrId: Item | string;

  constructor(player: Player, item: Item | string) {
    this.player = player;
    this.itemOrId = item;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot identify items.' };
    }

    const targetItem: Item | undefined =
      typeof this.itemOrId === 'string'
        ? this.player.inventory.findItemById(this.itemOrId)
        : this.itemOrId;

    if (!targetItem) {
      return { success: false, cost: 0, message: 'Item not found in inventory.' };
    }

    const cost = this.player.getActionCost(BASE_ACTION_COST);
    this.player.consumeEnergy(cost);

    engine.identification.identifyItem(targetItem);

    let details = `${targetItem.displayName}`;
    if (targetItem.stats.attackBonus) details += ` (+${targetItem.stats.attackBonus} Atk)`;
    if (targetItem.stats.defenseBonus) details += ` (+${targetItem.stats.defenseBonus} Def)`;
    if (targetItem.elementalAffix) {
      details += ` [${targetItem.elementalAffix.name} +${targetItem.elementalAffix.bonusDamage} ${targetItem.elementalAffix.element.toUpperCase()}]`;
    }
    if (targetItem.isBound()) {
      details += ' (CURSED!)';
    }

    const message = `You discern the true nature of the item: It is a ${details}!`;
    engine.log(message);

    return {
      success: true,
      cost,
      message,
    };
  }
}
