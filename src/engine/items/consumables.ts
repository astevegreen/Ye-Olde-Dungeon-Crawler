import { Item, type ItemConfig } from './item';
import type { ConsumableEffectDescriptor } from '../types/manifest';

export interface WandConfig extends Omit<ItemConfig, 'category' | 'weight' | 'bulk'> {
  spellId: string;
  charges: number;
  maxCharges?: number;
  weight?: number;
  bulk?: number;
}

export class WandItem extends Item {
  public readonly spellId: string;
  public charges: number;
  public readonly maxCharges: number;

  constructor(config: WandConfig) {
    super({
      ...config,
      category: 'consumable',
      weight: config.weight ?? 300,
      bulk: config.bulk ?? 150,
    });
    this.spellId = config.spellId;
    this.maxCharges = config.maxCharges ?? config.charges;
    this.charges = config.charges;
  }

  public canZap(): boolean {
    return this.charges > 0;
  }

  public useCharge(): boolean {
    if (this.charges > 0) {
      this.charges -= 1;
      return true;
    }
    return false;
  }

  public override get displayName(): string {
    if (!this.identified) {
      return this.unidentifiedName;
    }
    return `${this.name} (${this.charges}/${this.maxCharges} charges)`;
  }
}

export interface ScrollConfig extends Omit<ItemConfig, 'category' | 'weight' | 'bulk'> {
  spellId: string;
  weight?: number;
  bulk?: number;
}

export class ScrollItem extends Item {
  public readonly spellId: string;

  constructor(config: ScrollConfig) {
    super({
      ...config,
      category: 'consumable',
      weight: config.weight ?? 50,
      bulk: config.bulk ?? 40,
    });
    this.spellId = config.spellId;
  }
}

/**
 * Built-in canonical potion categories.
 */
export type PotionType = 'health' | 'mana' | 'antidote' | 'custom';

export interface PotionConfig extends Omit<ItemConfig, 'category' | 'weight' | 'bulk'> {
  potionType?: PotionType;
  potency?: number;
  weight?: number;
  bulk?: number;
  /**
   * Declarative array of effect descriptors executed sequentially upon consumption.
   */
  effects?: ConsumableEffectDescriptor[];
}

export class PotionItem extends Item {
  public readonly potionType: PotionType;
  public readonly potency: number;
  public readonly effects: readonly ConsumableEffectDescriptor[];

  constructor(config: PotionConfig) {
    super({
      ...config,
      category: 'consumable',
      weight: config.weight ?? 350,
      bulk: config.bulk ?? 200,
    });
    this.potionType = config.potionType ?? 'custom';
    this.potency = config.potency ?? 0;

    if (config.effects && config.effects.length > 0) {
      this.effects = config.effects;
    } else {
      // Derive default declarative effects from canonical potion type & potency
      if (config.potionType === 'health') {
        this.effects = [{ type: 'restore_hp', amount: config.potency ?? 20 }];
      } else if (config.potionType === 'mana') {
        this.effects = [{ type: 'restore_mana', amount: config.potency ?? 15 }];
      } else if (config.potionType === 'antidote') {
        this.effects = [{ type: 'cure_status', status: 'poison' }];
      } else {
        this.effects = [];
      }
    }
  }
}

