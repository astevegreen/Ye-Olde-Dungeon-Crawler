import { describe, it, expect } from 'vitest';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import { createWorldState } from '../state/worldState';
import type { Predicate } from '../predicates/types';

describe('PredicateEvaluator', () => {
  it('returns true when predicate is undefined', () => {
    const state = createWorldState();
    expect(evaluatePredicate(undefined, state)).toBe(true);
  });

  describe('hasFlag', () => {
    it('evaluates to true when flag matches expected truthy value', () => {
      const state = createWorldState({ flags: { 'hero_found': true } });
      const p: Predicate = { type: 'hasFlag', flag: 'hero_found', value: true };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates to true when flag matches expected falsy value', () => {
      const state = createWorldState({ flags: { 'hero_found': false } });
      const p: Predicate = { type: 'hasFlag', flag: 'hero_found', value: false };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('defaults expected value to true if not provided', () => {
      const state = createWorldState({ flags: { 'hero_found': true } });
      const p: Predicate = { type: 'hasFlag', flag: 'hero_found' };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates to false when flag does not match expected value', () => {
      const state = createWorldState({ flags: { 'hero_found': false } });
      const p: Predicate = { type: 'hasFlag', flag: 'hero_found', value: true };
      expect(evaluatePredicate(p, state)).toBe(false);
    });
  });

  describe('minCounter / maxCounter', () => {
    it('evaluates minCounter to true when counter is greater or equal', () => {
      const state = createWorldState({ counters: { 'gold': 50 } });
      const p: Predicate = { type: 'minCounter', counter: 'gold', value: 50 };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates minCounter to false when counter is less', () => {
      const state = createWorldState({ counters: { 'gold': 49 } });
      const p: Predicate = { type: 'minCounter', counter: 'gold', value: 50 };
      expect(evaluatePredicate(p, state)).toBe(false);
    });

    it('evaluates maxCounter to true when counter is less or equal', () => {
      const state = createWorldState({ counters: { 'gold': 50 } });
      const p: Predicate = { type: 'maxCounter', counter: 'gold', value: 50 };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates maxCounter to false when counter is greater', () => {
      const state = createWorldState({ counters: { 'gold': 51 } });
      const p: Predicate = { type: 'maxCounter', counter: 'gold', value: 50 };
      expect(evaluatePredicate(p, state)).toBe(false);
    });
  });

  describe('minFaction / maxFaction', () => {
    it('evaluates minFaction to true when faction is greater or equal', () => {
      const state = createWorldState({ factions: { 'townsfolk': 10 } });
      const p: Predicate = { type: 'minFaction', faction: 'townsfolk', value: 5 };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates minFaction to false when faction is less', () => {
      const state = createWorldState({ factions: { 'townsfolk': 4 } });
      const p: Predicate = { type: 'minFaction', faction: 'townsfolk', value: 5 };
      expect(evaluatePredicate(p, state)).toBe(false);
    });

    it('evaluates maxFaction to true when faction is less or equal', () => {
      const state = createWorldState({ factions: { 'townsfolk': 5 } });
      const p: Predicate = { type: 'maxFaction', faction: 'townsfolk', value: 10 };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates maxFaction to false when faction is greater', () => {
      const state = createWorldState({ factions: { 'townsfolk': 11 } });
      const p: Predicate = { type: 'maxFaction', faction: 'townsfolk', value: 10 };
      expect(evaluatePredicate(p, state)).toBe(false);
    });
  });

  describe('Logical operators', () => {
    it('evaluates AND to true if all predicates are true', () => {
      const state = createWorldState({ flags: { a: true, b: true } });
      const p: Predicate = {
        type: 'and',
        predicates: [
          { type: 'hasFlag', flag: 'a', value: true },
          { type: 'hasFlag', flag: 'b', value: true }
        ]
      };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates AND to false if any predicate is false', () => {
      const state = createWorldState({ flags: { a: true, b: false } });
      const p: Predicate = {
        type: 'and',
        predicates: [
          { type: 'hasFlag', flag: 'a', value: true },
          { type: 'hasFlag', flag: 'b', value: true }
        ]
      };
      expect(evaluatePredicate(p, state)).toBe(false);
    });

    it('evaluates OR to true if any predicate is true', () => {
      const state = createWorldState({ flags: { a: true, b: false } });
      const p: Predicate = {
        type: 'or',
        predicates: [
          { type: 'hasFlag', flag: 'a', value: true },
          { type: 'hasFlag', flag: 'b', value: true }
        ]
      };
      expect(evaluatePredicate(p, state)).toBe(true);
    });

    it('evaluates OR to false if all predicates are false', () => {
      const state = createWorldState({ flags: { a: false, b: false } });
      const p: Predicate = {
        type: 'or',
        predicates: [
          { type: 'hasFlag', flag: 'a', value: true },
          { type: 'hasFlag', flag: 'b', value: true }
        ]
      };
      expect(evaluatePredicate(p, state)).toBe(false);
    });

    it('evaluates NOT correctly', () => {
      const state = createWorldState({ flags: { a: true } });
      const p: Predicate = {
        type: 'not',
        predicate: { type: 'hasFlag', flag: 'a', value: true }
      };
      expect(evaluatePredicate(p, state)).toBe(false);
      
      const p2: Predicate = {
        type: 'not',
        predicate: { type: 'hasFlag', flag: 'a', value: false }
      };
      expect(evaluatePredicate(p2, state)).toBe(true);
    });
    
    it('handles nested logical operators', () => {
      const state = createWorldState({ flags: { a: true, b: false }, counters: { c: 10 } });
      const p: Predicate = {
        type: 'and',
        predicates: [
          { type: 'hasFlag', flag: 'a', value: true },
          {
            type: 'or',
            predicates: [
              { type: 'hasFlag', flag: 'b', value: true },
              { type: 'minCounter', counter: 'c', value: 5 }
            ]
          }
        ]
      };
      expect(evaluatePredicate(p, state)).toBe(true);
    });
    
    it('returns true for unknown predicate types', () => {
      const state = createWorldState();
      const p = { type: 'unknown_type_xxx' } as unknown as Predicate;
      expect(evaluatePredicate(p, state)).toBe(true);
    });
  });
});
