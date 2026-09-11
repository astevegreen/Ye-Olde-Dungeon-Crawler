import type { Action } from '../actions/action';
import type { GameEngine } from '../engine';
import type { Actor } from '../entities/actor';
import type { Monster } from '../entities/monster';
import { MovementAction } from '../actions/movement';
import { MeleeAttackAction, WindUpDeclareAction } from '../actions/combat';
import { WaitAction } from '../actions/wait';
import { OpenDoorAction } from '../actions/door';
import { CastSpellAction } from '../actions/spell-actions';
import { findPath, findFleeStep } from './pathfinding';
import { computeDangerTiles } from './intent';
import { getBresenhamLine } from '../magic/targeting';
import { AiBehaviorRegistry } from './aiBehaviorRegistry';

function hasLineOfSight(engine: GameEngine, startX: number, startY: number, endX: number, endY: number): boolean {
  const line = getBresenhamLine(startX, startY, endX, endY);
  for (let i = 1; i < line.length - 1; i++) {
    const pt = line[i];
    if (!engine.map.isTransparent(pt.x, pt.y)) {
      return false;
    }
  }
  return true;
}

export interface QueuedAction {
  action: Action;
  priority?: number;
}

export interface AIStrategy {
  readonly id: string;
  readonly name: string;
  decideAction(actor: Actor, engine: GameEngine): Action | QueuedAction;
}

const registry = new Map<string, AIStrategy>();
let defaultStrategy: AIStrategy | undefined;

/** Maps legacy/shorthand AI strategy aliases to their canonical registered IDs. */
const LEGACY_ALIASES: Record<string, string> = {
  melee: 'aggressive_melee',
  caster: 'kiting_ranged',
  coward: 'fleeing_coward',
  brute: 'aggressive_melee',
};

export class AIRegistry {
  public static register(strategy: AIStrategy): void {
    registry.set(strategy.id, strategy);
    if (!defaultStrategy || strategy.id === 'aggressive_melee') {
      defaultStrategy = strategy;
    }
  }

  /** Register a custom alias that maps to an existing canonical strategy ID. */
  public static registerAlias(alias: string, canonicalId: string): void {
    LEGACY_ALIASES[alias] = canonicalId;
  }

  public static registerAll(
    strategies: Record<string, AIStrategy> | Map<string, AIStrategy> | readonly AIStrategy[]
  ): void {
    if (Array.isArray(strategies)) {
      for (const s of strategies) {
        this.register(s);
      }
    } else {
      const entries = strategies instanceof Map ? strategies.entries() : Object.entries(strategies);
      for (const [, strategy] of entries) {
        this.register(strategy);
      }
    }
  }

  public static get(id?: string): AIStrategy | undefined {
    if (!id) return defaultStrategy;
    // Direct match
    if (registry.has(id)) return registry.get(id);

    // Legacy alias resolution
    const canonicalId = LEGACY_ALIASES[id];
    if (canonicalId) return registry.get(canonicalId);

    const legacy = AiBehaviorRegistry.get(id);
    if (legacy) return legacy;

    return undefined;
  }

  public static getDefault(): AIStrategy {
    if (!defaultStrategy) {
      registerDefaultAIStrategies();
    }
    return defaultStrategy!;
  }

  public static has(id: string): boolean {
    if (registry.has(id)) return true;
    if (id in LEGACY_ALIASES) return true;
    if (AiBehaviorRegistry.has(id)) return true;
    return false;
  }

  public static getAll(): ReadonlyMap<string, AIStrategy> {
    return registry;
  }

  public static unregister(id: string): boolean {
    return registry.delete(id);
  }

  public static clear(): void {
    registry.clear();
    defaultStrategy = undefined;
  }

  public static resetToDefaults(): void {
    this.clear();
    registerDefaultAIStrategies();
  }
}

// ─────────────────────────────────────────────────────────────
// Default AI Strategies
// ─────────────────────────────────────────────────────────────

export class AggressiveMeleeStrategy implements AIStrategy {
  public readonly id = 'aggressive_melee';
  public readonly name = 'Aggressive Melee';

  public decideAction(actor: Actor, engine: GameEngine): Action {
    const monster = actor as Monster;
    const player = engine.player;
    const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
    const chebyshevDist = Math.max(Math.abs(actor.x - player.x), Math.abs(actor.y - player.y));

    // 1. Adjacent -> Attack or Wind-up
    if (chebyshevDist <= 1) {
      if (monster.aiType === 'brute' && Math.random() < 0.35) {
        const dangerTiles = computeDangerTiles(actor.position, player.position, 'cross', engine.map, 1, 2);
        return new WindUpDeclareAction(
          monster,
          { x: player.x, y: player.y },
          'Seismic Ground Slam',
          `The ${actor.name} lifts its massive arms high, winding up a Seismic Ground Slam!`,
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
      return new MeleeAttackAction(actor, player);
    }

    // 2. Battering Charge (distance 2-4 with LOS)
    if (
      monster.aiType === 'brute' &&
      chebyshevDist >= 2 &&
      chebyshevDist <= 4 &&
      hasLineOfSight(engine, actor.x, actor.y, player.x, player.y) &&
      Math.random() < 0.4
    ) {
      const dangerTiles = computeDangerTiles(actor.position, player.position, 'line', engine.map, 4);
      return new WindUpDeclareAction(
        monster,
        { x: player.x, y: player.y },
        'Battering Charge',
        `The ${actor.name} lowers its massive shoulders and prepares a Battering Charge!`,
        {
          targetTiles: dangerTiles,
          pattern: 'line',
          turnsRemaining: 1,
          multiplier: 2.4,
          pushImpulse: 3,
        }
      );
    }

    // 3. Out of range -> pathfind
    if (dist <= 10) {
      const path = findPath(engine.map, actor.position, player.position);
      if (path && path.length > 0) {
        const next = path[0];
        const tile = engine.map.getTile(next.x, next.y);
        if (tile?.type === 'door_closed') {
          return new OpenDoorAction(actor, next.x, next.y);
        }
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new MovementAction(actor, next.x - actor.x, next.y - actor.y);
      }
    }

    monster.intent = { type: 'idle', turnsRemaining: 0 };
    return new WaitAction(actor);
  }
}

export class KitingRangedStrategy implements AIStrategy {
  public readonly id = 'kiting_ranged';
  public readonly name = 'Kiting Ranged';

  public decideAction(actor: Actor, engine: GameEngine): Action {
    const monster = actor as Monster;
    const player = engine.player;
    const chebyshevDist = Math.max(Math.abs(actor.x - player.x), Math.abs(actor.y - player.y));
    const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
    const hasLos = dist <= 8 && hasLineOfSight(engine, actor.x, actor.y, player.x, player.y);

    // 1. If adjacent, try to kite/retreat first
    if (chebyshevDist <= 1) {
      const backStep = findFleeStep(engine.map, actor.position, player.position);
      if (backStep) {
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new MovementAction(actor, backStep.x - actor.x, backStep.y - actor.y);
      }
      // Cornered: melee attack
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(actor, player);
    }

    // 2. Ranged spell casting at optimal range (2 - 5 tiles)
    if (chebyshevDist >= 2 && chebyshevDist <= 5 && hasLos) {
      if (
        monster.aiType === 'caster' &&
        monster.spells?.includes('firebolt') &&
        monster.spellCooldown <= 0 &&
        Math.random() < 0.35
      ) {
        monster.spellCooldown = 2;
        const dangerTiles = computeDangerTiles(actor.position, player.position, 'blast', engine.map, 5, 1);
        return new WindUpDeclareAction(
          monster,
          { x: player.x, y: player.y },
          'Hellfire Surge',
          `The ${actor.name} channels primordial hellfire, preparing to unleash Hellfire Surge!`,
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

      if (monster.spells && monster.spells.length > 0 && monster.spellCooldown <= 0) {
        const chosenSpell = monster.spells[0];
        monster.spellCooldown = 2;
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new CastSpellAction(monster, chosenSpell, player.x, player.y);
      }
    }

    // 3. Piercing Snipe (range 3-7 with LOS) for ranged attacks when no spells available or spells on cooldown
    if (chebyshevDist >= 3 && chebyshevDist <= 7 && hasLos && (!monster.spells || monster.spells.length === 0 || monster.spellCooldown > 0)) {
      const dangerTiles = computeDangerTiles(actor.position, player.position, 'line', engine.map, 7);
      return new WindUpDeclareAction(
        monster,
        { x: player.x, y: player.y },
        'Piercing Snipe',
        `The ${actor.name} draws an immense bowstring taut, aiming a Piercing Snipe!`,
        {
          targetTiles: dangerTiles,
          pattern: 'line',
          turnsRemaining: 1,
          multiplier: 2.8,
        }
      );
    }

    // 3. Move into ideal casting range if too far
    if (dist <= 10) {
      const path = findPath(engine.map, actor.position, player.position);
      if (path && path.length > 0) {
        const next = path[0];
        const tile = engine.map.getTile(next.x, next.y);
        if (tile?.type === 'door_closed') {
          return new OpenDoorAction(actor, next.x, next.y);
        }
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new MovementAction(actor, next.x - actor.x, next.y - actor.y);
      }
    }

    monster.intent = { type: 'idle', turnsRemaining: 0 };
    return new WaitAction(actor);
  }
}

export class ImmobileTurretStrategy implements AIStrategy {
  public readonly id = 'immobile_turret';
  public readonly name = 'Immobile Turret';

  public decideAction(actor: Actor, engine: GameEngine): Action {
    const monster = actor as Monster;
    const player = engine.player;
    const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
    const chebyshevDist = Math.max(Math.abs(actor.x - player.x), Math.abs(actor.y - player.y));

    // Never moves. If target in range and LOS, fire/cast or melee attack!
    if (chebyshevDist <= 1) {
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(actor, player);
    }

    if (dist <= 6) {
      if (monster.spells && monster.spells.length > 0 && monster.spellCooldown <= 0) {
        const chosenSpell = monster.spells[0];
        monster.spellCooldown = 2;
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new CastSpellAction(monster, chosenSpell, player.x, player.y);
      }
    }

    monster.intent = { type: 'idle', turnsRemaining: 0 };
    return new WaitAction(actor);
  }
}

export class FleeingCowardStrategy implements AIStrategy {
  public readonly id = 'fleeing_coward';
  public readonly name = 'Fleeing Coward';

  public decideAction(actor: Actor, engine: GameEngine): Action {
    const monster = actor as Monster;
    const player = engine.player;
    const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
    const chebyshevDist = Math.max(Math.abs(actor.x - player.x), Math.abs(actor.y - player.y));

    // If monster has flee threshold and is currently healthy, advance to attack
    const isWounded =
      monster.fleeHealthPercent != null && monster.fleeHealthPercent > 0
        ? monster.hp <= Math.floor(monster.maxHp * monster.fleeHealthPercent)
        : true;

    if (isWounded) {
      if (dist <= 8) {
        const fleeStep = findFleeStep(engine.map, actor.position, player.position);
        if (fleeStep) {
          monster.intent = { type: 'fleeing', turnsRemaining: 0 };
          return new MovementAction(actor, fleeStep.x - actor.x, fleeStep.y - actor.y);
        }
        // Trapped / cornered
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new MeleeAttackAction(actor, player);
      }
    } else {
      // Healthy coward: attack if adjacent, else advance
      if (chebyshevDist <= 1) {
        monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
        return new MeleeAttackAction(actor, player);
      }
      if (dist <= 10) {
        const path = findPath(engine.map, actor.position, player.position, true);
        if (path && path.length > 0) {
          const next = path[0];
          const tile = engine.map.getTile(next.x, next.y);
          if (tile?.type === 'door_closed') {
            return new OpenDoorAction(actor, next.x, next.y);
          }
          monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
          return new MovementAction(actor, next.x - actor.x, next.y - actor.y);
        }
      }
    }

    monster.intent = { type: 'idle', turnsRemaining: 0 };
    return new WaitAction(actor);
  }
}

export function registerDefaultAIStrategies(): void {
  AIRegistry.register(new AggressiveMeleeStrategy());
  AIRegistry.register(new KitingRangedStrategy());
  AIRegistry.register(new ImmobileTurretStrategy());
  AIRegistry.register(new FleeingCowardStrategy());
}

registerDefaultAIStrategies();
