import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Item } from '../items/item';
import type { Position } from '../types';

export class CombatLogger {
  /**
   * Evaluates whether an event involving an actor and optional target is visible to the player.
   * If either the actor or target is the player, or is within the player's active FOV, returns true.
   */
  public static isVisibleToPlayer(engine: GameEngine, actor: Entity, target?: Entity | null): boolean {
    if (actor === engine.player) return true;
    if (target && target === engine.player) return true;

    if (engine.fov.isVisible(actor.x, actor.y)) return true;
    if (target && engine.fov.isVisible(target.x, target.y)) return true;

    return false;
  }

  /**
   * Logs a message only if the given world position is within the player's FOV.
   * Prevents out-of-sight background activity from cluttering the message buffer.
   */
  public static logIfVisible(engine: GameEngine, message: string, position: Position): boolean {
    if (engine.fov.isVisible(position.x, position.y)) {
      engine.log(message);
      return true;
    }
    return false;
  }

  /**
   * Logs an ambient actor message (e.g. waiting, resting, wandering) only if the actor is visible to the player.
   */
  public static logAmbient(engine: GameEngine, entity: Entity, message: string): boolean {
    if (entity === engine.player || engine.fov.isVisible(entity.x, entity.y)) {
      engine.log(message);
      return true;
    }
    return false;
  }

  /**
   * Formats a verbose pickup log message for an item including quantity and destination container.
   */
  public static formatPickupMessage(item: Item, destination?: string): string {
    const base = item.displayName;
    const destStr = destination ? ` (stored in ${destination})` : '';
    return `You pick up ${base}${destStr}.`;
  }
}
