import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { Position, ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import { EffectPrimitiveRegistry, type EffectContext } from '../magic/effectRegistry';
import type { EffectPrimitive } from '../magic/types';

export interface ReciprocalPlaneShiftEffect {
  type: 'reciprocal_plane_shift';
  targetPlaneId?: string;
  recoilDistance?: number;
  [key: string]: any;
}

export interface ForcedLocomotionEffect {
  type: 'forced_locomotion';
  targetPos: Position;
  failureChance?: number;
  [key: string]: any;
}

export interface MutualBanishmentEffect {
  type: 'mutual_banishment';
  distance?: number;
  targetPlaneId?: string;
  [key: string]: any;
}

export interface SomaticBackfireEffect {
  type: 'somatic_backfire';
  status: string;
  duration: number;
  difficulty?: number;
  [key: string]: any;
}

const DEFAULT_RECIPROCAL_RECOIL_DISTANCE = 1;
const DEFAULT_FORCED_LOCOMOTION_FAIL_CHANCE = 0.25;
const DEFAULT_MUTUAL_BANISHMENT_DISTANCE = 2;
const DEFAULT_SOMATIC_BACKFIRE_DIFFICULTY = 14;
const DEFAULT_CASTER_DISCIPLINE_FALLBACK = 10;

/**
 * Registers reciprocal primitives in EffectPrimitiveRegistry.
 */
export function registerReciprocalPrimitives(): void {
  // 1. Reciprocal Plane Shift
  EffectPrimitiveRegistry.register<ReciprocalPlaneShiftEffect>(
    'reciprocal_plane_shift',
    (effect, ctx: EffectContext) => {
      const { engine, caster, targets } = ctx;
      const target = targets[0];
      if (!target || !engine.planeManager) return;

      const targetPlane =
        effect.targetPlaneId ?? (target.planeId === 'physical' ? 'liminal' : 'physical');
      const shifted = engine.planeManager.transferEntity(engine.map, target, targetPlane);
      if (shifted) {
        engine.log(`${target.name} is forcefully displaced into the ${targetPlane} plane!`);
      }

      // Seesaw recoil: caster is cast backward in the opposing direction
      const rawDx = target.x - caster.x;
      const rawDy = target.y - caster.y;
      const recoilDx = rawDx !== 0 ? -Math.sign(rawDx) : 0;
      const recoilDy = rawDy !== 0 ? -Math.sign(rawDy) : 0;
      const dist = effect.recoilDistance ?? DEFAULT_RECIPROCAL_RECOIL_DISTANCE;

      const recoilX = caster.x + recoilDx * dist;
      const recoilY = caster.y + recoilDy * dist;
      if (
        engine.map.isPassable(recoilX, recoilY) &&
        !engine.map.getEntityAt(recoilX, recoilY, caster.planeId)
      ) {
        engine.map.moveEntity(caster, recoilX, recoilY);
        engine.log(`Recoil casts ${caster.name} backward!`);
      }
    }
  );

  // 2. Forced Locomotion
  EffectPrimitiveRegistry.register<ForcedLocomotionEffect>(
    'forced_locomotion',
    (effect, ctx: EffectContext) => {
      const { engine, caster, targets } = ctx;
      const target = targets[0] ?? caster;
      const failChance = effect.failureChance ?? DEFAULT_FORCED_LOCOMOTION_FAIL_CHANCE;

      const roll = engine.rng();
      const isFailure = roll < failChance;
      if (isFailure) {
        // Vector reverses onto the caster
        engine.log(`Kinetic backfire! ${caster.name}'s locomotion command reflects onto themselves!`);
        displaceTowards(engine, caster, effect.targetPos);
      } else {
        engine.log(`${target.name}'s momentum is seized and forced along the trajectory!`);
        displaceTowards(engine, target, effect.targetPos);
      }
    }
  );

  // 3. Mutual Banishment
  EffectPrimitiveRegistry.register<MutualBanishmentEffect>(
    'mutual_banishment',
    (effect, ctx: EffectContext) => {
      const { engine, caster, targets } = ctx;
      const target = targets[0];
      if (!target) return;

      const dist = effect.distance ?? DEFAULT_MUTUAL_BANISHMENT_DISTANCE;

      // Displace outward away from each other
      const dx = target.x - caster.x;
      const dy = target.y - caster.y;
      const dirX = dx !== 0 ? Math.sign(dx) : 1;
      const dirY = dy !== 0 ? Math.sign(dy) : 0;

      // Target pushed away
      displaceBy(engine, target, dirX * dist, dirY * dist);
      // Caster pushed in opposite direction
      displaceBy(engine, caster, -dirX * dist, -dirY * dist);

      if (effect.targetPlaneId && engine.planeManager) {
        engine.planeManager.transferEntity(engine.map, target, effect.targetPlaneId);
        engine.planeManager.transferEntity(engine.map, caster, effect.targetPlaneId);
        engine.log(`Both ${caster.name} and ${target.name} are cast into ${effect.targetPlaneId}!`);
      } else {
        engine.log(`Mutual banishment repels ${caster.name} and ${target.name} outward!`);
      }
    }
  );

  // 4. Somatic Backfire
  EffectPrimitiveRegistry.register<SomaticBackfireEffect>(
    'somatic_backfire',
    (effect, ctx: EffectContext) => {
      const { engine, caster, targets } = ctx;
      const target = targets[0];
      if (!target) return;

      // Apply condition to target
      target.statusManager.applyStatus(effect.status, effect.duration);
      engine.log(`${target.name} is afflicted by ${effect.status} for ${effect.duration} turns!`);

      // Roll acoustic/somatic feedback test against caster's discipline / intelligence
      const casterDiscipline =
        caster.intelligence ??
        caster.strength ??
        DEFAULT_CASTER_DISCIPLINE_FALLBACK;
      const difficulty = effect.difficulty ?? DEFAULT_SOMATIC_BACKFIRE_DIFFICULTY;

      if (casterDiscipline < difficulty) {
        const feedbackDuration = Math.max(1, Math.floor(effect.duration / 2));
        caster.statusManager.applyStatus(effect.status, feedbackDuration);
        engine.log(
          `Somatic feedback! ${caster.name} suffers resonant backfire (${effect.status}) for ${feedbackDuration} turns!`
        );
      }
    }
  );
}

function displaceTowards(engine: GameEngine, entity: Entity, targetPos: Position): void {
  const dx = Math.sign(targetPos.x - entity.x);
  const dy = Math.sign(targetPos.y - entity.y);
  const newX = entity.x + dx;
  const newY = entity.y + dy;

  if (
    engine.map.isPassable(newX, newY) &&
    !engine.map.getEntityAt(newX, newY, entity.planeId)
  ) {
    engine.map.moveEntity(entity, newX, newY);
  }
}

function displaceBy(engine: GameEngine, entity: Entity, deltaX: number, deltaY: number): void {
  // Step toward target coordinate as far as passable
  let currX = entity.x;
  let currY = entity.y;
  const stepX = Math.sign(deltaX);
  const stepY = Math.sign(deltaY);
  const maxSteps = Math.max(Math.abs(deltaX), Math.abs(deltaY));

  for (let i = 0; i < maxSteps; i++) {
    const nextX = currX + stepX;
    const nextY = currY + stepY;
    if (
      engine.map.isPassable(nextX, nextY) &&
      !engine.map.getEntityAt(nextX, nextY, entity.planeId)
    ) {
      currX = nextX;
      currY = nextY;
    } else {
      break;
    }
  }

  if (currX !== entity.x || currY !== entity.y) {
    engine.map.moveEntity(entity, currX, currY);
  }
}

/**
 * Resolves an action with reciprocal recoil synchronously and atomically.
 */
export function executeReciprocalAction(
  caster: Entity,
  target: Entity,
  effects: EffectPrimitive[],
  engine: GameEngine
): ActionResult {
  if (!caster.isAlive()) {
    return { success: false, cost: 0, message: `${caster.name} is incapacitated.` };
  }

  const ctx: EffectContext = {
    engine,
    spell: {
      id: 'reciprocal_ability',
      name: 'Reciprocal Ability',
      school: 'Transmutation',
      manaCost: 0,
      element: 'arcane',
      range: 5,
      basePower: 0,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'tile',
      targetingMode: 'target_entity',
      description: 'Reciprocal ability with symmetrical recoil.',
      effects,
    },
    caster,
    targets: [target],
    effects: [],
    color: '#9b59b6',
  };

  for (const eff of effects) {
    EffectPrimitiveRegistry.dispatch(eff, ctx);
  }

  const cost = caster.getActionCost(BASE_ACTION_COST);
  caster.consumeEnergy(cost);

  return {
    success: true,
    cost,
    message: `Reciprocal action executed atomically between ${caster.name} and ${target.name}.`,
  };
}
