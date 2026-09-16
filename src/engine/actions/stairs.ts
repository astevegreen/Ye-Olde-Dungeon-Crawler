import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Player } from '../entities/player';
import type { GameEngine } from '../engine';

export class ClimbStairsAction implements Action {
  public readonly entity: Player;

  constructor(player: Player) {
    this.entity = player;
  }

  public perform(engine: GameEngine): ActionResult {
    const tile = engine.map.getTile(this.entity.x, this.entity.y);
    if (!tile) {
      return { success: false, cost: 0, message: 'No stairs here.' };
    }

    if (tile.isStairsDown || tile.type === 'stairs_down') {
      const maxFloor =
        (engine.manifest.quest?.allowsDifficultyScaling
          ? (engine.player.maxFloor ?? engine.manifest.quest.maxFloor)
          : (engine.manifest.quest?.maxFloor ?? engine.player.maxFloor)) ?? 25;
      if (engine.currentFloor >= maxFloor) {
        return {
          success: false,
          cost: 0,
          message: 'You have reached the bottom of the dungeon; there are no stairs leading further down.',
        };
      }
      const nextFloor = engine.currentFloor + 1;
      engine.changeFloor(nextFloor);
      const cost = this.entity.getActionCost(BASE_ACTION_COST);
      this.entity.consumeEnergy(cost);
      return {
        success: true,
        cost,
        message: `You descend the stairs down to Floor ${nextFloor}.`,
      };
    }

    if (tile.isStairsUp || tile.type === 'stairs_up') {
      const prevFloor = Math.max(0, engine.currentFloor - 1);
      engine.changeFloor(prevFloor);
      const cost = this.entity.getActionCost(BASE_ACTION_COST);
      this.entity.consumeEnergy(cost);
      return {
        success: true,
        cost,
        message: prevFloor === 0
          ? `You climb the stairs up into ${engine.manifest?.town?.name ?? 'town'}.`
          : `You climb the stairs up to Floor ${prevFloor}.`,
      };
    }

    return {
      success: false,
      cost: 0,
      message: 'There are no stairs here to climb.',
    };
  }
}
