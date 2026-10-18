import type { GameEngine } from '../engine';
import type { Position } from '../types';
import type { ProjectilePathResult, SpellDefinition, SpellShape, TargetingMode } from './types';
import { getBresenhamLine, isTileSolidToProjectile, traceProjectile } from './targeting';
import { computeDangerTiles } from '../ai/intent';

/**
 * Where a cast goes: its flight and its burst. The spell pipeline resolves the cast from
 * this, and the aim preview and the after-image draw it, so what the hero is shown is what
 * the spell will do (R-rend-4: the preview drew a Fireball's burst at the end of the ray,
 * not where the cast stops, and no bounce for a reflecting element).
 */
export interface CastGeometry {
  /** The flight, if the spell flies: its tiles (bounces marked) and where it stops. */
  ray?: ProjectilePathResult;
  /** Whether that flight bounces off walls: the spell's own flag, a bounce ray, or its element. */
  reflects: boolean;
  /** Where the blast lands and how far it reaches, for a spell that bursts. */
  burst?: { epicenter: Position; radius: number };
  /** The tiles a shaped spell covers: a cone, nova, square or wall (`SpellShape`). */
  area?: Position[];
  /** An out-and-back spell's return: from where its flight (`ray`) turned, back to the caster's tile. */
  back?: Position[];
}

/** The targeting mode a cast of `spell` resolves with. */
export function targetingModeOf(spell: SpellDefinition): TargetingMode {
  return spell.targetingMode ?? (spell.targetType as TargetingMode);
}

/**
 * How far a flight aimed from `from` at `to` may travel, as `traceProjectile` measures it
 * (along the ray), for a range of `steps` grid steps: a spell's range counts tiles the way a
 * hero walks them, so 5 diagonal steps are 5, not 7.1, and a "Range 6" bolt reaches them.
 */
function flightLength(steps: number, from: Position, to: Position): number {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const grid = Math.max(dx, dy);
  return grid === 0 ? steps : (steps * Math.hypot(dx, dy)) / grid;
}

/** The geometry of `spell` cast by `caster` at `target` on the engine's map as it stands. */
export function castGeometry(
  engine: GameEngine,
  spell: SpellDefinition,
  caster: Position & { id: string },
  target: Position
): CastGeometry {
  const mode = targetingModeOf(spell);
  const radius = spell.areaOfEffect > 0 ? spell.areaOfEffect : (spell.visual?.burstRadius ?? 1);

  if (spell.shape === 'outAndBack') {
    // It flies through creatures to its range or a wall, then back along the same tiles.
    const ray = traceProjectile(engine.map, caster.x, caster.y, target.x, target.y, flightLength(spell.range, caster, target), false, caster.id, true);
    const back = [...ray.path].reverse().map(({ x, y }) => ({ x, y }));
    back.push({ x: caster.x, y: caster.y });
    return { ray, reflects: false, back };
  }
  if (spell.shape) return { reflects: false, area: shapeTiles(engine, spell.shape, spell.areaOfEffect, caster, target) };

  if (mode === 'ray' || mode === 'bounce_ray') {
    const reflects = Boolean(spell.reflects) || mode === 'bounce_ray' || engine.affinityMatrix.canReflect(spell.element);
    const ray = traceProjectile(engine.map, caster.x, caster.y, target.x, target.y, flightLength(spell.range, caster, target), reflects, caster.id);
    const bursts = spell.areaOfEffect > 0 || spell.visual?.archetype === 'projectile_burst';
    return { ray, reflects, burst: bursts ? { epicenter: ray.impactTile, radius } : undefined };
  }

  if (mode === 'area_burst' || (mode === 'tile' && spell.areaOfEffect > 0) || spell.visual?.archetype === 'direct_burst') {
    // A thrown burst flies to the tile aimed at (no further) and bursts where it stops.
    let epicenter: Position = { x: target.x, y: target.y };
    let ray: ProjectilePathResult | undefined;
    if (spell.visual?.archetype === 'projectile_burst' || (spell.range > 0 && spell.visual?.archetype !== 'direct_burst')) {
      const stepsToTarget = Math.max(Math.abs(target.x - caster.x), Math.abs(target.y - caster.y));
      ray = traceProjectile(engine.map, caster.x, caster.y, target.x, target.y, flightLength(Math.min(spell.range, stepsToTarget), caster, target), false, caster.id);
      if (ray.path.length > 0) epicenter = ray.impactTile;
      // A wall at the caster's side stops it at once: it bursts there, as a ray's burst does.
      else if (ray.hitWall) epicenter = { x: caster.x, y: caster.y };
      if (ray.path.length === 0) ray = undefined;
    }
    return { ray, reflects: false, burst: { epicenter, radius } };
  }

  return { reflects: false };
}

/**
 * Whether `spell` cast by `caster` at `target` would catch the creature standing there: its
 * flight reaches that tile, its burst covers it, or its shape does. A sight line can be clear
 * where the flight is not (a Bresenham line steps past a corner the flight clips), so a
 * monster checks this before it casts (P-36 soak: 1,358 shots traded into one wall).
 */
export function castReaches(
  engine: GameEngine,
  spell: SpellDefinition,
  caster: Position & { id: string },
  target: Position
): boolean {
  const geo = castGeometry(engine, spell, caster, target);
  const isTarget = (p: Position) => p.x === target.x && p.y === target.y;
  if (geo.burst) {
    const { epicenter, radius } = geo.burst;
    return Math.max(Math.abs(epicenter.x - target.x), Math.abs(epicenter.y - target.y)) <= radius;
  }
  if (geo.area) return geo.area.some(isTarget);
  if (geo.ray) return geo.ray.path.some(isTarget);
  return true;
}

/** The tiles of a cone, nova, square or wall of `size` (`SpellShape`), on the map. */
function shapeTiles(engine: GameEngine, shape: Exclude<SpellShape, 'outAndBack'>, size: number, caster: Position, aim: Position): Position[] {
  const map = engine.map;
  const tiles: Position[] = [];
  const add = (x: number, y: number) => {
    if (map.inBounds(x, y)) tiles.push({ x, y });
  };
  switch (shape) {
    case 'cone':
      // The monster cone, minus the tiles a wall hides from the caster.
      return computeDangerTiles(caster, aim, 'cone', map, size).filter((t) => clearFrom(map, caster, t));
    case 'nova':
      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) if (dx !== 0 || dy !== 0) add(caster.x + dx, caster.y + dy);
      }
      return tiles;
    case 'square': {
      const side = Math.max(1, size);
      const x0 = aim.x - Math.floor((side - 1) / 2);
      const y0 = aim.y - Math.floor((side - 1) / 2);
      for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) add(x0 + dx, y0 + dy);
      return tiles;
    }
    case 'wall': {
      // Across the aim's direction, snapped to the nearest of the eight.
      const octant = Math.round(Math.atan2(aim.y - caster.y, aim.x - caster.x) / (Math.PI / 4));
      const across = { x: -Math.round(Math.sin((octant * Math.PI) / 4)), y: Math.round(Math.cos((octant * Math.PI) / 4)) };
      for (let k = -size; k <= size; k++) add(aim.x + k * across.x, aim.y + k * across.y);
      return tiles;
    }
  }
}

/** Whether a flight from `from` reaches `to` with nothing solid on the way, `to` included. */
function clearFrom(map: GameEngine['map'], from: Position, to: Position): boolean {
  return getBresenhamLine(from.x, from.y, to.x, to.y)
    .slice(1)
    .every((p) => !isTileSolidToProjectile(map, p.x, p.y));
}
