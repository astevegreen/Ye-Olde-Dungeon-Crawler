import type { Actor } from '../entities/actor';

export type CorruptionAffliction =
  | 'tissue_necrosis'
  | 'neural_decay'
  | 'loss_of_divine_wards';

export const CORRUPTION_THRESHOLDS = {
  NECROSIS: 25,
  NEURAL_DECAY: 50,
  DIVINE_LOSS: 75,
} as const;

export interface DualEnergyConfig {
  structuredEnergy?: number;
  maxStructuredEnergy?: number;
  volatileEnergy?: number;
  maxVolatileEnergy?: number;
}

export class EnergyModel {
  public structuredEnergy: number;
  public maxStructuredEnergy: number;
  public volatileEnergy: number;
  public maxVolatileEnergy: number;
  public vitalityTenderBurned: number = 0;

  constructor(config: DualEnergyConfig = {}) {
    this.maxStructuredEnergy = config.maxStructuredEnergy ?? 100;
    this.structuredEnergy = config.structuredEnergy ?? this.maxStructuredEnergy;
    this.maxVolatileEnergy = config.maxVolatileEnergy ?? 50;
    this.volatileEnergy = config.volatileEnergy ?? 0;
  }

  public consumeStructuredEnergy(amount: number): boolean {
    if (amount < 0) return false;
    if (this.structuredEnergy < amount) return false;
    this.structuredEnergy -= amount;
    return true;
  }

  public regenerateStructuredEnergy(amount: number): number {
    if (amount <= 0) return this.structuredEnergy;
    const previous = this.structuredEnergy;
    this.structuredEnergy = Math.min(this.maxStructuredEnergy, this.structuredEnergy + amount);
    return this.structuredEnergy - previous;
  }

  public consumeVolatileEnergy(
    actor: Actor,
    amount: number,
    corruptionMultiplier = 1.0
  ): { success: boolean; corruptionAdded: number } {
    if (amount < 0 || this.volatileEnergy < amount) {
      return { success: false, corruptionAdded: 0 };
    }
    this.volatileEnergy -= amount;
    const corruptionGain = Math.ceil(amount * corruptionMultiplier);
    this.addCorruption(actor, corruptionGain);
    return { success: true, corruptionAdded: corruptionGain };
  }

  public burnVitalityTender(
    actor: Actor,
    burnAmount: number,
    corruptionGain?: number
  ): boolean {
    if (burnAmount <= 0) return false;
    if (actor.maxHp <= burnAmount) {
      return false; // Cannot burn all remaining maximum life
    }

    actor.maxHp = actor.maxHp - burnAmount;
    if (actor.hp > actor.maxHp) {
      actor.hp = actor.maxHp;
    }
    this.vitalityTenderBurned += burnAmount;

    const corruption = corruptionGain ?? burnAmount;
    this.addCorruption(actor, corruption);
    return true;
  }

  public addCorruption(actor: Actor, delta: number): CorruptionAffliction[] {
    if (delta <= 0) return [];
    const prevScore = actor.corruptionScore;
    actor.corruptionScore += delta;
    const newScore = actor.corruptionScore;

    const newAfflictions: CorruptionAffliction[] = [];

    if (prevScore < CORRUPTION_THRESHOLDS.NECROSIS && newScore >= CORRUPTION_THRESHOLDS.NECROSIS) {
      newAfflictions.push('tissue_necrosis');
      actor.statusManager.applyStatus('tissue_necrosis' as any, 9999);
    }
    if (
      prevScore < CORRUPTION_THRESHOLDS.NEURAL_DECAY &&
      newScore >= CORRUPTION_THRESHOLDS.NEURAL_DECAY
    ) {
      newAfflictions.push('neural_decay');
      actor.statusManager.applyStatus('neural_decay' as any, 9999);
    }
    if (
      prevScore < CORRUPTION_THRESHOLDS.DIVINE_LOSS &&
      newScore >= CORRUPTION_THRESHOLDS.DIVINE_LOSS
    ) {
      newAfflictions.push('loss_of_divine_wards');
      actor.statusManager.applyStatus('loss_of_divine_wards' as any, 9999);
      // Remove divine and holy affinities
      delete actor.elementalResistances['holy' as any];
    }

    return newAfflictions;
  }

  public static getActiveAfflictions(corruptionScore: number): CorruptionAffliction[] {
    const list: CorruptionAffliction[] = [];
    if (corruptionScore >= CORRUPTION_THRESHOLDS.NECROSIS) {
      list.push('tissue_necrosis');
    }
    if (corruptionScore >= CORRUPTION_THRESHOLDS.NEURAL_DECAY) {
      list.push('neural_decay');
    }
    if (corruptionScore >= CORRUPTION_THRESHOLDS.DIVINE_LOSS) {
      list.push('loss_of_divine_wards');
    }
    return list;
  }

  /**
   * Scaling multiplier granted to entropic abilities based on corruption.
   * e.g. 50 corruptionScore grants 1.50x damage multiplier.
   */
  public static calculateEntropicDamageMultiplier(corruptionScore: number): number {
    return 1.0 + Math.max(0, corruptionScore) * 0.01;
  }

  /**
   * Calculates current healing efficiency multiplier for the actor.
   * If afflicted with tissue necrosis, healing efficacy is reduced to 75%.
   */
  public static calculateHealingEfficiency(actor: Actor): number {
    if (actor.corruptionScore >= CORRUPTION_THRESHOLDS.NECROSIS || actor.statusManager.hasStatus('tissue_necrosis' as any)) {
      return 0.75;
    }
    return 1.0;
  }
}
