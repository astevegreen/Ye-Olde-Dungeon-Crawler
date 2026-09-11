import type { Position } from '../engine/types';
import type { GameEngine } from '../engine/engine';
import { findAStarPath } from '../engine/pathfinding/astar';
import { MovementAction } from '../engine/actions/movement';
import { OpenDoorAction } from '../engine/actions/door';
import { AutoRestManager } from '../engine/actions/autoRest';

export interface NavigationOptions {
  stepDelayMs?: number;
  onStep?: (remainingPath: Position[]) => void;
  onComplete?: () => void;
  onCancel?: (reason: string) => void;
}

/**
 * Controller for click-to-move pathfinding navigation in the UI layer.
 */
export class NavigationController {
  public currentPath: Position[] = [];
  public isNavigating = false;
  private timerId: number | null = null;
  private readonly engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  /**
   * Plans and executes an asynchronous path to the given world coordinate.
   */
  public navigatePlayerTo(targetX: number, targetY: number, options?: NavigationOptions): boolean {
    if (this.isNavigating) {
      this.cancel('Redirected navigation.');
    }

    if (this.engine.isPaused || !this.engine.player.isAlive()) {
      return false;
    }

    // Explored constraint check
    if (!this.engine.fov.isExplored(targetX, targetY)) {
      this.engine.log('You cannot navigate into unexplored darkness.');
      return false;
    }

    const playerPos = { x: this.engine.player.x, y: this.engine.player.y };
    const path = findAStarPath(this.engine.map, this.engine.fov, playerPos, { x: targetX, y: targetY });

    if (path.length === 0) {
      this.engine.log('No clear path to that location.');
      return false;
    }

    this.currentPath = [...path];
    this.isNavigating = true;
    const stepDelay = options?.stepDelayMs ?? 55;

    const step = () => {
      if (!this.isNavigating) return;

      if (this.currentPath.length === 0) {
        this.isNavigating = false;
        this.timerId = null;
        if (options?.onComplete) options.onComplete();
        return;
      }

      // Safety check 1: Visible hostile in FOV
      const hostile = AutoRestManager.findVisibleHostile(this.engine);
      if (hostile) {
        this.cancel(`Path interrupted! A ${hostile.name} comes into view!`);
        if (options?.onCancel) options.onCancel('Hostile in view');
        return;
      }

      // Safety check 2: Player life
      if (!this.engine.player.isAlive()) {
        this.cancel('Navigation aborted: player defeated.');
        return;
      }

      const next = this.currentPath[0];
      if (!next || typeof next.x !== 'number' || typeof next.y !== 'number') {
        this.cancel('Navigation path was interrupted.');
        return;
      }
      const px = this.engine.player.x;
      const py = this.engine.player.y;
      const dx = next.x - px;
      const dy = next.y - py;

      // Check if next tile is closed door
      const tile = this.engine.map.getTile(next.x, next.y);
      if (tile && tile.type === 'door_closed') {
        const openResult = this.engine.handlePlayerAction(new OpenDoorAction(this.engine.player, next.x, next.y));
        if (!openResult.success) {
          this.cancel(`Path blocked: ${openResult.message}`);
          return;
        }
      } else {
        // Step forward
        const hpBefore = this.engine.player.hp;
        const moveResult = this.engine.handlePlayerAction(new MovementAction(this.engine.player, dx, dy));

        if (!moveResult.success) {
          this.cancel(`Path blocked: ${moveResult.message}`);
          return;
        }

        // Interrupted if player took unexpected damage
        if (this.engine.player.hp < hpBefore) {
          this.cancel('Path interrupted: player took damage!');
          return;
        }
      }

      this.currentPath.shift();
      if (options?.onStep) {
        options.onStep([...this.currentPath]);
      }

      // Check for freshly revealed traps along remaining path
      for (const remaining of this.currentPath) {
        const trap = this.engine.map.getTrapAt(remaining.x, remaining.y);
        if (trap && trap.revealed && !trap.disarmed) {
          this.cancel(`Path halted: A ${trap.type} trap was spotted ahead!`);
          return;
        }
      }

      this.timerId = window.setTimeout(step, stepDelay);
    };

    this.timerId = window.setTimeout(step, 0);
    return true;
  }

  /**
   * Immediately halts active path navigation and clears the breadcrumb path.
   */
  public cancel(reason?: string): void {
    if (!this.isNavigating && this.currentPath.length === 0) return;
    this.isNavigating = false;
    this.currentPath = [];
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (reason) {
      this.engine.log(reason);
    }
  }
}
