import type { Predicate } from './types';

const LEAF_TYPES = new Set(['hasFlag', 'minCounter', 'maxCounter', 'minFaction', 'maxFaction']);

/**
 * Whether `value` is a predicate the evaluator knows, all the way down: every node a known
 * `type`, every `and`/`or` holding an array, every `not` holding one. An unknown node
 * anywhere makes the whole predicate unknown, so `evaluatePredicate` fails closed on it.
 */
export function isKnownPredicate(value: unknown): value is Predicate {
  if (!value || typeof value !== 'object') return false;
  const node = value as { type?: unknown; predicates?: unknown; predicate?: unknown };
  if (typeof node.type !== 'string') return false;
  if (LEAF_TYPES.has(node.type)) return true;
  if (node.type === 'and' || node.type === 'or') {
    return Array.isArray(node.predicates) && node.predicates.every(isKnownPredicate);
  }
  if (node.type === 'not') return isKnownPredicate(node.predicate);
  return false;
}

/** The fields content uses for a predicate (`ChoiceDefinition.predicate`, `when` on a perk or ending paragraph, ...). */
const PREDICATE_KEYS = new Set(['predicate', 'when']);

/**
 * Walks a content manifest (or any part of one) and returns the path of every object under a
 * predicate field that `evaluatePredicate` does not know. Content checks run it over each
 * pack, so a misspelled predicate type fails the gate instead of locking a choice in play.
 */
export function findUnknownPredicates(root: unknown, rootPath = 'manifest'): string[] {
  const found: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
      if (PREDICATE_KEYS.has(key) && child && typeof child === 'object' && !Array.isArray(child)) {
        if (!isKnownPredicate(child)) found.push(childPath);
        continue;
      }
      visit(child, childPath);
    }
  };
  visit(root, rootPath);
  return found;
}
