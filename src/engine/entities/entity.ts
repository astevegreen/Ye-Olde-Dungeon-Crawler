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
  /**
   * What is killing it when no creature is, set by a status tick that kills (poison): the
   * death screen's "Slain by …". `DeathResolver` reads and clears it on the death it was set
   * for, so it can't blame a later death. Not saved.
   */
  public pendingDeathCause?: string;

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
  /** The least HP damage can leave this entity at; 0 lets it die. Not saved: whatever sets it
   *  sets it again on load (the prologue's ward, `quest/prologue.ts`). */
  private hpFloor = 0;
  /** Set when the floor held back damage that would have taken this entity below it. */
  private heldAtFloor = false;

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

  /** Sets the least HP damage can leave this entity at (0 removes the floor), and clears
   *  any blow it has held back. */
  public setHpFloor(floor: number): void {
    this.hpFloor = Math.max(0, floor);
    this.heldAtFloor = false;
  }

  /** Whether the HP floor has held back a blow since it was set. */
  public get wasHeldAtHpFloor(): boolean {
    return this.heldAtFloor;
  }

  /** `rawAmount`, cut to what the HP floor allows; records the hold when it cuts. */
  protected limitDamageToHpFloor(rawAmount: number): number {
    if (this.hpFloor <= 0) return rawAmount;
    const allowed = Math.max(0, this.hp - this.hpFloor);
    if (rawAmount <= allowed) return rawAmount;
    this.heldAtFloor = true;
    return allowed;
  }

  public takeDamage(rawAmount: number): { damageDealt: number; killed: boolean } {
    // A blow on the already dead deals nothing and kills nobody: `killed` marks the one
    // hit that crossed to 0 HP, so a death resolves once however many hits follow it.
    if (this.isInvulnerable || this.hp <= 0) {
      return { damageDealt: 0, killed: false };
    }
    rawAmount = this.limitDamageToHpFloor(rawAmount);
    const damageDealt = Math.max(0, Math.min(this.hp, rawAmount));
    this.hp -= damageDealt;
    const killed = this.hp <= 0;
    return { damageDealt, killed };
  }

  /** Whether a status can't take hold on it: its own immunities (an Actor adds what it wears). */
  public isImmuneTo(status: StatusType): boolean {
    return this.statusImmunities.includes(status);
  }

  /** How this entity takes an element: its own resistances (an Actor adds what it wears). */
  public affinityTo(element: ElementType): ElementalAffinity {
    return this.elementalResistances[element] ?? 'neutral';
  }

  public takeElementalDamage(
    amount: number,
    element: ElementType,
    matrix?: AffinityMatrix,
    terrainType?: TileType
  ): { damageDealt: number; finalDamage: number; isHeal: boolean; healed: number; killed: boolean; affinity: ElementalAffinity; message?: string } {
    const affinity = this.affinityTo(element);
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

  /** Changes the side this entity is on, e.g. a guardian that stands aside for a trusted
   *  hero. A neutral monster takes no action against anyone (MonsterAI.decideAction). */
  public setFaction(faction: Faction): void {
    this.faction = faction;
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

    // Tags are declared, not guessed from definition IDs: a substring match made
    // `giant_rat` a "giant". Content lists every tag a monster should answer to.
    if (this.role && typeof this.role === 'string') {
      if (this.role.toLowerCase().includes(lower)) return true;
    }

    // Semantic aliases for game archetypes
    if (lower === 'living') {
      return !this.hasTag('undead');
    }
    if (lower === 'undead') {
      return this.vulnerabilityTags.includes('radiant');
    }
    if (lower === 'demon') {
      return this.vulnerabilityTags.includes('holy');
    }
    if (lower === 'holy') {
      return this.vulnerabilityTags.includes('unholy') || this.aspectState === 'aspect_radiant';
    }

    return false;
  }
}
