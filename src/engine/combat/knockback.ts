import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { applyImpulse } from './impulse';

export interface KnockbackResult {
  pushed: boolean;
  fellInChasm: boolean;
  newPosition?: { x: number; y: number };
}

/**
 * Pushes an entity in the direction of (dx, dy).
 * Delegates to applyImpulse for physics, wall splat damage, and chasm hazards.
 */
export function applyKnockback(
  engine: GameEngine,
  attacker: Entity | undefined,
  target: Entity,
  dx: number,
  dy: number,
  distance = 1
): KnockbackResult {
  const res = applyImpulse(engine, attacker, target, dx, dy, distance);
  return {
    pushed: res.pushed,
    fellInChasm: res.fellInChasm,
    newPosition: res.newPosition,
  };
}
