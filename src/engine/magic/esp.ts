import type { Action } from '../actions/action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';

/**
 * Action to activate ESP / Monster Detection for a set duration.
 */
export class DetectMonstersAction implements Action {
  public readonly player: Player;
  public readonly duration: number;

  constructor(player: Player, duration = 30) {
    this.player = player;
    this.duration = duration;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot detect monsters.' };
    }

    const cost = this.player.getActionCost(BASE_ACTION_COST);
    this.player.consumeEnergy(cost);

    engine.detectMonstersTurns += this.duration;
    const msg = `Your mind expands beyond physical barriers! You can sense living beings through walls (${engine.detectMonstersTurns} turns).`;
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}

/**
 * Action to activate Object / Treasure Sensing for a set duration.
 */
export class DetectObjectsAction implements Action {
  public readonly player: Player;
  public readonly duration: number;

  constructor(player: Player, duration = 30) {
    this.player = player;
    this.duration = duration;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot detect objects.' };
    }

    const cost = this.player.getActionCost(BASE_ACTION_COST);
    this.player.consumeEnergy(cost);

    engine.detectObjectsTurns += this.duration;
    const msg = `A resonant shimmer vibrates through the stone! You sense loose items and treasure through walls (${engine.detectObjectsTurns} turns).`;
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}

/**
 * Action to reveal the full map architecture of the current floor (Clairvoyance / Magic Mapping).
 */
export class ClairvoyanceAction implements Action {
  public readonly player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot cast clairvoyance.' };
    }

    const cost = this.player.getActionCost(BASE_ACTION_COST);
    this.player.consumeEnergy(cost);

    engine.fov.revealAllTiles();
    const msg = '*** Clairvoyance flares in your mind! The entire floor geometry is revealed! ***';
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}

export function castDetectMonsters(engine: GameEngine, duration = 30): ActionResult {
  return new DetectMonstersAction(engine.player, duration).perform(engine);
}

export function castDetectObjects(engine: GameEngine, duration = 30): ActionResult {
  return new DetectObjectsAction(engine.player, duration).perform(engine);
}

export function castClairvoyance(engine: GameEngine): ActionResult {
  return new ClairvoyanceAction(engine.player).perform(engine);
}
