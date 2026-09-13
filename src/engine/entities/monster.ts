import type { CombatStats, Position, ActionResult, Faction } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { ElementType, ElementalAffinity } from '../magic/elements';
import type { StatusType } from '../status/types';
import type { HookDescriptor } from '../hooks/hookDispatcher';
import { Actor } from './actor';
import { calculateAttribute } from '../stats/attributeCalculator';
import { type AiBehaviorType, type LootDropRule, getMonsterDefinition } from '../bestiary/monsterDefinitions';
import type { GameEngine } from '../engine';
import { DeathResolver } from '../combat/deathResolver';
import { MonsterAI } from '../ai/behaviorTree';
import { WaitAction } from '../actions/wait';
import { flightRecorder } from '../debug/flightRecorder';

export type AiState = 'sleeping' | 'hunting' | 'combat' | 'fleeing';

export type MonsterIntentType = 'idle' | 'attack' | 'windup' | 'fleeing';

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
    // Any direct damage wakes up sleeping monster immediately into hunting state
    if (this.aiState === 'sleeping' && shouldWake) {
      this.aiState = 'hunting';
    }
    // If monster is killed or took significant damage (> 25% maxHp), interrupt active wind-up
    if (res.killed || res.damageDealt >= Math.ceil(this.maxHp * 0.25)) {
      this.interruptWindUp();
    }
    return res;
  }

  /**
   * Executes a turn for this monster: processes status ticks, checks paralysis,
   * decides action via AI behavior tree, and executes it.
   */
  public takeTurn(engine: GameEngine): ActionResult {
    if (!this.isAlive()) {
      return { success: false, cost: 0 };
    }

    // 1. Status effect ticking on monster
    const tickRes = this.statusManager.tick(this, engine);
    if (tickRes.killed) {
      DeathResolver.resolveDeath(engine, undefined, this);
      return { success: false, cost: 0, message: `${this.name} succumbed to status afflictions.` };
    }

    // 2. Paralysis / Stun check: skips monster turn
    if (this.statusManager.hasStatus('paralysis') || this.statusManager.hasStatus('stunned')) {
      const reason = this.statusManager.hasStatus('stunned') ? 'stunned' : 'paralyzed';
      this.interruptWindUp();
      this.consumeEnergy(BASE_ACTION_COST);
      return { success: true, cost: BASE_ACTION_COST, message: `${this.name} is ${reason} and cannot act.` };
    }

    // 3. AI decision and execution
    const action = MonsterAI.decideAction(this, engine);
    const result = action.perform(engine);

    flightRecorder.recordScheduler(this.name, result.cost, engine.turnCount, {
      action: action.constructor.name,
      success: result.success,
    });

    if (!result.success || result.cost === 0) {
      new WaitAction(this).perform(engine);
    }

    return result;
  }

  public static createFromDefinition(defId: string, id: string, position: Position): Monster {
    const def = getMonsterDefinition(defId);
    if (!def) {
      // Generic fallback monster when definition is not found
      return new Monster({
        id,
        name: 'Unknown Creature',
        position,
        stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
        speed: 100,
        definitionId: defId,
        aiType: 'melee',
        xpValue: 10,
        lootTable: [],
      });
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
    });
  }
}

