import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';

/**
 * Action to disarm a known trap either underfoot or in an adjacent tile.
 */
export class DisarmTrapAction implements Action {
  public readonly player: Player;
  public readonly targetX?: number;
  public readonly targetY?: number;

  constructor(player: Player, targetX?: number, targetY?: number) {
    this.player = player;
    this.targetX = targetX;
    this.targetY = targetY;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot disarm traps.' };
    }

    let tx = this.targetX ?? this.player.x;
    let ty = this.targetY ?? this.player.y;

    // If target coordinate not provided, look underfoot first, then adjacent tiles
    let targetTrap = engine.map.getTrapAt(tx, ty);
    if (!targetTrap || targetTrap.disarmed) {
      // Check 8 adjacent tiles for any revealed active trap
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = this.player.x + dx;
          const ny = this.player.y + dy;
          const t = engine.map.getTrapAt(nx, ny);
          if (t && t.revealed && !t.disarmed) {
            targetTrap = t;
            tx = nx;
            ty = ny;
            break;
          }
        }
        if (targetTrap) break;
      }
    }

    if (!targetTrap) {
      const msg = 'There is no revealed trap nearby to disarm.';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    if (targetTrap.disarmed) {
      const msg = 'That trap has already been safely disarmed.';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    const cost = this.player.getActionCost(BASE_ACTION_COST);
    this.player.consumeEnergy(cost);

    const result = targetTrap.disarm(this.player, engine);
    if (result.success) {
      engine.emitDiscovery({
        type: 'trap_disarmed',
        text: `Safely disarmed a ${targetTrap.type} trap.`,
        icon: '🪤',
      });
    }
    return {
      success: result.success,
      cost,
      message: result.message,
    };
  }
}
