import type { Action } from '../actions/action';
import { MovementAction } from '../actions/movement';
import { MeleeAttackAction, WindUpDeclareAction, WindUpExecuteAction } from '../actions/combat';
import { WaitAction } from '../actions/wait';
import { OpenDoorAction } from '../actions/door';
import { CastSpellAction, DrinkPotionAction, ZapWandAction } from '../actions/spell-actions';
import type { GameEngine } from '../engine';
import type { Monster } from '../entities/monster';
import { findPath, findFleeStep } from './pathfinding';
import { getBresenhamLine } from '../magic/targeting';
import { AiBehaviorRegistry, type AiBehaviorStrategy } from './aiBehaviorRegistry';
import { AIRegistry } from './aiRegistry';
import { BUILTIN_AI_TYPES } from '../bestiary/monsterDefinitions';
import { computeDangerTiles } from './intent';
import { selectAttackTarget } from './targetSelection';
import { flightRecorder } from '../debug/flightRecorder';

class CasterBehavior implements AiBehaviorStrategy {
  public readonly id = BUILTIN_AI_TYPES.CASTER;
  public readonly name = 'Tactical Caster';

  public decideAction(monster: Monster, engine: GameEngine): Action {
    const player = selectAttackTarget(engine, monster);
    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));
    const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
    const hasLos = dist <= 8 && MonsterAI.hasLineOfSight(engine, monster.x, monster.y, player.x, player.y);

    if (chebyshevDist <= 1) {
      const backStep = findFleeStep(engine.map, monster.position, player.position);
      if (backStep) {
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new MovementAction(monster, backStep.x - monster.x, backStep.y - monster.y);
      }
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(monster, player);
    }

    if (chebyshevDist >= 2 && chebyshevDist <= 5 && hasLos) {
      // Hellfire Surge (blast pattern, radius 1, range 5, fire element, fire surface)
      if (
        monster.spells.includes('firebolt') &&
        monster.spellCooldown <= 0 &&
        (engine ? engine.rng() : Math.random()) < 0.35
      ) {
        monster.spellCooldown = 2;
        const dangerTiles = computeDangerTiles(monster.position, player.position, 'blast', engine.map, 5, 1);
        return new WindUpDeclareAction(
          monster,
          { x: player.x, y: player.y },
          'Hellfire Surge',
          `The ${monster.name} channels primordial hellfire, preparing to unleash Hellfire Surge!`,
          {
            targetTiles: dangerTiles,
            pattern: 'blast',
            turnsRemaining: 1,
            multiplier: 2.2,
            element: 'fire',
            spawnSurface: 'fire',
          }
        );
      }

      if (monster.spells.length > 0 && monster.spellCooldown <= 0) {
        let chosenSpell = monster.spells[0];
        if (monster.spells.includes('slow') && !player.statusManager.hasStatus('slow') && (engine ? engine.rng() : Math.random()) < 0.4) {
          chosenSpell = 'slow';
        } else if (monster.spells.includes('firebolt')) {
          chosenSpell = 'firebolt';
        }

        monster.spellCooldown = 2;
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new CastSpellAction(monster, chosenSpell, player.x, player.y, undefined, false);
      }

      if (chebyshevDist < 3) {
        const backStep = findFleeStep(engine.map, monster.position, player.position);
        if (backStep) {
          monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
          return new MovementAction(monster, backStep.x - monster.x, backStep.y - monster.y);
        }
      }
    }

    const path = findPath(engine.map, monster.position, player.position, true);
    if (path.length > 0) {
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      const next = path[0];
      const tile = engine.map.getTile(next.x, next.y);
      if (tile && (tile.isClosedDoor || tile.type === 'door_closed')) {
        return new OpenDoorAction(monster, next.x, next.y);
      }
      return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
    }

    monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
    return new WaitAction(monster);
  }
}

class MeleeBehavior implements AiBehaviorStrategy {
  public readonly id = BUILTIN_AI_TYPES.MELEE;
  public readonly name = 'Melee Attacker';

  public decideAction(monster: Monster, engine: GameEngine): Action {
    const player = selectAttackTarget(engine, monster);
    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));

    if (chebyshevDist <= 1) {
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(monster, player);
    }

    monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
    const path = findPath(engine.map, monster.position, player.position, true);
    if (path.length > 0) {
      const next = path[0];
      const tile = engine.map.getTile(next.x, next.y);
      if (tile && (tile.isClosedDoor || tile.type === 'door_closed')) {
        return new OpenDoorAction(monster, next.x, next.y);
      }
      return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
    }

    return new WaitAction(monster);
  }
}

class BruteBehavior implements AiBehaviorStrategy {
  public readonly id = BUILTIN_AI_TYPES.BRUTE;
  public readonly name = 'Brute Attacker';

  public decideAction(monster: Monster, engine: GameEngine): Action {
    const player = selectAttackTarget(engine, monster);
    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));
    const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
    const hasLos = dist <= 8 && MonsterAI.hasLineOfSight(engine, monster.x, monster.y, player.x, player.y);

    // 1. Seismic Ground Slam (adjacent, cross pattern, radius 2, pushImpulse 2, multiplier 2.6, mud surface)
    if (chebyshevDist <= 1) {
      if ((engine ? engine.rng() : Math.random()) < 0.45) {
        const dangerTiles = computeDangerTiles(monster.position, player.position, 'cross', engine.map, 1, 2);
        return new WindUpDeclareAction(
          monster,
          { x: player.x, y: player.y },
          'Seismic Ground Slam',
          `The ${monster.name} lifts its massive arms high, winding up a Seismic Ground Slam!`,
          {
            targetTiles: dangerTiles,
            pattern: 'cross',
            turnsRemaining: 1,
            multiplier: 2.6,
            pushImpulse: 2,
            spawnSurface: 'mud',
          }
        );
      }
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(monster, player);
    }

    // 2. Battering Charge (distance 2-4 with LOS, line pattern, pushImpulse 3, multiplier 2.4)
    if (chebyshevDist >= 2 && chebyshevDist <= 4 && hasLos) {
      if ((engine ? engine.rng() : Math.random()) < 0.4) {
        const dangerTiles = computeDangerTiles(monster.position, player.position, 'line', engine.map, 4);
        return new WindUpDeclareAction(
          monster,
          { x: player.x, y: player.y },
          'Battering Charge',
          `The ${monster.name} lowers its massive shoulders and prepares a Battering Charge!`,
          {
            targetTiles: dangerTiles,
            pattern: 'line',
            turnsRemaining: 1,
            multiplier: 2.4,
            pushImpulse: 3,
          }
        );
      }
    }

    monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
    const path = findPath(engine.map, monster.position, player.position, true);
    if (path.length > 0) {
      const next = path[0];
      const tile = engine.map.getTile(next.x, next.y);
      if (tile && (tile.isClosedDoor || tile.type === 'door_closed')) {
        return new OpenDoorAction(monster, next.x, next.y);
      }
      return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
    }

    return new WaitAction(monster);
  }
}

class CowardBehavior implements AiBehaviorStrategy {
  public readonly id = BUILTIN_AI_TYPES.COWARD;
  public readonly name = 'Cowardly Attacker';

  public decideAction(monster: Monster, engine: GameEngine): Action {
    const player = selectAttackTarget(engine, monster);
    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));

    if (chebyshevDist <= 1) {
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(monster, player);
    }

    monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
    const path = findPath(engine.map, monster.position, player.position, true);
    if (path.length > 0) {
      const next = path[0];
      const tile = engine.map.getTile(next.x, next.y);
      if (tile && (tile.isClosedDoor || tile.type === 'door_closed')) {
        return new OpenDoorAction(monster, next.x, next.y);
      }
      return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
    }

    return new WaitAction(monster);
  }
}

export { CasterBehavior, MeleeBehavior, BruteBehavior, CowardBehavior };

export function registerDefaultAiBehaviors(): void {
  AiBehaviorRegistry.register(new MeleeBehavior());
  AiBehaviorRegistry.register(new CasterBehavior());
  AiBehaviorRegistry.register(new BruteBehavior());
  AiBehaviorRegistry.register(new CowardBehavior());
}

registerDefaultAiBehaviors();
AiBehaviorRegistry.setDefaultRegistrar(registerDefaultAiBehaviors);

export class MonsterAI {
  public static hasLineOfSight(engine: GameEngine, startX: number, startY: number, endX: number, endY: number): boolean {
    const line = getBresenhamLine(startX, startY, endX, endY);
    // Ignore start and end tiles
    for (let i = 1; i < line.length - 1; i++) {
      const pt = line[i];
      if (!engine.map.isTransparent(pt.x, pt.y)) {
        return false;
      }
    }
    return true;
  }

  public static decideAction(monster: Monster, engine: GameEngine): Action {
    if (!monster.isAlive()) {
      return new WaitAction(monster);
    }

    const player = selectAttackTarget(engine, monster);
    if (!player.isAlive()) {
      return new WaitAction(monster);
    }

    // 0. Active Wind-Up Attack resolution
    if (monster.intent?.type === 'windup' && monster.intent.targetTile) {
      if (monster.intent.turnsRemaining > 0) {
        monster.intent.turnsRemaining -= 1;
      }

      if (monster.intent.turnsRemaining === 0) {
        const targetTile = { ...monster.intent.targetTile };
        const ability = monster.intent.abilityName ?? 'Power Slam';
        const mult = monster.intent.multiplier ?? (monster.aiType === BUILTIN_AI_TYPES.BRUTE ? 2.5 : 2.0);
        return new WindUpExecuteAction(monster, targetTile, ability, mult, {
          targetTiles: monster.intent.targetTiles,
          pattern: monster.intent.pattern,
          multiplier: mult,
          element: monster.intent.element,
          spawnSurface: monster.intent.spawnSurface,
          pushImpulse: monster.intent.pushImpulse,
        });
      } else {
        // Still winding up
        return new WaitAction(monster);
      }
    }

    // Decrement spell cooldown if active
    if (monster.spellCooldown > 0) {
      monster.spellCooldown -= 1;
    }

    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));
    const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
    const hasLos = dist <= 8 && MonsterAI.hasLineOfSight(engine, monster.x, monster.y, player.x, player.y);

    // 1. Sleeping state check
    const isVisibleInFov = Boolean(engine.fov && engine.fov.isVisible(monster.x, monster.y));
    if (monster.aiState === 'sleeping') {
      if (hasLos || isVisibleInFov) {
        monster.aiState = 'hunting';
      } else {
        monster.intent = { type: 'idle', turnsRemaining: 0 };
        return new WaitAction(monster);
      }
    }

    // 1.5. Symmetrical Item & Consumable Evaluation
    const carriedItems = monster.getItems();
    if (carriedItems.length > 0) {
      // Low HP Healing Consumable (< 30% HP)
      if (monster.hp <= Math.floor(monster.maxHp * 0.3)) {
        const healPotion = carriedItems.find(
          (i) => i.category === 'consumable' && (i as any).potionType !== undefined && (i as any).effects?.some((e: any) => e.type === 'restore_hp')
        );
        if (healPotion) {
          return new DrinkPotionAction(monster, healPotion as any);
        }
      }

      // Offensive Wand usage in range and line-of-sight
      if (hasLos) {
        const wand = carriedItems.find(
          (i) =>
            (i.category === 'wand' || (i as any).wandType !== undefined || typeof (i as any).canZap === 'function') &&
            typeof (i as any).canZap === 'function' &&
            (i as any).canZap()
        );
        if (wand) {
          return new ZapWandAction(monster, wand as any, player.x, player.y);
        }
      }
    }

    // 2. Fleeing / Morale check
    if (
      monster.fleeHealthPercent > 0 &&
      monster.hp <= Math.floor(monster.maxHp * monster.fleeHealthPercent)
    ) {
      monster.aiState = 'fleeing';
    } else if (
      monster.aiState === 'fleeing' &&
      monster.hp > Math.floor(monster.maxHp * monster.fleeHealthPercent)
    ) {
      monster.aiState = 'hunting';
    }

    // 3. Fleeing behavior
    if (monster.aiState === 'fleeing') {
      monster.intent = { type: 'fleeing', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      const fleeStep = findFleeStep(engine.map, monster.position, player.position);
      if (fleeStep) {
        return new MovementAction(monster, fleeStep.x - monster.x, fleeStep.y - monster.y);
      }
      // If cornered with nowhere to run, turn and fight
      if (chebyshevDist <= 1) {
        return new MeleeAttackAction(monster, player);
      }
    }

    // Check if monster has an aiRoutineId registered in AIRegistry
    const requestedRoutineId = monster.aiRoutineId ?? monster.aiType;
    const routine = AIRegistry.get(requestedRoutineId);
    if (routine) {
      const res = routine.decideAction(monster, engine);
      return (res as any).action ?? res;
    }

    // Delegate to legacy strategy. Reaching here means requestedRoutineId matched no
    // AIRegistry entry, alias, or legacy AiBehaviorRegistry strategy — a content bug
    // (typo'd aiRoutineId/aiType). Warn once per monster instance rather than every
    // turn, since this runs on the monster-turn path (isolated per-turn by
    // GameEngine.processMonsterAction) and would otherwise spam a flight-recorder
    // entry (and, transitively, a pipelineError banner) for the monster's whole life.
    const strategy = AiBehaviorRegistry.get(monster.aiType) ?? AiBehaviorRegistry.getDefault();
    if (!warnedFallbackMonsterIds.has(monster.id)) {
      warnedFallbackMonsterIds.add(monster.id);
      flightRecorder.recordWarning(
        `Monster '${monster.id}' has no registered AI routine for '${requestedRoutineId}'; using fallback strategy '${strategy.id}' instead.`,
        {
          source: 'MonsterAI.decideAction',
          entityId: monster.id,
          definitionId: monster.definitionId,
          requestedRoutineId,
          aiType: monster.aiType,
          fallbackStrategyId: strategy.id,
        }
      );
    }
    return strategy.decideAction(monster, engine);
  }
}

/**
 * Tracks monster IDs that have already logged a fallback-strategy warning so a
 * misconfigured monster's every turn doesn't spam the flight recorder (or, if
 * pipelineError surfacing is added later, the player) for its whole lifetime.
 * Exported for test teardown; safe to clear freely since it's advisory-only.
 */
const warnedFallbackMonsterIds = new Set<string>();
export function resetAiFallbackWarnings(): void {
  warnedFallbackMonsterIds.clear();
}
