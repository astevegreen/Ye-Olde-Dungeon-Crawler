import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { wearsFlag } from '../items/wornModifiers';

/**
 * Whether the hero senses this entity out of sight, through walls: every entity but the hero
 * while Detect Monsters lasts (`engine.detectMonstersTurns`), and every living monster on the
 * floor while the hero wears or holds `sensesAllMonsters` (Odin's Eye, tracker 3.6). The
 * renderer draws a sensed entity as a ping.
 */
export function sensesThroughWalls(engine: GameEngine, entity: Entity): boolean {
  if (entity === engine.player) return false;
  if (engine.detectMonstersTurns > 0) return true;
  return entity instanceof Monster && entity !== engine.companion && entity.isAlive() && wearsFlag(engine.player, 'sensesAllMonsters');
}
