import type { WorldState } from '../state/worldState';
import { getFlag, getCounter, getFaction } from '../state/worldState';
import type { Predicate } from './types';

/**
 * Pure evaluation engine for condition predicates evaluated against a WorldState ledger.
 * Returns true if predicate is undefined or empty.
 */
export function evaluatePredicate(predicate: Predicate | undefined, worldState: WorldState): boolean {
  if (!predicate) {
    return true;
  }

  switch (predicate.type) {
    case 'hasFlag': {
      const expected = predicate.value ?? true;
      return getFlag(worldState, predicate.flag) === expected;
    }
    case 'minCounter': {
      return getCounter(worldState, predicate.counter) >= predicate.value;
    }
    case 'maxCounter': {
      return getCounter(worldState, predicate.counter) <= predicate.value;
    }
    case 'minFaction': {
      return getFaction(worldState, predicate.faction) >= predicate.value;
    }
    case 'maxFaction': {
      return getFaction(worldState, predicate.faction) <= predicate.value;
    }
    case 'and': {
      return predicate.predicates.every((p) => evaluatePredicate(p, worldState));
    }
    case 'or': {
      return predicate.predicates.some((p) => evaluatePredicate(p, worldState));
    }
    case 'not': {
      return !evaluatePredicate(predicate.predicate, worldState);
    }
    default:
      return true;
  }
}
