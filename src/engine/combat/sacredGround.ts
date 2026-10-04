import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import { DeathResolver } from './deathResolver';

/**
 * Holy ground, as the pack declares it: a tile with `sacred` (a god's altar), or a town
 * building with `sacred` (the temple). A modifier with `sacredGroundBurn` burns its bearer
 * for stepping onto it or striking from it (Hel-touched items, ADR-0012).
 */
export function isSacredGround(engine: GameEngine, x: number, y: number): boolean {
  if (engine.map.getTile(x, y)?.sacred) return true;
  if (engine.currentFloor !== 0) return false;
  return (engine.manifest?.town?.buildings ?? []).some(
    (b) => b.sacred && x >= b.bounds.x1 && x <= b.bounds.x2 && y >= b.bounds.y1 && y <= b.bounds.y2
  );
}

/** The burn the actor's worn items add up to on sacred ground; 0 for a plain bearer. */
export function sacredGroundBurn(actor: Entity): number {
  if (!(actor instanceof Actor)) return 0;
  let burn = 0;
  for (const item of actor.inventory.paperdoll.getEquippedItems()) {
    for (const mod of item.modifiers) burn += mod.sacredGroundBurn ?? 0;
  }
  return burn;
}

/**
 * Burns the actor if it stands on sacred ground wearing something that burns there. Logs
 * the burn and resolves a death it causes; returns what was taken.
 */
export function burnOnSacredGround(engine: GameEngine, actor: Entity): { damage: number; killed: boolean } {
  const burn = sacredGroundBurn(actor);
  if (burn <= 0 || !isSacredGround(engine, actor.x, actor.y)) return { damage: 0, killed: false };
  const { damageDealt, killed } = actor.takeDamage(burn);
  engine.log(`The holy ground scorches ${actor.name} for ${damageDealt}!`);
  engine.recordVisualEffects([
    { type: 'burst', epicenter: { x: actor.x, y: actor.y }, radius: 1, color: '#facc15', durationMs: 200 },
  ]);
  if (killed) DeathResolver.resolveDeath(engine, undefined, actor);
  return { damage: damageDealt, killed };
}
