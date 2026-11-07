import { describe, it, expect } from 'vitest';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import { createWorldState } from '../state/worldState';
import type { Predicate } from '../predicates/types';

type Ledger = Parameters<typeof createWorldState>[0];

const both = (type: 'and' | 'or'): Predicate => ({
  type,
  predicates: [
    { type: 'hasFlag', flag: 'a', value: true },
    { type: 'hasFlag', flag: 'b', value: true },
  ],
});

describe('PredicateEvaluator', () => {
  it('returns true when predicate is undefined', () => {
    expect(evaluatePredicate(undefined, createWorldState())).toBe(true);
  });

  it.each<[string, Ledger, Predicate, boolean]>([
    // hasFlag
    ['hasFlag matches true', { flags: { hero_found: true } }, { type: 'hasFlag', flag: 'hero_found', value: true }, true],
    ['hasFlag matches false', { flags: { hero_found: false } }, { type: 'hasFlag', flag: 'hero_found', value: false }, true],
    ['hasFlag expects true by default', { flags: { hero_found: true } }, { type: 'hasFlag', flag: 'hero_found' }, true],
    ['hasFlag mismatch', { flags: { hero_found: false } }, { type: 'hasFlag', flag: 'hero_found', value: true }, false],
    ['hasFlag set true, asked false', { flags: { hero_found: true } }, { type: 'hasFlag', flag: 'hero_found', value: false }, false],
    ['unset flag is false', {}, { type: 'hasFlag', flag: 'chest_opened' }, false],
    // counters: each bound inclusive, and one past it fails
    ['minCounter above', { counters: { gold: 51 } }, { type: 'minCounter', counter: 'gold', value: 50 }, true],
    ['minCounter at the bound', { counters: { gold: 50 } }, { type: 'minCounter', counter: 'gold', value: 50 }, true],
    ['minCounter below', { counters: { gold: 49 } }, { type: 'minCounter', counter: 'gold', value: 50 }, false],
    ['maxCounter at the bound', { counters: { gold: 50 } }, { type: 'maxCounter', counter: 'gold', value: 50 }, true],
    ['maxCounter above', { counters: { gold: 51 } }, { type: 'maxCounter', counter: 'gold', value: 50 }, false],
    // factions
    ['minFaction above', { factions: { townsfolk: 10 } }, { type: 'minFaction', faction: 'townsfolk', value: 5 }, true],
    ['minFaction at the bound', { factions: { townsfolk: 5 } }, { type: 'minFaction', faction: 'townsfolk', value: 5 }, true],
    ['minFaction below', { factions: { townsfolk: 4 } }, { type: 'minFaction', faction: 'townsfolk', value: 5 }, false],
    ['minFaction with a negative standing', { factions: { thieves: -20 } }, { type: 'minFaction', faction: 'thieves', value: 0 }, false],
    ['maxFaction below', { factions: { townsfolk: 5 } }, { type: 'maxFaction', faction: 'townsfolk', value: 10 }, true],
    ['maxFaction at the bound', { factions: { townsfolk: 10 } }, { type: 'maxFaction', faction: 'townsfolk', value: 10 }, true],
    ['maxFaction above', { factions: { townsfolk: 11 } }, { type: 'maxFaction', faction: 'townsfolk', value: 10 }, false],
    // logic
    ['and, all true', { flags: { a: true, b: true } }, both('and'), true],
    ['and, one false', { flags: { a: true, b: false } }, both('and'), false],
    ['or, one true', { flags: { a: true, b: false } }, both('or'), true],
    ['or, only the second true', { flags: { a: false, b: true } }, both('or'), true],
    ['or, all false', { flags: { a: false, b: false } }, both('or'), false],
    ['not of a true flag', { flags: { a: true } }, { type: 'not', predicate: { type: 'hasFlag', flag: 'a', value: true } }, false],
    ['not of a false match', { flags: { a: true } }, { type: 'not', predicate: { type: 'hasFlag', flag: 'a', value: false } }, true],
    [
      'nested and/or',
      { flags: { a: true, b: false }, counters: { c: 10 } },
      { type: 'and', predicates: [{ type: 'hasFlag', flag: 'a', value: true }, { type: 'or', predicates: [{ type: 'hasFlag', flag: 'b', value: true }, { type: 'minCounter', counter: 'c', value: 5 }] }] },
      true,
    ],
  ])('%s', (_label, ledger, predicate, expected) => {
    expect(evaluatePredicate(predicate, createWorldState(ledger))).toBe(expected);
  });

  // Fails closed (owner's decision, 6 Nov 2026): a misspelled type in content keeps its
  // choice or stock locked instead of opening it to everyone.
  it('returns false for unknown predicate types', () => {
    const p = { type: 'unknown_type_xxx' } as unknown as Predicate;
    expect(evaluatePredicate(p, createWorldState())).toBe(false);
  });

  it('returns false when an unknown type sits under a not, an and or an or', () => {
    const state = createWorldState({ flags: { a: true } });
    const unknown = { type: 'hasFlagg', flag: 'a' } as unknown as Predicate;
    expect(evaluatePredicate({ type: 'not', predicate: unknown }, state)).toBe(false);
    expect(evaluatePredicate({ type: 'or', predicates: [{ type: 'hasFlag', flag: 'a' }, unknown] }, state)).toBe(false);
    expect(evaluatePredicate({ type: 'and', predicates: [unknown] }, state)).toBe(false);
  });
});
