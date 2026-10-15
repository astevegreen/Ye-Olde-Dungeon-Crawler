import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { wearsFlag } from '../items/wornModifiers';
import { sumAgainst } from '../compendium/familyPerks';

/**
 * Whether the hero senses this entity out of sight, through walls: every entity but the hero
 * while Detect Monsters lasts (`engine.detectMonstersTurns`); every living monster on the
 * floor while the hero wears or holds `sensesAllMonsters` (Odin's Eye, tracker 3.6); a living
 * entity under a status that reveals its bearer (a mark, `sensedThroughWalls`); and a
 * monster within the `sensesWithin` of the hero's family perk against its family
 * (Pack-Sense). The renderer draws a sensed entity as a ping.
 */
export function sensesThroughWalls(engine: GameEngine, entity: Entity): boolean {
  if (entity === engine.player) return false;
  if (engine.detectMonstersTurns > 0) return true;
  if (entity.isAlive() && entity.statusManager.revealsBearer()) return true;
  if (!(entity instanceof Monster) || entity === engine.companion || !entity.isAlive()) return false;
  if (wearsFlag(engine.player, 'sensesAllMonsters')) return true;
  const within = sumAgainst(engine, engine.player, entity, 'sensesWithin');
  return within > 0 && Math.max(Math.abs(entity.x - engine.player.x), Math.abs(entity.y - engine.player.y)) <= within;
}

/** On the hero: the piles within `data.radius` of `data.x`, `data.y` are seen through walls while it lasts (a seer's reveal). */
export const SENSING_OBJECTS_STATUS = 'sensing_objects';

/** Whether the hero senses the ground items at `x`, `y` without seeing them: Detect Objects, or a seer's reach. */
export function objectSensedAt(engine: GameEngine, x: number, y: number): boolean {
  if (engine.detectObjectsTurns > 0) return true;
  const d = engine.player?.statusManager.getStatus(SENSING_OBJECTS_STATUS)?.data;
  if (!d || typeof d.x !== 'number' || typeof d.y !== 'number' || typeof d.radius !== 'number') return false;
  return Math.max(Math.abs(x - d.x), Math.abs(y - d.y)) <= d.radius;
}
