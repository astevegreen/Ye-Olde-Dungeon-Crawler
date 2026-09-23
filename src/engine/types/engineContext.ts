import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import type { GameMap } from '../grid/map';
import type { SurfaceGrid } from '../surfaces/surfaceGrid';
import type { WorldState } from '../state/worldState';

/**
 * The engine surface handlers are given (ARCHITECTURE.md §3).
 *
 * Action hooks, event hooks, and hook primitives receive this rather than the whole
 * `GameEngine`, so a handler cannot reach into engine internals or drive the turn loop.
 * `GameEngine` satisfies it structurally, so nothing is wrapped or copied at runtime —
 * the narrowing is enforced by the type checker.
 *
 * Widen it deliberately: every member added here becomes part of the content-facing
 * contract. Randomness must come from `rng` (§7.2), never `Math.random`.
 */
export interface EngineContext {
  /** The player entity. */
  readonly player: Player;
  /** The active floor's map. */
  readonly map: GameMap;
  /** Surface and gas grid for the active floor. */
  readonly surfaces: SurfaceGrid;
  /** Campaign flags and counters. */
  readonly worldState: WorldState;
  /** The engine's seeded PRNG delegate (§7.2). */
  readonly rng: () => number;
  /** Appends a line to the narrative log. */
  log(message: string): void;
  getWorldFlag(flag: string): boolean;
  setWorldFlag(flag: string, value: boolean): void;
  /** The active dungeon floor (0 = town). */
  readonly currentFloor: number;
  /** Removes an entity from the active floor's map and the turn scheduler. */
  removeEntity(entity: Entity): boolean;
}
