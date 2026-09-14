import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import { TILES } from '../grid/tile';
import { recordMilestone } from '../renown/renownLedger';

/**
 * Searches the 8 adjacent tiles and current tile (radius 1) for secret doors and hidden traps.
 * Perception rolls are governed by the hero's Intelligence and Dexterity attributes.
 */
export class SearchAction implements Action {
  public readonly player: Player;
  private readonly rng: () => number;

  public readonly radius: number;

  constructor(player: Player, rng: () => number = Math.random, radius = 2) {
    this.player = player;
    this.rng = rng;
    this.radius = radius;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot search.' };
    }

    const cost = this.player.getActionCost(BASE_ACTION_COST);
    this.player.consumeEnergy(cost);

    let discoveredCount = 0;
    const px = this.player.x;
    const py = this.player.y;
    const r = this.radius;

    // Search (2r + 1) x (2r + 1) region centered on player (default 5x5 for r=2)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = px + dx;
        const ty = py + dy;

        if (!engine.map.inBounds(tx, ty)) continue;

        const roll =
          Math.floor(this.rng() * 20) +
          1 +
          Math.floor((this.player.intelligence + this.player.dexterity + this.player.level) / 4);

        // 1. Secret Door Detection
        const tile = engine.map.getTile(tx, ty);
        if (tile && (tile.isSecret || tile.type === 'secret_door' || tile.hidden)) {
          if (roll >= 12) {
            engine.map.setTile(tx, ty, { ...TILES.DOOR_CLOSED, hidden: false });
            engine.log('You discover a secret door hidden in the masonry!');
            engine.emitDiscovery({
              type: 'secret_door',
              text: 'Uncovered a secret door hidden in the masonry.',
              icon: '🚪',
            });
            recordMilestone(engine, 'secret_door_found');
            discoveredCount++;
          }
        }

        // 2. Hidden Trap Detection
        const trap = engine.map.getTrapAt(tx, ty);
        if (trap && !trap.revealed) {
          if (roll >= trap.concealment) {
            trap.revealed = true;
            engine.map.setTile(tx, ty, TILES.TRAP);
            engine.log(`You spot a hidden ${trap.type} trap!`);
            discoveredCount++;
          }
        }
      }
    }

    engine.updateFov();

    let message: string;
    if (discoveredCount > 0) {
      message = `You search carefully and uncover ${discoveredCount} hidden feature(s)!`;
    } else {
      message = 'You search your surroundings carefully, but find nothing hidden.';
      engine.log(message);
    }

    return {
      success: true,
      cost,
      message,
    };
  }
}
