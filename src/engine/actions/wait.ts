import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { Action } from './action';

export class WaitAction implements Action {
  public readonly entity: Entity;

  constructor(entity: Entity) {
    this.entity = entity;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: `${this.entity.name} cannot wait while defeated.`,
      };
    }

    this.entity.consumeEnergy(BASE_ACTION_COST);
    const message = `${this.entity.name} waits a moment.`;
    // Only the hero's wait is told: every monster in sight and the companion logging theirs
    // each turn doubled the log.
    if (this.entity === engine.player) engine.log(message);

    return {
      success: true,
      cost: BASE_ACTION_COST,
      message,
    };
  }
}
