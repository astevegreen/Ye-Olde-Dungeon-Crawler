import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import { productWorn } from '../items/wornModifiers';
import { revealTrap } from '../actions/search';

/** Tiles within which a hidden trap can be spotted in passing; Wayfarer-like gear multiplies it. */
export const TRAP_SENSE_RANGE = 3;

/** Per-turn chance to spot each hidden trap in range: 2% per point of Intelligence above 5. */
export function trapSpotChance(player: Player): number {
  return Math.min(1, Math.max(0, (player.intelligence - 5) * 0.02));
}

/** Chance to shrug off a trap the hero springs: 3% per point of Dexterity above 5, at most 75%. */
export function trapDodgeChance(player: Player): number {
  return Math.min(0.75, Math.max(0, (player.dexterity - 5) * 0.03));
}

/**
 * One turn of passive trap spotting: each hidden trap the hero can see, within range, is
 * spotted on an Intelligence roll. Rolls go through `engine.prng` in map order, so a replay
 * draws the same numbers.
 */
export function senseTraps(engine: GameEngine): void {
  const player = engine.player;
  if (!player?.isAlive()) return;
  const chance = trapSpotChance(player);
  if (chance <= 0) return;
  const range = Math.round(TRAP_SENSE_RANGE * productWorn(player, 'perceptionRadiusMultiplier'));
  for (const trap of engine.map.getAllTraps()) {
    if (trap.revealed || trap.disarmed) continue;
    if (Math.max(Math.abs(trap.x - player.x), Math.abs(trap.y - player.y)) > range) continue;
    if (!engine.fov.isVisible(trap.x, trap.y)) continue;
    if (engine.prng.next() < chance) {
      revealTrap(engine, trap, `Your sharp eyes notice a hidden ${trap.type} trap!`);
    }
  }
}
