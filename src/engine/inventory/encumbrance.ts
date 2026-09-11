export enum EncumbranceLevel {
  Unencumbered = 'Unencumbered',
  Burdened = 'Burdened',
  Overburdened = 'Overburdened',
  Immobilized = 'Immobilized',
}

export const GRAMS_PER_STRENGTH = 2500; // 1 Strength allows 2.5kg of carrying capacity

/**
 * Calculates max carrying capacity in grams based on Strength.
 */
export function getMaxCarryWeight(strength: number): number {
  return Math.max(1, strength) * GRAMS_PER_STRENGTH;
}

/**
 * Determines current encumbrance tier given carried weight and strength.
 */
export function getEncumbranceLevel(totalWeight: number, strength: number): EncumbranceLevel {
  const maxWeight = getMaxCarryWeight(strength);
  const ratio = totalWeight / maxWeight;

  if (ratio <= 0.5) {
    return EncumbranceLevel.Unencumbered;
  }
  if (ratio <= 0.75) {
    return EncumbranceLevel.Burdened;
  }
  if (ratio <= 1.0) {
    return EncumbranceLevel.Overburdened;
  }
  return EncumbranceLevel.Immobilized;
}

/**
 * Action cost multiplier applied by encumbrance state.
 * Slower movement/attacks consume more energy, reducing action frequency.
 */
export function getEncumbranceMultiplier(level: EncumbranceLevel): number {
  switch (level) {
    case EncumbranceLevel.Unencumbered:
      return 1.0;
    case EncumbranceLevel.Burdened:
      return 1.25; // 25% slower
    case EncumbranceLevel.Overburdened:
      return 1.6; // 60% slower
    case EncumbranceLevel.Immobilized:
      return 2.5; // 150% slower / heavily penalized
  }
}

/**
 * Returns adjusted action energy cost based on encumbrance.
 */
export function calculateEncumberedActionCost(baseCost: number, level: EncumbranceLevel): number {
  return Math.round(baseCost * getEncumbranceMultiplier(level));
}
