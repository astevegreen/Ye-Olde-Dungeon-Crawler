import type { CombatStats, Faction, Position } from '../types';
import { Entity, type EntityConfig } from './entity';
import type { GameEngine } from '../engine';
import { InventoryManager } from '../inventory/inventory-manager';
import type { Item, EquipmentSlot } from '../items/item';
import type { ElementType, ElementalAffinity } from '../magic/elements';

export interface IItemContainer {
  addItem(item: Item): boolean;
  removeItem(itemOrId: Item | string): Item | null;
  getItems(): Item[];
  hasItem(itemOrId: Item | string): boolean;
}

export interface IEquipmentBearer {
  getEquippedItem(slot: EquipmentSlot): Item | null;
  equipItem(item: Item, slot?: EquipmentSlot): boolean;
  unequipItem(slot: EquipmentSlot): Item | null;
}

export interface MorphEnvelope {
  originalArchetypeId: string;
  originalName: string;
  originalStats: CombatStats;
  originalSpeed: number;
  originalResistances: Partial<Record<ElementType, ElementalAffinity>>;
  remainingTicks: number;
  spillDamage: boolean;
  temporaryHp: number;
  maxTemporaryHp: number;
}

export interface ActorCapabilities {
  canMove: boolean;
  canAct: boolean;
  canBlockPath: boolean;
  isDestructible: boolean;
  blocksLos?: boolean;
}

export const DEFAULT_ACTOR_CAPABILITIES: ActorCapabilities = {
  canMove: true,
  canAct: true,
  canBlockPath: true,
  isDestructible: true,
  blocksLos: false,
};

export const IMMOBILE_OBJECT_CAPABILITIES: ActorCapabilities = {
  canMove: false,
  canAct: false,
  canBlockPath: true,
  isDestructible: true,
  blocksLos: false,
};

export interface ActorConfig extends EntityConfig {
  capabilities?: Partial<ActorCapabilities>;
  aiRoutineId?: string;
  onDestroyed?: (engine: GameEngine, killer?: Entity) => void;
  inventory?: InventoryManager;
}

/**
 * Actor is the universal entity class providing dynamic capabilities
 * (movement, turn actions, path obstruction, destruction hooks, inventory, equipment, morphing).
 */
export class Actor extends Entity implements IItemContainer, IEquipmentBearer {
  public capabilities: ActorCapabilities;
  public aiRoutineId?: string;
  public onDestroyed?: (engine: GameEngine, killer?: Entity) => void;
  public inventory: InventoryManager;
  public morphEnvelope?: MorphEnvelope;
  public corruptionScore: number = 0;

  constructor(config: ActorConfig) {
    super(config);
    this.capabilities = {
      ...DEFAULT_ACTOR_CAPABILITIES,
      ...(config.capabilities ?? {}),
    };
    this.aiRoutineId = config.aiRoutineId;
    this.onDestroyed = config.onDestroyed;
    this.inventory = config.inventory ?? new InventoryManager({ ownerId: this.id });
    this.inventory.setOwnerId(this.id);
  }

  public override canMove(): boolean {
    if (!this.capabilities.canMove) {
      return false;
    }
    return super.canMove();
  }

  public override canAct(): boolean {
    if (!this.capabilities.canAct) {
      return false;
    }
    return super.canAct();
  }

  // --- IItemContainer Implementation ---

  public addItem(item: Item): boolean {
    return this.inventory.primaryPack.addItem(item);
  }

  public removeItem(itemOrId: Item | string): Item | null {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    const fromPack = this.inventory.primaryPack.removeItem(id);
    if (fromPack) return fromPack;
    if (this.inventory.belt) {
      const fromBelt = this.inventory.belt.removeItem(id);
      if (fromBelt) return fromBelt;
    }
    if (this.inventory.purse) {
      const fromPurse = this.inventory.purse.removeItem(id);
      if (fromPurse) return fromPurse;
    }
    const eqItem = this.inventory.findItemById(id);
    if (eqItem && eqItem.slot) {
      this.inventory.paperdoll.unequip(eqItem.slot);
      return eqItem;
    }
    return null;
  }

  public getItems(): Item[] {
    return this.inventory.getAllCarriedItems().filter((i) => i !== this.inventory.primaryPack);
  }

  public hasItem(itemOrId: Item | string): boolean {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    return this.inventory.findItemById(id) !== undefined;
  }

  // --- IEquipmentBearer Implementation ---

  public getEquippedItem(slot: EquipmentSlot): Item | null {
    return this.inventory.paperdoll.getItem(slot);
  }

  public equipItem(item: Item, slot?: EquipmentSlot): boolean {
    const targetSlot = slot ?? item.slot;
    if (!targetSlot) return false;
    if (this.inventory.primaryPack.hasItem(item.id)) {
      return this.inventory.equipFromPack(item.id, targetSlot).success;
    }
    const res = this.inventory.paperdoll.equip(item, targetSlot);
    return res.success;
  }

  public unequipItem(slot: EquipmentSlot): Item | null {
    const item = this.inventory.paperdoll.getItem(slot);
    if (!item) return null;
    this.inventory.paperdoll.unequip(slot);
    return item;
  }

  // --- Morph Envelope Implementation ---

  public applyMorph(
    archetypeId: string,
    durationTicks: number,
    newStats: Partial<CombatStats> & { name?: string; speed?: number },
    spillDamage = true
  ): void {
    if (this.morphEnvelope) {
      this.revertMorph(0);
    }

    const origStats: CombatStats = {
      hp: this.hp,
      maxHp: this.maxHp,
      attack: this.attack,
      defense: this.defense,
    };
    const origName = this.name;
    const origSpeed = this.speed;
    const origResistances = { ...(this.elementalResistances ?? {}) };

    const tempHp = newStats.hp ?? newStats.maxHp ?? this.hp;
    const maxTempHp = newStats.maxHp ?? tempHp;

    this.morphEnvelope = {
      originalArchetypeId: archetypeId || (this as any).definitionId || this.id,
      originalName: origName,
      originalStats: origStats,
      originalSpeed: origSpeed,
      originalResistances: origResistances,
      remainingTicks: durationTicks,
      spillDamage,
      temporaryHp: tempHp,
      maxTemporaryHp: maxTempHp,
    };

    if (newStats.name) {
      this.name = newStats.name;
    }
    if (newStats.speed !== undefined) {
      this.speed = newStats.speed;
    }
    if (newStats.attack !== undefined) {
      this.attack = newStats.attack;
    }
    if (newStats.defense !== undefined) {
      this.defense = newStats.defense;
    }
    this.maxHp = maxTempHp;
    this.hp = tempHp;
  }

  public revertMorph(excessDamage = 0): void {
    if (!this.morphEnvelope) return;

    const env = this.morphEnvelope;
    this.morphEnvelope = undefined;

    this.name = env.originalName;
    this.speed = env.originalSpeed;
    this.elementalResistances = env.originalResistances;

    let restoredHp = env.originalStats.hp;
    if (env.spillDamage && excessDamage > 0) {
      restoredHp = Math.max(0, restoredHp - excessDamage);
    }

    this.maxHp = env.originalStats.maxHp;
    this.hp = restoredHp;
    this.attack = env.originalStats.attack;
    this.defense = env.originalStats.defense;
  }

  public tickMorph(ticks = 1): void {
    if (!this.morphEnvelope) return;

    this.morphEnvelope.remainingTicks -= ticks;
    if (this.morphEnvelope.remainingTicks <= 0) {
      this.revertMorph(0);
    }
  }

  public override takeDamage(rawAmount: number): { damageDealt: number; killed: boolean } {
    if (this.isInvulnerable) {
      return { damageDealt: 0, killed: false };
    }
    if (this.morphEnvelope) {
      if (rawAmount >= this.hp) {
        const excess = rawAmount - this.hp;
        const killedMorphHp = this.hp;
        this.revertMorph(excess);
        return {
          damageDealt: killedMorphHp + (this.morphEnvelope ? 0 : excess),
          killed: this.hp <= 0,
        };
      } else {
        this.hp -= rawAmount;
        this.morphEnvelope.temporaryHp = this.hp;
        return { damageDealt: rawAmount, killed: false };
      }
    }
    return super.takeDamage(rawAmount);
  }

  /**
   * Helper factory to create headless immobile/destructible objects (barrels, totems, barricades)
   * that can take combat damage, block path/LOS, and invoke destruction callbacks.
   */
  public static createDestructibleObject(config: {
    id: string;
    name: string;
    position: Position;
    hp: number;
    maxHp?: number;
    defense?: number;
    faction?: Faction;
    blocksLos?: boolean;
    onDestroyed?: (engine: GameEngine, killer?: Entity) => void;
  }): Actor {
    const maxHp = config.maxHp ?? config.hp;
    return new Actor({
      id: config.id,
      name: config.name,
      type: 'monster',
      faction: config.faction ?? 'neutral',
      position: config.position,
      stats: {
        hp: config.hp,
        maxHp,
        attack: 0,
        defense: config.defense ?? 0,
      },
      speed: 0,
      capabilities: {
        canMove: false,
        canAct: false,
        canBlockPath: true,
        isDestructible: true,
        blocksLos: config.blocksLos ?? false,
      },
      onDestroyed: config.onDestroyed,
    });
  }
}
