export type ElementType =
  | 'physical'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'poison'
  | 'arcane'
  | 'healing'
  | (string & {});

export type ElementalAffinity =
  | 'weak'
  | 'neutral'
  | 'resistant'
  | 'immune'
  | 'absorbing'
  | (string & {});

export interface ElementDefinition {
  id: string;
  name: string;
  oppositeElementId?: string;
  canReflect?: boolean;
  groundHazard?: boolean;
  color?: string;
  affinities?: Partial<Record<ElementalAffinity, number>>;
}

export interface AffinityMatrixConfig {
  elements?: ElementDefinition[];
  defaultMultipliers?: Partial<Record<ElementalAffinity, number>> & Record<string, number>;
  matrix?: Record<string, Partial<Record<string, number>>>; // [attackElement][targetAffinity] -> multiplier
}

export const DEFAULT_AFFINITY_MULTIPLIERS: Record<ElementalAffinity, number> = {
  weak: 1.5,
  neutral: 1.0,
  resistant: 0.5,
  immune: 0.0,
  absorbing: -1.0, // Negative damage signifies healing the target
};

export const AFFINITY_MULTIPLIERS = DEFAULT_AFFINITY_MULTIPLIERS;

export const ELEMENT_OPPOSITES: Partial<Record<ElementType, ElementType>> = {
  fire: 'cold',
  cold: 'fire',
  lightning: 'poison',
  poison: 'lightning',
};

export interface DamageCalculationResult {
  baseDamage: number;
  finalDamage: number;
  element: ElementType;
  affinity: ElementalAffinity;
  multiplier: number;
  isHeal: boolean;
  message?: string;
}

export class AffinityMatrix {
  private elements: Map<string, ElementDefinition> = new Map();
  private defaultMultipliers: Record<string, number>;
  private customMatrix: Map<string, Map<string, number>> = new Map();

  constructor(config?: AffinityMatrixConfig) {
    this.defaultMultipliers = { ...DEFAULT_AFFINITY_MULTIPLIERS, ...(config?.defaultMultipliers ?? {}) } as Record<string, number>;

    if (config?.elements) {
      for (const el of config.elements) {
        this.elements.set(el.id, el);
      }
    }

    if (config?.matrix) {
      for (const [attacker, affinities] of Object.entries(config.matrix)) {
        const row = new Map<string, number>();
        for (const [aff, mult] of Object.entries(affinities)) {
          if (mult !== undefined) {
            row.set(aff, mult);
          }
        }
        this.customMatrix.set(attacker, row);
      }
    }
  }

  public registerElement(def: ElementDefinition): void {
    this.elements.set(def.id, def);
  }

  public getElement(id: string): ElementDefinition | undefined {
    return this.elements.get(id);
  }

  public getAllElements(): ElementDefinition[] {
    return Array.from(this.elements.values());
  }

  public getMultiplier(attackElement: string, targetAffinity: string = 'neutral'): number {
    // 1. Check custom matrix override for [attackElement][targetAffinity]
    const row = this.customMatrix.get(attackElement);
    if (row && row.has(targetAffinity)) {
      return row.get(targetAffinity)!;
    }

    // 2. Check element-specific affinity overrides on ElementDefinition
    const elDef = this.elements.get(attackElement);
    if (elDef?.affinities && elDef.affinities[targetAffinity as ElementalAffinity] !== undefined) {
      return elDef.affinities[targetAffinity as ElementalAffinity]!;
    }

    // 3. Fallback to default affinity multiplier
    return this.defaultMultipliers[targetAffinity] ?? 1.0;
  }

  public canReflect(element: string): boolean {
    return this.elements.get(element)?.canReflect ?? false;
  }

  public isGroundHazard(element: string): boolean {
    return this.elements.get(element)?.groundHazard ?? false;
  }

  public getOpposite(element: string): string | undefined {
    return this.elements.get(element)?.oppositeElementId ?? (ELEMENT_OPPOSITES as any)[element];
  }

  public calculateDamage(
    baseDamage: number,
    element: ElementType,
    affinity: ElementalAffinity = 'neutral'
  ): DamageCalculationResult {
    const multiplier = this.getMultiplier(element, affinity);

    if (multiplier < 0 || affinity === 'absorbing') {
      const healAmount = Math.max(1, Math.round(baseDamage * Math.abs(multiplier)));
      return {
        baseDamage,
        finalDamage: -healAmount,
        element,
        affinity,
        multiplier,
        isHeal: true,
        message: `The ${element} energy is absorbed, healing the target!`,
      };
    }

    if (multiplier === 0 || affinity === 'immune') {
      return {
        baseDamage,
        finalDamage: 0,
        element,
        affinity,
        multiplier: 0,
        isHeal: false,
        message: `The target is completely immune to ${element}!`,
      };
    }

    const finalDamage = Math.max(1, Math.round(baseDamage * multiplier));
    let message: string | undefined;

    if (affinity === 'weak' || multiplier > 1.0) {
      message = `Vulnerable to ${element}! (${Math.round(multiplier * 100)}% damage)`;
    } else if (affinity === 'resistant' || multiplier < 1.0) {
      message = `Resistant to ${element}. (${Math.round(multiplier * 100)}% damage)`;
    }

    return {
      baseDamage,
      finalDamage,
      element,
      affinity,
      multiplier,
      isHeal: false,
      message,
    };
  }
}

export const DEFAULT_AFFINITY_MATRIX = new AffinityMatrix({
  elements: [
    { id: 'physical', name: 'Physical' },
    { id: 'fire', name: 'Fire', oppositeElementId: 'cold' },
    { id: 'cold', name: 'Cold', oppositeElementId: 'fire' },
    { id: 'lightning', name: 'Lightning', oppositeElementId: 'poison', canReflect: true },
    { id: 'poison', name: 'Poison', oppositeElementId: 'lightning', groundHazard: true },
    { id: 'arcane', name: 'Arcane' },
    { id: 'healing', name: 'Healing' },
  ],
});

import type { TileType } from '../types';

export function calculateElementalDamage(
  baseDamage: number,
  element: ElementType,
  affinity: ElementalAffinity = 'neutral',
  matrix: AffinityMatrix = DEFAULT_AFFINITY_MATRIX,
  terrainType?: TileType
): DamageCalculationResult {
  const result = matrix.calculateDamage(baseDamage, element, affinity);
  if (result.isHeal || result.finalDamage === 0) return result;

  if (terrainType === 'shallow_water') {
    if (element === 'fire') {
      result.finalDamage = Math.max(1, Math.floor(result.finalDamage * 0.5));
      result.multiplier *= 0.5;
      result.message = `${result.message ? result.message + ' ' : ''}(Water Resistance: 50% Fire damage!)`;
    } else if (element === 'lightning') {
      result.finalDamage = Math.floor(result.finalDamage * 2.0);
      result.multiplier *= 2.0;
      result.message = `${result.message ? result.message + ' ' : ''}(Water Conduction: 200% Lightning vulnerability!)`;
    }
  }

  return result;
}
