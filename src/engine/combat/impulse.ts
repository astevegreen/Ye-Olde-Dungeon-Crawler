import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Position } from '../types';
import { DeathResolver } from './deathResolver';

/** The trap type used when an entity lands on a trap tile during impulse resolution. */
const DEFAULT_IMPULSE_TRAP_TYPE = 'pit';
/** Status effect type applied when an entity slams into a wall (wall splat). */
const WALL_SPLAT_STATUS = 'stunned';
/** Duration in turns for the wall splat stun. */
const WALL_SPLAT_STUN_DURATION = 1;

export interface ImpulseResult {
  pushed: boolean;
  distanceTraveled: number;
  wallSplat: boolean;
  fellInChasm: boolean;
  triggeredTrap?: string;
  impactDamageDealt: number;
  stunned: boolean;
  killed: boolean;
  newPosition?: Position;
}

/**
 * Applies a physical impulse shove displacing an entity along a directional vector (dx, dy).
 *
 * Trajectory & Collision Resolution:
 * 1. Open passable tile: Displaces entity tile-by-tile up to `distance`.
 * 2. Wall Splat: Colliding with an impassable obstacle (Wall, Closed Door, Pillar, or Entity)
 *    halts movement, inflicts bonus kinetic impact damage scaled to remaining shove distance + STR,
 *    and applies a 1-turn 'stunned' status effect.
 * 3. Chasm Hazard: Pushing onto a 'chasm' tile triggers an instant fatal plunge (or heavy fall damage for bosses).
 * 4. Trap Hazard: Pushing onto a trap tile triggers immediate trap activation.
 */
export function applyImpulse(
  engine: GameEngine,
  source: Entity | undefined,
  target: Entity,
  dx: number,
  dy: number,
  distance = 1
): ImpulseResult {
  if (!target.isAlive() || distance <= 0) {
    return {
      pushed: false,
      distanceTraveled: 0,
      wallSplat: false,
      fellInChasm: false,
      impactDamageDealt: 0,
      stunned: false,
      killed: false,
      newPosition: { x: target.x, y: target.y },
    };
  }

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);

  if (stepX === 0 && stepY === 0) {
    return {
      pushed: false,
      distanceTraveled: 0,
      wallSplat: false,
      fellInChasm: false,
      impactDamageDealt: 0,
      stunned: false,
      killed: false,
      newPosition: { x: target.x, y: target.y },
    };
  }

  let currX = target.x;
  let currY = target.y;
  let distanceTraveled = 0;
  let triggeredTrapType: string | undefined;

  for (let step = 0; step < distance; step++) {
    const nextX = currX + stepX;
    const nextY = currY + stepY;

    // Out of bounds collision -> Wall Splat on map boundary
    if (!engine.map.inBounds(nextX, nextY)) {
      const remainingDist = distance - step;
      return resolveWallSplat(engine, source, target, 'the impassable edge of the abyss', remainingDist, distanceTraveled);
    }

    const nextTile = engine.map.getTile(nextX, nextY);
    if (!nextTile) {
      const remainingDist = distance - step;
      return resolveWallSplat(engine, source, target, 'solid stone', remainingDist, distanceTraveled);
    }

    // 1. Chasm Check: Fatal plunge (or heavy damage for massive bosses)
    if (nextTile.type === 'chasm') {
      const bossId = engine.manifest?.quest?.bossMonsterId ?? 'boss_hrungnir';
      const isBoss = (target as any).definitionId === bossId || target.maxHp >= 200;

      if (isBoss) {
        const fallDmg = Math.max(50, Math.floor(target.maxHp * 0.5));
        const { damageDealt, killed } = target.takeDamage(fallDmg);
        engine.log(`*** ${target.name} resists the abyss but suffers ${damageDealt} crushing fall damage clinging to the chasm ledge! ***`);
        if (killed) {
          DeathResolver.resolveDeath(engine, source, target);
        }
        return {
          pushed: true,
          distanceTraveled: distanceTraveled + 1,
          wallSplat: false,
          fellInChasm: true,
          impactDamageDealt: damageDealt,
          stunned: false,
          killed,
          newPosition: { x: target.x, y: target.y },
        };
      } else {
        engine.map.removeEntity(target);
        engine.log(`*** ${target.name} is knocked into the chasm and plunges into the bottomless abyss! ***`);
        const { damageDealt } = target.takeDamage(Math.max(999, target.maxHp));
        DeathResolver.resolveDeath(engine, source, target);
        return {
          pushed: true,
          distanceTraveled: distanceTraveled + 1,
          wallSplat: false,
          fellInChasm: true,
          impactDamageDealt: damageDealt,
          stunned: false,
          killed: true,
          newPosition: { x: nextX, y: nextY },
        };
      }
    }

    // 2. Obstacle / Entity Collision -> Wall Splat
    const blockingEntity = engine.map.getEntityAt(nextX, nextY);
    if (!nextTile.passable || blockingEntity) {
      const obstacleName = blockingEntity ? blockingEntity.name : (nextTile.name || 'a solid obstacle');
      const remainingDist = distance - step;
      return resolveWallSplat(engine, source, target, obstacleName, remainingDist, distanceTraveled);
    }

    // Move entity to next tile
    engine.map.moveEntity(target, nextX, nextY);
    currX = nextX;
    currY = nextY;
    distanceTraveled += 1;

    // 3. Trap Check: Immediate trap activation upon landing on trap
    const trap = engine.map.getTrapAt(nextX, nextY);
    if (trap && !trap.disarmed) {
      triggeredTrapType = trap.type;
      engine.log(`*** ${target.name} is shoved directly onto a ${trap.type} trap! ***`);
      trap.trigger(target, engine);
      if (!target.isAlive()) {
        return {
          pushed: true,
          distanceTraveled,
          wallSplat: false,
          fellInChasm: false,
          triggeredTrap: trap.type,
          impactDamageDealt: 0,
          stunned: false,
          killed: true,
          newPosition: { x: currX, y: currY },
        };
      }
    } else if (nextTile.type === 'trap') {
      triggeredTrapType = DEFAULT_IMPULSE_TRAP_TYPE;
      engine.log(`*** ${target.name} triggers a hidden trap upon landing! ***`);
      const { damageDealt, killed } = target.takeDamage(10);
      if (killed) {
        DeathResolver.resolveDeath(engine, source, target);
        return {
          pushed: true,
          distanceTraveled,
          wallSplat: false,
          fellInChasm: false,
          triggeredTrap: DEFAULT_IMPULSE_TRAP_TYPE,
          impactDamageDealt: damageDealt,
          stunned: false,
          killed: true,
          newPosition: { x: currX, y: currY },
        };
      }
    }
  }

  return {
    pushed: distanceTraveled > 0,
    distanceTraveled,
    wallSplat: false,
    fellInChasm: false,
    triggeredTrap: triggeredTrapType,
    impactDamageDealt: 0,
    stunned: false,
    killed: !target.isAlive(),
    newPosition: { x: target.x, y: target.y },
  };
}

/**
 * Handles wall splat collision damage and stun affliction.
 */
function resolveWallSplat(
  engine: GameEngine,
  source: Entity | undefined,
  target: Entity,
  obstacleName: string,
  remainingDist: number,
  distanceTraveled: number
): ImpulseResult {
  const strBonus = Math.floor(((source?.strength ?? target.strength ?? 10)) / 2);
  const impactDamage = Math.max(3, remainingDist * 4 + strBonus);

  const { damageDealt, killed } = target.takeDamage(impactDamage);

  // Apply 1-turn Stunned status
  target.statusManager.applyStatus(
    { type: WALL_SPLAT_STATUS, duration: WALL_SPLAT_STUN_DURATION },
    target.statusImmunities,
    target,
    engine
  );

  engine.log(`*** WALL SPLAT! ${target.name} slams violently into ${obstacleName} for ${damageDealt} kinetic impact damage and is stunned! ***`);

  if (killed) {
    DeathResolver.resolveDeath(engine, source, target);
  }

  return {
    pushed: distanceTraveled > 0,
    distanceTraveled,
    wallSplat: true,
    fellInChasm: false,
    impactDamageDealt: damageDealt,
    stunned: true,
    killed,
    newPosition: { x: target.x, y: target.y },
  };
}
