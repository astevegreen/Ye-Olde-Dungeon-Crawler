import type { CombatStats, Position, ActionResult, Faction } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { ElementType, ElementalAffinity } from '../magic/elements';
import type { StatusType } from '../status/types';
import { HookDispatcher, type HookDescriptor } from '../hooks/hookDispatcher';
import { Actor } from './actor';
import type { Entity } from './entity';
import { selectAttackTarget } from '../ai/targetSelection';
import { calculateAttribute } from '../stats/attributeCalculator';
import { type AiBehaviorType, type LootDropRule, getMonsterDefinition } from '../bestiary/monsterDefinitions';
import type { GameEngine } from '../engine';
import type { EngineRegistries } from '../registries';
import { DeathResolver } from '../combat/deathResolver';
import { MonsterAI } from '../ai/behaviorTree';
import { WaitAction } from '../actions/wait';
import { flightRecorder } from '../debug/flightRecorder';
import { wakesOnSight } from '../ai/stealth';
import { perceives } from '../ai/perception';

export type AiState = 'sleeping' | 'hunting' | 'combat' | 'fleeing';

export type MonsterIntentType = 'idle' | 'attack' | 'windup' | 'fleeing' | 'searching';

/**
 * Where a hunter last perceived its target (`ai/pursuit.ts`): it goes there, searches around it
 * for `searchTurns` more turns, then gives up (`lost`) until it sees, is struck or is alerted.
 */
export interface MonsterPursuit {
  x: number;
  y: number;
  searchTurns: number;
  searching?: boolean;
  lost?: boolean;
}

export interface MonsterIntent {
  type: MonsterIntentType;
  targetTile?: Position;
  targetTiles?: Position[];
  pattern?: 'single' | 'line' | 'cone' | 'blast' | 'cross';
  abilityName?: string;
  warningMessage?: string;
  turnsRemaining: number;
  multiplier?: number;
  element?: ElementType;
  statusOnHit?: { type: StatusType; duration: number; potency?: number };
  spawnSurface?: import('../surfaces/surfaceGrid').SurfaceType;
  pushImpulse?: number;
}

export interface MonsterConfig {
  id: string;
  name: string;
  position: Position;
  stats: CombatStats;
  speed?: number;
  resistances?: Partial<Record<ElementType, ElementalAffinity>>;
  definitionId?: string;
  aiType?: AiBehaviorType;
  aiRoutineId?: string;
  aiState?: AiState;
  intent?: MonsterIntent;
  spells?: string[];
  spellCooldown?: number;
  statusImmunities?: StatusType[];
  onHitAffliction?: {
    type: StatusType;
    chance: number;
    duration: number;
    potency?: number;
  };
  fleeHealthPercent?: number;
  xpValue?: number;
  faction?: Faction;
  lootTable?: LootDropRule[];
  hooks?: HookDescriptor[];
  inventory?: import('../inventory/inventory-manager').InventoryManager;
  items?: import('../items/item').Item[];
  tags?: string[];
  targetingMode?: 'player' | 'nearest_hostile';
}

export class Monster extends Actor {
  public definitionId: string;
  public aiType: AiBehaviorType;
  public aiState: AiState;
  public intent: MonsterIntent;
  public spells: string[];
  public spellCooldown: number;
  public onHitAffliction?: {
    type: StatusType;
    chance: number;
    duration: number;
    potency?: number;
  };
  public fleeHealthPercent: number;
  public xpValue: number;
  public lootTable: LootDropRule[];
  public hooks: HookDescriptor[];
  /**
   * Monster AI Targeting Generalization (docs/architecture/content-companions.md Phase 2). Default
   * 'player' preserves the original hardcoded-to-`engine.player` behavior exactly;
   * opting a monster definition into 'nearest_hostile' lets it engage a companion
   * instead, via `ai/targetSelection.ts`'s `selectAttackTarget()`.
   */
  public targetingMode: 'player' | 'nearest_hostile';
  /** The total stat multiplier floor catch-up has applied (`FloorManager.simulateCatchUp`); 1 = none. */
  public catchUpScale = 1;
  /** Its memory of its target; none until its first awake turn, or after `alert` (it then knows). */
  public pursuit?: MonsterPursuit;

  constructor(config: MonsterConfig) {
    super({
      id: config.id,
      name: config.name,
      type: 'monster',
      faction: config.faction ?? 'hostile',
      position: config.position,
      stats: config.stats,
      speed: config.speed ?? 100,
      resistances: config.resistances,
      statusImmunities: config.statusImmunities,
      aiRoutineId: config.aiRoutineId ?? config.aiType,
      inventory: config.inventory,
      tags: config.tags,
      capabilities: {
        canMove: true,
        canAct: true,
        canBlockPath: true,
        isDestructible: true,
        blocksLos: false,
      },
    });
    if (config.items && config.items.length > 0) {
      for (const item of config.items) {
        this.addItem(item);
      }
    }
    this.definitionId = config.definitionId ?? 'monster';
    this.aiType = config.aiType ?? 'melee';
    this.aiRoutineId = config.aiRoutineId ?? this.aiType;
    this.aiState = config.aiState ?? 'sleeping';
    this.intent = config.intent ? { ...config.intent } : { type: 'idle', turnsRemaining: 0 };
    this.spells = config.spells ? [...config.spells] : [];
    this.spellCooldown = config.spellCooldown ?? 0;
    this.onHitAffliction = config.onHitAffliction;
    this.fleeHealthPercent = config.fleeHealthPercent ?? 0;
    this.xpValue = config.xpValue ?? 15;
    this.lootTable = config.lootTable ? [...config.lootTable] : [];
    this.hooks = config.hooks ? [...config.hooks] : [];
    this.targetingMode = config.targetingMode ?? 'player';
  }

  /** Whether, asleep, it wakes on seeing the hero: the hero's wake radius may keep it asleep (`wakesOnSight`, ADR-0014). */
  public wakesOnSight(engine: GameEngine): boolean {
    return wakesOnSight(engine, this);
  }

  /**
   * Wakes it, and it knows where its target is: on its next turn it hunts from there, even one
   * that had lost track (an alarm, a call for help, a blow).
   */
  public alert(): void {
    if (this.aiState === 'sleeping') this.aiState = 'hunting';
    this.pursuit = undefined;
  }

  public interruptWindUp(_reason?: string): boolean {
    if (this.intent.type === 'windup') {
      this.intent = { type: 'idle', turnsRemaining: 0 };
      return true;
    }
    return false;
  }

  public override get attack(): number {
    return calculateAttribute(this, 'attack');
  }

  public override set attack(value: number) {
    this.baseAttack = value;
  }

  public override get defense(): number {
    return calculateAttribute(this, 'defense');
  }

  public override set defense(value: number) {
    this.baseDefense = value;
  }

  public override get maxHp(): number {
    return calculateAttribute(this, 'maxHp');
  }

  public override set maxHp(value: number) {
    this._maxHp = value;
  }

  public override getActionCost(baseCost: number): number {
    return calculateAttribute(this, 'actionCost', { baseCost });
  }

  public override takeDamage(rawAmount: number, options?: { wakeUp?: boolean }): { damageDealt: number; killed: boolean } {
    const res = super.takeDamage(rawAmount);
    const shouldWake = options?.wakeUp ?? true;
    // Any direct damage wakes it, and it knows where its foe is
    if (shouldWake) this.alert();
    // If monster is killed or took significant damage (> 25% maxHp), interrupt active wind-up
    if (res.killed || res.damageDealt >= Math.ceil(this.maxHp * 0.25)) {
      this.interruptWindUp();
    }
    return res;
  }

  /**
   * Executes a turn for this monster: reads paralysis, processes status ticks,
   * skips the turn if held, else decides an action via the AI behavior tree and executes it.
   */
  public takeTurn(engine: GameEngine): ActionResult {
    if (!this.isAlive()) {
      return { success: false, cost: 0 };
    }

    // 1. Paralysis / stun is read before the statuses tick, as the hero's forced pass reads
    // it: a hold of N turns costs a monster N turns, the hero's clock (a 1-turn wall-splat
    // stun used to expire in the tick and cost nothing).
    const stunned = this.statusManager.hasStatus('stunned');
    const held = stunned || this.statusManager.hasStatus('paralysis');

    // 2. Status effect ticking on monster
    const tickRes = this.statusManager.tick(this, engine);
    if (tickRes.killed) {
      DeathResolver.resolveDeath(engine, undefined, this);
      return { success: false, cost: 0, message: `${this.name} succumbed to status afflictions.` };
    }

    // 3. A held monster loses the turn.
    if (held) {
      const reason = stunned ? 'stunned' : 'paralyzed';
      this.interruptWindUp();
      this.consumeEnergy(BASE_ACTION_COST);
      return { success: true, cost: BASE_ACTION_COST, message: `${this.name} is ${reason} and cannot act.` };
    }

    // 4. Turn-start hooks, for awake monsters only (a sleeper is a dormant actor, §6). A hook
    // aimed at its target needs one in sight; the dispatcher skips it otherwise.
    if (this.aiState !== 'sleeping' && this.hooks.some((h) => h.event === 'onTurnStart')) {
      HookDispatcher.dispatch('onTurnStart', { engine, attacker: this, defender: this.visibleTarget(engine) });
      if (!this.isAlive()) return { success: false, cost: 0 };
    }

    // 5. AI decision and execution. Monster actions run through the same pipeline as the
    // player's, so action hooks fire for every actor (ARCHITECTURE.md §4).
    const action = MonsterAI.decideAction(this, engine);
    const result = engine.actionPipeline.executeWithHooks(action, engine);

    flightRecorder.recordScheduler(this.name, result.cost, engine.turnCount, {
      action: action.constructor.name,
      success: result.success,
    });

    if (!result.success || result.cost === 0) {
      new WaitAction(this).perform(engine);
    }

    return result;
  }

  /** The entity this monster engages, when it perceives it (`perceives`). */
  private visibleTarget(engine: GameEngine): Entity | undefined {
    const target = selectAttackTarget(engine, this);
    if (!target?.isAlive()) return undefined;
    return perceives(engine, this, target) ? target : undefined;
  }

  public static createFromDefinition(
    defId: string,
    id: string,
    position: Position,
    registries?: EngineRegistries
  ): Monster {
    const def = registries ? registries.monsters.get(defId) : getMonsterDefinition(defId);
    if (!def) {
      throw new Error(`Unknown monster definition: '${defId}' is not registered in MonsterRegistry.`);
    }
    return new Monster({
      id,
      name: def.name,
      position,
      stats: { ...def.stats },
      speed: def.speed,
      resistances: def.resistances,
      statusImmunities: def.statusImmunities,
      definitionId: def.id,
      aiType: def.aiType,
      aiState: 'sleeping',
      spells: def.spells,
      onHitAffliction: def.onHitAffliction,
      fleeHealthPercent: def.fleeHealthPercent,
      xpValue: def.xpValue,
      lootTable: def.lootTable,
      hooks: def.hooks,
      tags: def.tags,
      targetingMode: def.targetingMode,
    });
  }
}

