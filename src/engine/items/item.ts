import type { ElementType } from '../magic/elements';
import type { Predicate } from '../predicates/types';
import type { HookDescriptor } from '../hooks/hookDispatcher';
import type { ItemModifier } from './modifiers';
import { getRegisteredContainer } from './containerRegistry';

export type ItemQuality = 'broken' | 'normal' | 'enchanted' | 'cursed' | 'artifact';

export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'helmet'
  | 'boots'
  | 'gauntlets'
  | 'bracers'
  | 'cloak'
  | 'amulet'
  | 'ring'
  | 'container'
  | 'consumable'
  | 'currency'
  | 'quest'
  | 'misc'
  | (string & {});

export type EquipmentSlot =
  | 'head'
  | 'neck'
  | 'torso'
  | 'overgarment'
  | 'mainHand'
  | 'offHand'
  | 'hands'
  | 'wrists'
  | 'waist'
  | 'feet'
  | 'fingerLeft'
  | 'fingerRight'
  | 'pack'
  | 'purse'
  | (string & {});

export interface ItemStatModifiers {
  attackBonus?: number;
  defenseBonus?: number; // Armor Value (AV)
  speedBonus?: number;
  strengthBonus?: number;
}

export interface ElementalAffix {
  element: ElementType;
  bonusDamage: number;
  name: string;
}

export interface RangedWeaponConfig {
  range: number;
  ammoType?: string; // e.g. 'arrow', 'bolt', 'bullet'
  consumesSelf?: boolean; // e.g. true for throwing daggers, javelins, rocks
  baseDamage?: number;
}

export interface ItemConfig {
  id: string;
  name: string;
  unidentifiedName?: string;
  category: ItemCategory;
  slot?: EquipmentSlot;
  weight: number; // in grams (g)
  bulk: number; // in cubic centimeters (cm³)
  quality?: ItemQuality;
  identified?: boolean;
  stats?: ItemStatModifiers;
  description?: string;
  value?: number;
  minFloor?: number;
  tier?: number;
  enchantmentLevel?: number;
  elementalAffix?: ElementalAffix;
  twoHanded?: boolean;
  blocksSlot?: string;
  rangedConfig?: RangedWeaponConfig;
  predicate?: Predicate;
  hooks?: HookDescriptor[];
  definitionId?: string;
  quantity?: number;
  durability?: { current: number; max: number };
  aspectState?: string;
  unitWeight?: number;
  modifiers?: ItemModifier[];
  parentId?: string | null;
  ownerId?: string | null;
}

export class Item {
  public readonly id: string;
  public readonly definitionId?: string;
  public readonly name: string;
  public readonly unidentifiedName: string;
  public readonly category: ItemCategory;
  public readonly slot?: EquipmentSlot;
  public readonly weight: number; // in grams
  public readonly unitWeight: number; // in grams per unit
  public readonly bulk: number; // in cm³
  public quantity: number;
  public quality: ItemQuality;
  public identified: boolean;
  public readonly stats: ItemStatModifiers;
  public readonly description: string;
  public value: number;
  public readonly minFloor?: number;
  public readonly tier?: number;
  public enchantmentLevel: number;
  public elementalAffix?: ElementalAffix;
  public readonly twoHanded?: boolean;
  public readonly blocksSlot?: string;
  public readonly rangedConfig?: RangedWeaponConfig;
  public readonly predicate?: Predicate;
  public readonly hooks?: HookDescriptor[];
  public parentId: string | null = null;
  public ownerId: string | null = null;
  public durability?: { current: number; max: number };
  public aspectState?: string;
  public modifiers: ItemModifier[] = [];

  constructor(config: ItemConfig) {
    this.id = config.id;
    this.definitionId = config.definitionId;
    this.name = config.name;
    this.unidentifiedName = config.unidentifiedName ?? config.name;
    this.category = config.category;
    this.slot = config.slot;
    this.weight = config.weight;
    this.unitWeight = config.unitWeight ?? config.weight ?? 0;
    this.bulk = config.bulk;
    this.quantity = config.quantity ?? 1;
    this.quality = config.quality ?? 'normal';
    this.identified = config.identified ?? false;
    this.parentId = config.parentId ?? null;
    this.ownerId = config.ownerId ?? null;
    this.stats = config.stats ?? {};
    this.description = config.description ?? '';
    this.value = config.value ?? 0;
    this.minFloor = config.minFloor;
    this.tier = config.tier;
    this.enchantmentLevel = config.enchantmentLevel ?? 0;
    this.elementalAffix = config.elementalAffix;
    this.twoHanded = config.twoHanded;
    this.blocksSlot = config.blocksSlot;
    this.rangedConfig = config.rangedConfig;
    this.predicate = config.predicate;
    this.hooks = config.hooks ? [...config.hooks] : undefined;
    this.durability = config.durability ? { ...config.durability } : undefined;
    this.aspectState = config.aspectState;
    this.modifiers = config.modifiers ? [...config.modifiers] : [];
  }

  public get effectiveStats(): ItemStatModifiers {
    if (this.isBroken()) {
      return { attackBonus: 0, defenseBonus: 0, speedBonus: 0, strengthBonus: 0 };
    }
    const combined: ItemStatModifiers = { ...this.stats };
    for (const mod of this.modifiers) {
      if (mod.statDeltas) {
        if (mod.statDeltas.attackBonus) combined.attackBonus = (combined.attackBonus ?? 0) + mod.statDeltas.attackBonus;
        if (mod.statDeltas.defenseBonus) combined.defenseBonus = (combined.defenseBonus ?? 0) + mod.statDeltas.defenseBonus;
        if (mod.statDeltas.speedBonus) combined.speedBonus = (combined.speedBonus ?? 0) + mod.statDeltas.speedBonus;
        if (mod.statDeltas.strengthBonus) combined.strengthBonus = (combined.strengthBonus ?? 0) + mod.statDeltas.strengthBonus;
      }
    }
    return combined;
  }

  public get displayName(): string {
    if (!this.identified) {
      return this.quantity > 1 ? `${this.unidentifiedName} (x${this.quantity})` : this.unidentifiedName;
    }
    if (this.isBroken()) {
      const brokenName = `Broken ${this.name}`;
      return this.quantity > 1 ? `${brokenName} (x${this.quantity})` : brokenName;
    }

    let base = this.name;
    if (this.enchantmentLevel > 0 || this.elementalAffix) {
      const enchStr = this.enchantmentLevel > 0 ? ` +${this.enchantmentLevel}` : '';
      const affixStr = this.elementalAffix ? ` ${this.elementalAffix.name}` : '';
      base = `${this.name}${enchStr}${affixStr}`;
    } else if (this.quality === 'enchanted' && (this.stats.attackBonus || this.stats.defenseBonus)) {
      const bonus = (this.stats.attackBonus ?? 0) + (this.stats.defenseBonus ?? 0);
      base = bonus > 0 ? `+${bonus} ${this.name}` : `${bonus} ${this.name}`;
    }

    // Affixes from declarative modifiers (prefixes and suffixes)
    const prefixes = this.modifiers.map((m) => m.prefix).filter(Boolean) as string[];
    const suffixes = this.modifiers.map((m) => m.suffix).filter(Boolean) as string[];

    if (prefixes.length > 0) {
      base = `${prefixes.join(' ')} ${base}`;
    } else if (this.isCursed() && !base.startsWith('Cursed')) {
      base = `Cursed ${base}`;
    }

    if (suffixes.length > 0) {
      base = `${base} ${suffixes.join(' ')}`;
    }

    return this.quantity > 1 ? `${base} (x${this.quantity})` : base;
  }

  public isCursed(): boolean {
    return (
      this.quality === 'cursed' ||
      this.aspectState === 'aspect_corrupt' ||
      this.modifiers.some((m) => m.cursed === true || m.category === 'cursed')
    );
  }

  public uncurse(): { uncursed: boolean; removedModifiers: string[] } {
    const removed: string[] = [];
    const kept: ItemModifier[] = [];

    for (const mod of this.modifiers) {
      if (mod.cursed === true || mod.category === 'cursed') {
        removed.push(mod.name);
      } else {
        kept.push(mod);
      }
    }

    const hadCurse =
      removed.length > 0 ||
      this.quality === 'cursed' ||
      this.aspectState === 'aspect_corrupt';

    this.modifiers = kept;
    if (this.quality === 'cursed') {
      this.quality = 'normal';
    }
    if (this.aspectState === 'aspect_corrupt') {
      this.aspectState = undefined;
    }

    return {
      uncursed: hadCurse,
      removedModifiers: removed,
    };
  }

  public addModifier(modifier: ItemModifier): void {
    this.modifiers.push(modifier);
  }

  public removeModifier(modifierId: string): boolean {
    const idx = this.modifiers.findIndex((m) => m.id === modifierId);
    if (idx >= 0) {
      this.modifiers.splice(idx, 1);
      return true;
    }
    return false;
  }

  public isBroken(): boolean {
    return this.quality === 'broken' || (this.durability !== undefined && this.durability.current <= 0);
  }

  public repair(): void {
    if (this.durability) {
      this.durability.current = this.durability.max;
    }
    if (this.quality === 'broken') {
      this.quality = 'normal';
    }
  }

  public totalWeight(): number {
    const unit = this.unitWeight > 0 ? this.unitWeight : this.weight;
    return unit * (this.quantity ?? 1);
  }

  public totalBulk(): number {
    return this.bulk * (this.quantity ?? 1);
  }

  public getParentContainer<T = any>(): T | null {
    return this.parentId ? getRegisteredContainer<T>(this.parentId) : null;
  }
}
