import type { WorldState } from '../state/worldState';
import { getFlag, getCounter, getFaction } from '../state/worldState';
import type { Predicate } from './types';
import { isKnownPredicate } from './predicateValidation';

/**
 * Pure evaluation engine for condition predicates evaluated against a WorldState ledger.
 * Returns true if predicate is undefined or empty. Fails closed: a predicate with an
 * unknown type anywhere in it is false, so a content typo locks its choice or stock rather
 * than opening it (the content check `findUnknownPredicates` catches it before play).
 */
export function evaluatePredicate(predicate: Predicate | undefined, worldState: WorldState): boolean {
  if (!predicate) {
    return true;
  }
  return isKnownPredicate(predicate) && evaluateKnown(predicate, worldState);
}

function evaluateKnown(predicate: Predicate, worldState: WorldState): boolean {
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
      return predicate.predicates.every((p) => evaluateKnown(p, worldState));
    }
    case 'or': {
      return predicate.predicates.some((p) => evaluateKnown(p, worldState));
    }
    case 'not': {
      return !evaluateKnown(predicate.predicate, worldState);
    }
    default:
      return false;
  }
}
