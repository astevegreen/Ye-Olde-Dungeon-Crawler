import type { GameEngine } from '../engine';
import type { Position } from '../types';
import type { ProjectilePathResult, SpellDefinition, TargetingMode } from './types';
import { traceProjectile } from './targeting';

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
}

/** The targeting mode a cast of `spell` resolves with. */
export function targetingModeOf(spell: SpellDefinition): TargetingMode {
  return spell.targetingMode ?? (spell.targetType as TargetingMode);
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

  if (mode === 'ray' || mode === 'bounce_ray') {
    const reflects = Boolean(spell.reflects) || mode === 'bounce_ray' || engine.affinityMatrix.canReflect(spell.element);
    const ray = traceProjectile(engine.map, caster.x, caster.y, target.x, target.y, spell.range, reflects, caster.id);
    const bursts = spell.areaOfEffect > 0 || spell.visual?.archetype === 'projectile_burst';
    return { ray, reflects, burst: bursts ? { epicenter: ray.impactTile, radius } : undefined };
  }

  if (mode === 'area_burst' || (mode === 'tile' && spell.areaOfEffect > 0) || spell.visual?.archetype === 'direct_burst') {
    // A thrown burst flies to the tile aimed at (no further) and bursts where it stops.
    let epicenter: Position = { x: target.x, y: target.y };
    let ray: ProjectilePathResult | undefined;
    if (spell.visual?.archetype === 'projectile_burst' || (spell.range > 0 && spell.visual?.archetype !== 'direct_burst')) {
      const distToTarget = Math.hypot(target.x - caster.x, target.y - caster.y);
      ray = traceProjectile(engine.map, caster.x, caster.y, target.x, target.y, Math.min(spell.range, distToTarget), false, caster.id);
      if (ray.path.length > 0) epicenter = ray.impactTile;
      else ray = undefined;
    }
    return { ray, reflects: false, burst: { epicenter, radius } };
  }

  return { reflects: false };
}
