import type { Action } from './action';
import type { Item } from '../items/item';
import { Container } from '../items/container';
import { wearsFlag } from '../items/wornModifiers';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import { Player } from '../entities/player';
import type { GameEngine } from '../engine';

/** The deepest floor this run goes: the hero's difficulty depth when the quest scales
 *  with difficulty, else the quest's own; 25 when neither says. */
export function resolveLastFloor(engine: Pick<GameEngine, 'manifest' | 'player'>): number {
  return (
    (engine.manifest.quest?.allowsDifficultyScaling
      ? (engine.player.maxFloor ?? engine.manifest.quest.maxFloor)
      : (engine.manifest.quest?.maxFloor ?? engine.player.maxFloor)) ?? 25
  );
}


/** Everything the hero carries: pack, belt and worn, containers opened. */
export function carriedItems(player: Player): Item[] {
  const out: Item[] = [];
  const visit = (item: Item): void => {
    out.push(item);
    if (item instanceof Container) for (const inner of item.getItems()) visit(inner);
  };
  for (const item of player.inventory.primaryPack.getItems()) visit(item);
  for (const item of player.inventory.paperdoll.getEquippedItems()) visit(item);
  return out;
}

/**
 * Lore-Keeper (`identifiesCarriedOnStairs`): taking the stairs identifies every unidentified
 * item carried since the stairs were last taken. Every stairs use remembers what is carried,
 * perk or not, so the perk counts from the floor it was taken on.
 */
export function identifyCarriedSinceStairs(engine: GameEngine, player: Player): void {
  const carried = carriedItems(player);
  if (wearsFlag(player, 'identifiesCarriedOnStairs')) {
    const since = new Set(player.carriedAtStairs);
    for (const item of carried) {
      if (item.identified || !since.has(item.id)) continue;
      item.identified = true;
      engine.log(`A floor's handling has told you what this is: ${item.displayName}.`);
    }
  }
  player.carriedAtStairs = carried.map((item) => item.id);
}

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
      const maxFloor = resolveLastFloor(engine);
      if (engine.currentFloor >= maxFloor) {
        return {
          success: false,
          cost: 0,
          message: 'You have reached the bottom of the dungeon; there are no stairs leading further down.',
        };
      }
      const nextFloor = engine.currentFloor + 1;
      if (this.entity instanceof Player) identifyCarriedSinceStairs(engine, this.entity);
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
      if (this.entity instanceof Player) identifyCarriedSinceStairs(engine, this.entity);
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
