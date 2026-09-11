import type { ElementType } from '../magic/elements';
import type { Predicate } from '../predicates/types';
import type { HookDescriptor } from '../hooks/hookDispatcher';

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
  public parent: Item | null = null;
  public durability?: { current: number; max: number };
  public aspectState?: string;

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
  }

  public get effectiveStats(): ItemStatModifiers {
    if (this.isBroken()) {
      return { attackBonus: 0, defenseBonus: 0, speedBonus: 0, strengthBonus: 0 };
    }
    return this.stats;
  }

  public get displayName(): string {
    let base = this.name;
    if (this.isBroken()) {
      base = `Broken ${this.name}`;
    } else if (!this.identified) {
      base = this.unidentifiedName;
    } else if (this.quality === 'cursed' || this.aspectState === 'aspect_corrupt') {
      base = `Cursed ${this.name}`;
    } else if (this.enchantmentLevel > 0 || this.elementalAffix) {
      const enchStr = this.enchantmentLevel > 0 ? ` +${this.enchantmentLevel}` : '';
      const affixStr = this.elementalAffix ? ` ${this.elementalAffix.name}` : '';
      base = `${this.name}${enchStr}${affixStr}`;
    } else if (this.quality === 'enchanted' && (this.stats.attackBonus || this.stats.defenseBonus)) {
      const bonus = (this.stats.attackBonus ?? 0) + (this.stats.defenseBonus ?? 0);
      base = bonus > 0 ? `+${bonus} ${this.name}` : `${bonus} ${this.name}`;
    }
    return this.quantity > 1 ? `${base} (x${this.quantity})` : base;
  }

  public isCursed(): boolean {
    return this.quality === 'cursed' || this.aspectState === 'aspect_corrupt';
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
}
