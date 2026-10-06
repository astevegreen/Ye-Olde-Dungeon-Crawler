import type { ElementType } from '../magic/elements';
import type { Predicate } from '../predicates/types';
import type { HookDescriptor } from '../hooks/hookDispatcher';
import type { PerkEffects } from '../types/perks';
import {
  type ItemModifier,
  isModifierCursed,
  isModifierBinding,
  isModifierBlessed,
  isModifierChaotic,
  isModifierHexed,
  isModifierUnholy,
  isModifierHoly,
  isModifierEnchantedCategory,
} from './modifiers';
import { getRegisteredContainer } from './containerRegistry';

/**
 * What an item is beyond its family and +N: `artifact` marks the pack's unique named pieces
 * (never identified, never rolled a family). The old `enchanted`/`cursed`/`broken` labels are
 * gone (Q1 "A"): a family says what an item is, and a save's old label loads as normal.
 */
export type ItemQuality = 'normal' | 'artifact';

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
  junk?: boolean;
  stats?: ItemStatModifiers;
  description?: string;
  value?: number;
  /** The definition's value, before the +N and affix scaled it; `value` when absent. */
  baseValue?: number;
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
  aspectState?: string;
  unitWeight?: number;
  modifiers?: ItemModifier[];
  /** The definition's `wornEffects`: what wearing it does beside its stats. Not saved. */
  wornEffects?: PerkEffects;
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
  /** The hero marked it junk: a shop's "sell all junk" sells it, and auto-pickup leaves it. */
  public junk: boolean;
  public readonly stats: ItemStatModifiers;
  public readonly description: string;
  public value: number;
  /** What the plain item is worth: an unidentified one is appraised by this, so a hidden +N or family never shows in a price. */
  public readonly baseValue: number;
  public readonly minFloor?: number;
  public readonly tier?: number;
  public enchantmentLevel: number;
  public elementalAffix?: ElementalAffix;
  public readonly twoHanded?: boolean;
  public readonly blocksSlot?: string;
  public readonly rangedConfig?: RangedWeaponConfig;
  public readonly predicate?: Predicate;
  public readonly hooks?: HookDescriptor[];
  /** What wearing it does beside its stats (`ItemDefinition.wornEffects`), read by `wornModifiers`. */
  public readonly wornEffects?: PerkEffects;
  public parentId: string | null = null;
  public ownerId: string | null = null;
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
    this.junk = config.junk ?? false;
    this.parentId = config.parentId ?? null;
    this.ownerId = config.ownerId ?? null;
    this.stats = config.stats ?? {};
    this.description = config.description ?? '';
    this.value = config.value ?? 0;
    this.baseValue = config.baseValue ?? this.value;
    this.minFloor = config.minFloor;
    this.tier = config.tier;
    this.enchantmentLevel = config.enchantmentLevel ?? 0;
    this.elementalAffix = config.elementalAffix;
    this.twoHanded = config.twoHanded;
    this.blocksSlot = config.blocksSlot;
    this.rangedConfig = config.rangedConfig;
    this.predicate = config.predicate;
    this.hooks = config.hooks ? [...config.hooks] : undefined;
    this.wornEffects = config.wornEffects;
    this.aspectState = config.aspectState;
    this.modifiers = config.modifiers ? [...config.modifiers] : [];
  }

  public get effectiveStats(): ItemStatModifiers {
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

  public canBeIdentified(): boolean {
    if (this.quality === 'artifact') return false;
    if (this.category === 'currency') return false;
    if (this.category === 'quest') return false;
    if (this.category === 'misc') return false;
    if (this.category === 'container') return false;
    const identifiableCategories = [
      'weapon',
      'armor',
      'shield',
      'helmet',
      'boots',
      'gauntlets',
      'bracers',
      'cloak',
      'amulet',
      'ring',
      'waist',
      'belt',
      'ranged',
      'wand',
    ];
    if (identifiableCategories.includes(this.category)) return true;
    return this.modifiers.length > 0;
  }

  /**
   * The worth the hero can see: the true value once identified, else the plain item's
   * (`baseValue`, without the hidden +N or affix), as the sell price reads it (Q21).
   */
  public get knownValue(): number {
    return this.identified ? this.value : this.baseValue;
  }

  /** One unit's name: the display name without a stack's "(Nx)" tag. */
  public get unitDisplayName(): string {
    return this.displayName.replace(/\s\(\d+x\)$/, '');
  }

  public get displayName(): string {
    const qtyTag = this.quantity > 1 ? ` (${this.quantity}x)` : '';
    if (!this.identified) {
      let unId = this.unidentifiedName;
      const isObfuscatedAlias =
        (this.category === 'wand' || this.category === 'potion' || this.category === 'scroll') &&
        this.unidentifiedName !== this.name;
      if (this.canBeIdentified() && !isObfuscatedAlias && !unId.toLowerCase().startsWith('unidentified')) {
        unId = `Unidentified ${unId}`;
      }
      return `${unId}${qtyTag}`;
    }
    let base = this.name;
    if (this.enchantmentLevel > 0 || this.elementalAffix) {
      const enchStr = this.enchantmentLevel > 0 ? ` +${this.enchantmentLevel}` : '';
      const affixStr = this.elementalAffix ? ` ${this.elementalAffix.name}` : '';
      base = `${this.name}${enchStr}${affixStr}`;
    }

    // A family names the item through its own prefix or suffix, nothing is inferred: a
    // Holy item is "Broadsword of the Templar", not "Blessed Broadsword of the Templar".
    const prefixes = this.modifiers.map((m) => m.prefix).filter(Boolean) as string[];
    const suffixes = this.modifiers.map((m) => m.suffix).filter(Boolean) as string[];

    if (prefixes.length > 0) {
      base = `${prefixes.join(' ')} ${base}`;
    }

    if (suffixes.length > 0) {
      base = `${base} ${suffixes.join(' ')}`;
    }

    return `${base}${qtyTag}`;
  }

  /** The Cursed family (the four cursed relics are pinned to it). */
  public isCursed(): boolean {
    return this.aspectState === 'aspect_corrupt' || this.modifiers.some(isModifierCursed);
  }

  /**
   * Worn, it stays on until a cleansing takes the binding family off it: Cursed, Hexed
   * and Unholy in cotw (`ItemFamilyDefinition.binds`).
   */
  public isBound(): boolean {
    return this.modifiers.some(isModifierBinding);
  }

  public isBlessed(): boolean {
    return this.modifiers.some(isModifierBlessed);
  }

  public isChaotic(): boolean {
    return this.modifiers.some(isModifierChaotic);
  }

  public isHexed(): boolean {
    return this.modifiers.some(isModifierHexed);
  }

  public isUnholy(): boolean {
    return this.modifiers.some(isModifierUnholy);
  }

  public isHoly(): boolean {
    return this.modifiers.some(isModifierHoly);
  }

  /** The Enchanted family, a +N or an elemental affix. */
  public isEnchanted(): boolean {
    return this.enchantmentLevel > 0 || !!this.elementalAffix || this.modifiers.some(isModifierEnchantedCategory);
  }

  /** A cleansing: takes off every binding family (and any Cursed one), keeps the rest. */
  public uncurse(): { uncursed: boolean; removedModifiers: string[] } {
    const removed: string[] = [];
    const kept: ItemModifier[] = [];

    for (const mod of this.modifiers) {
      if (isModifierCursed(mod) || isModifierBinding(mod)) {
        removed.push(mod.name);
      } else {
        kept.push(mod);
      }
    }

    const hadCurse = removed.length > 0 || this.aspectState === 'aspect_corrupt';

    this.modifiers = kept;
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
