import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Position } from '../types';
import { Monster } from '../entities/monster';

/**
 * Sensory Masking & Echolocation (docs/architecture/simulation-and-input.md).
 *
 * Detection radius, independent of the crippled visual FOV radius the
 * `sensory_masked` status also applies via `StatusHandler.perceptionRadius`
 * (see `engine.ts`'s `updateFov()`) — the whole point of the mechanic is
 * sensing beyond what the (heavily reduced) normal FOV alone would reveal.
 */
export const ECHOLOCATION_HEARING_RADIUS = 6;

const AUDIBLE_TILE_TYPES = new Set(['shallow_water', 'trap', 'chasm']);

/** A monster is audible unless dormant — a sleeping monster makes no noise. Non-monster actors are always audible. */
export function isAudibleEntity(entity: Entity): boolean {
  if (!entity.isAlive()) return false;
  if (entity instanceof Monster) return entity.aiState !== 'sleeping';
  return true;
}

/** A tile is audible if its type is inherently noisy, or it carries an active surface/gas/trap. */
export function isAudibleTile(engine: GameEngine, x: number, y: number): boolean {
  const tile = engine.map.getTile(x, y);
  if (tile && AUDIBLE_TILE_TYPES.has(tile.type)) return true;
  if (engine.map.surfaces.getSurface(x, y) || engine.map.surfaces.getGas(x, y)) return true;
  if (engine.map.getTrapAt(x, y)) return true;
  return false;
}

function boundedRadiusPositions(engine: GameEngine, center: Position, radius: number): Position[] {
  const minX = Math.max(0, Math.floor(center.x - radius));
  const maxX = Math.min(engine.map.width - 1, Math.ceil(center.x + radius));
  const minY = Math.max(0, Math.floor(center.y - radius));
  const maxY = Math.min(engine.map.height - 1, Math.ceil(center.y + radius));
  const radiusSq = radius * radius;

  const positions: Position[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy <= radiusSq) positions.push({ x, y });
    }
  }
  return positions;
}

/** Bounded (§6-style) query for audible entities near `center`, excluding `center`'s own occupant. */
export function getAudibleEntitiesInRadius(
  engine: GameEngine,
  center: Position,
  radius: number = ECHOLOCATION_HEARING_RADIUS
): Entity[] {
  const matches: Entity[] = [];
  const seenIds = new Set<string>();
  for (const pos of boundedRadiusPositions(engine, center, radius)) {
    for (const entity of engine.map.getEntitiesAt(pos.x, pos.y)) {
      if (seenIds.has(entity.id)) continue;
      if (entity.x === center.x && entity.y === center.y) continue;
      if (isAudibleEntity(entity)) {
        matches.push(entity);
        seenIds.add(entity.id);
      }
    }
  }
  return matches;
}

/** Bounded query for audible terrain tiles near `center`. */
export function getAudibleTilesInRadius(
  engine: GameEngine,
  center: Position,
  radius: number = ECHOLOCATION_HEARING_RADIUS
): Position[] {
  return boundedRadiusPositions(engine, center, radius).filter((pos) => isAudibleTile(engine, pos.x, pos.y));
}
