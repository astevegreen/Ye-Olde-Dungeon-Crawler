import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { wearsFlag } from '../items/wornModifiers';
import { sumAgainst } from '../compendium/familyPerks';

/**
 * Whether the hero senses this entity out of sight, through walls: every entity but the hero
 * while Detect Monsters lasts (`engine.detectMonstersTurns`); every living monster on the
 * floor while the hero wears or holds `sensesAllMonsters` (Odin's Eye, tracker 3.6); and a
 * monster within the `sensesWithin` of the hero's family perk against its family
 * (Pack-Sense). The renderer draws a sensed entity as a ping.
 */
export function sensesThroughWalls(engine: GameEngine, entity: Entity): boolean {
  if (entity === engine.player) return false;
  if (engine.detectMonstersTurns > 0) return true;
  if (!(entity instanceof Monster) || entity === engine.companion || !entity.isAlive()) return false;
  if (wearsFlag(engine.player, 'sensesAllMonsters')) return true;
  const within = sumAgainst(engine, engine.player, entity, 'sensesWithin');
  return within > 0 && Math.max(Math.abs(entity.x - engine.player.x), Math.abs(entity.y - engine.player.y)) <= within;
}
