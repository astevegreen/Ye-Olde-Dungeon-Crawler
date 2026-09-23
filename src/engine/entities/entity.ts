import type { CombatStats, EntityType, Faction, Position, TileType } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { ElementType, ElementalAffinity, AffinityMatrix } from '../magic/elements';
import { calculateElementalDamage } from '../magic/elements';
import { StatusManager } from '../status/statusManager';
import type { StatusType } from '../status/types';
import type { ActorCapabilities } from './actor';
import type { InventoryManager } from '../inventory/inventory-manager';
import type { RunPactMutatorRules } from '../pacts/pactManager';

export interface EntityConfig {
  id: string;
  name: string;
  type: EntityType;
  faction: Faction;
  position: Position;
  stats: CombatStats;
  speed?: number;
  strength?: number;
  resistances?: Partial<Record<ElementType, ElementalAffinity>>;
  statusImmunities?: StatusType[];
  planeId?: string;
  isAnchored?: boolean;
  vulnerabilityTags?: string[];
  tags?: string[];
}

export class Entity {
  public readonly id: string;
  public name: string;
  public readonly type: EntityType;
  public faction: Faction;
  public x: number;
  public y: number;
  public hp: number;
  protected _maxHp: number;
  protected baseAttack: number;
  protected baseDefense: number;
  public strength: number;
  public speed: number;
  public energy: number;
  public elementalResistances: Partial<Record<ElementType, ElementalAffinity>>;
  public readonly statusManager: StatusManager = new StatusManager();
  public statusImmunities: StatusType[];
  public planeId: string;
  public isAnchored: boolean;
  public vulnerabilityTags: string[];
  public tags: string[];

  // Members only some subclasses provide (Actor, Monster, NPC, Player). Declared here,
  // type-only (`declare` emits nothing), so base-class logic like hasTag() and the
  // attribute calculator can read them without casting.
  declare public capabilities?: Partial<ActorCapabilities>;
  declare public inventory?: InventoryManager;
  declare public definitionId?: string;
  declare public readonly role?: string;
  declare public intelligence?: number;
  declare public constitution?: number;
  declare public dexterity?: number;
  declare public pactMutatorsSupplier?: () => RunPactMutatorRules;
  /** Innate alignment aspect (e.g. 'aspect_corrupt'), used when no armor carries one. */
  public aspectState?: string;
  public isInvulnerable: boolean = false;

  constructor(config: EntityConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.faction = config.faction;
    this.x = config.position.x;
    this.y = config.position.y;
    this.hp = config.stats.hp;
    this._maxHp = config.stats.maxHp;
    this.baseAttack = config.stats.attack;
    this.baseDefense = config.stats.defense;
    this.strength = config.strength ?? 10;
    this.speed = config.speed ?? 100;
    this.energy = 0;
    this.elementalResistances = { ...(config.resistances ?? {}) };
    this.statusImmunities = config.statusImmunities ? [...config.statusImmunities] : [];
    this.planeId = config.planeId ?? 'physical';
    this.isAnchored = config.isAnchored ?? false;
    this.vulnerabilityTags = config.vulnerabilityTags ? [...config.vulnerabilityTags] : [];
    this.tags = config.tags ? [...config.tags] : [];
  }

  public get maxHp(): number {
    return this._maxHp;
  }

  public set maxHp(value: number) {
    this._maxHp = value;
  }

  public get attack(): number {
    return this.baseAttack;
  }

  public set attack(value: number) {
    this.baseAttack = value;
  }

  /** Raw max HP before attribute modifiers (`maxHp` may be computed in subclasses). */
  public get baseMaxHpValue(): number {
    return this._maxHp;
  }

  public get baseAttackValue(): number {
    return this.baseAttack;
  }

  public get defense(): number {
    return this.baseDefense;
  }

  public set defense(value: number) {
    this.baseDefense = value;
  }

  public get baseDefenseValue(): number {
    return this.baseDefense;
  }

  public canMove(): boolean {
    if (!this.isAlive()) return false;
    if (this.statusManager.hasStatus('paralysis') || this.statusManager.hasStatus('stunned')) return false;
    return true;
  }

  public getActionCost(baseCost: number): number {
    let cost = baseCost;
    if (this.statusManager.hasStatus('slow')) {
      cost = Math.floor(cost * 1.5);
    }
    if (this.statusManager.hasStatus('haste')) {
      cost = Math.floor(cost * 0.75);
    }
    return Math.max(10, cost);
  }

  public get position(): Position {
    return { x: this.x, y: this.y };
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public isAlive(): boolean {
    return this.hp > 0;
  }

  public canAct(): boolean {
    return this.energy >= BASE_ACTION_COST;
  }

  public gainEnergy(amount: number): void {
    this.energy += amount;
  }

  public consumeEnergy(amount: number): void {
    this.energy = Math.max(0, this.energy - amount);
  }

  public takeDamage(rawAmount: number): { damageDealt: number; killed: boolean } {
    if (this.isInvulnerable) {
      return { damageDealt: 0, killed: false };
    }
    const damageDealt = Math.max(0, Math.min(this.hp, rawAmount));
    this.hp -= damageDealt;
    const killed = this.hp <= 0;
    return { damageDealt, killed };
  }

  public takeElementalDamage(
    amount: number,
    element: ElementType,
    matrix?: AffinityMatrix,
    terrainType?: TileType
  ): { damageDealt: number; finalDamage: number; isHeal: boolean; healed: number; killed: boolean; affinity: ElementalAffinity; message?: string } {
    const affinity = this.elementalResistances[element] ?? 'neutral';
    const calc = calculateElementalDamage(amount, element, affinity, matrix, terrainType);

    if (calc.isHeal) {
      const healed = this.heal(Math.abs(calc.finalDamage));
      return { damageDealt: 0, finalDamage: calc.finalDamage, isHeal: true, healed, killed: false, affinity, message: calc.message };
    }

    const damageRes = this.takeDamage(calc.finalDamage);
    return {
      damageDealt: damageRes.damageDealt,
      finalDamage: calc.finalDamage,
      isHeal: false,
      healed: 0,
      killed: damageRes.killed,
      affinity,
      message: calc.message,
    };
  }

  public heal(amount: number): number {
    if (!this.isAlive() || amount <= 0) {
      return 0;
    }
    const previousHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - previousHp;
  }

  public isHostileTo(other: Entity): boolean {
    if (this.faction === 'player') {
      return other.faction === 'hostile';
    }
    if (this.faction === 'hostile') {
      return other.faction === 'player';
    }
    return false;
  }

  public hasTag(tag: string): boolean {
    const lower = tag.toLowerCase();
    if (this.tags.some((t) => t.toLowerCase() === lower)) return true;
    if (this.vulnerabilityTags.some((t) => t.toLowerCase() === lower)) return true;
    if (this.faction && this.faction.toLowerCase() === lower) return true;
    if (this.type && this.type.toLowerCase() === lower) return true;

    if (this.definitionId && typeof this.definitionId === 'string') {
      if (this.definitionId.toLowerCase().includes(lower)) return true;
    }
    if (this.role && typeof this.role === 'string') {
      if (this.role.toLowerCase().includes(lower)) return true;
    }

    // Semantic aliases for game archetypes
    if (lower === 'clergy') {
      return (
        this.role === 'priest' ||
        this.role === 'cleric' ||
        Boolean(this.definitionId?.includes('priest')) ||
        Boolean(this.definitionId?.includes('cleric'))
      );
    }
    if (lower === 'innocent') {
      return this.role === 'villager' || this.role === 'merchant' || this.type === 'npc';
    }
    if (lower === 'undead') {
      return (
        this.vulnerabilityTags.includes('radiant') ||
        Boolean(this.definitionId?.includes('skeleton')) ||
        Boolean(this.definitionId?.includes('zombie')) ||
        Boolean(this.definitionId?.includes('ghost')) ||
        Boolean(this.definitionId?.includes('vampire')) ||
        Boolean(this.definitionId?.includes('ghoul')) ||
        Boolean(this.definitionId?.includes('lich'))
      );
    }
    if (lower === 'demon') {
      return (
        this.vulnerabilityTags.includes('holy') ||
        Boolean(this.definitionId?.includes('demon')) ||
        Boolean(this.definitionId?.includes('imp')) ||
        Boolean(this.definitionId?.includes('fiend'))
      );
    }
    if (lower === 'holy') {
      return this.vulnerabilityTags.includes('unholy') || this.aspectState === 'aspect_radiant';
    }

    return false;
  }
}
