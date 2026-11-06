import { describe, it, expect } from 'vitest';
import { findUnknownPredicates, isKnownPredicate } from '../predicateValidation';

describe('predicate validation', () => {
  it.each([
    [{ type: 'hasFlag', flag: 'a' }, true],
    [{ type: 'minCounter', counter: 'c', value: 2 }, true],
    [{ type: 'not', predicate: { type: 'maxFaction', faction: 'f', value: 1 } }, true],
    [{ type: 'and', predicates: [{ type: 'hasFlag', flag: 'a' }, { type: 'or', predicates: [] }] }, true],
    [{ type: 'hasFlagg', flag: 'a' }, false],
    [{ type: 'not', predicate: { type: 'nope' } }, false],
    [{ type: 'or', predicates: [{ type: 'hasFlag', flag: 'a' }, { type: 'nope' }] }, false],
    [{ type: 'and' }, false],
    [{ flag: 'a' }, false],
  ])('%j is known: %s', (predicate, known) => {
    expect(isKnownPredicate(predicate)).toBe(known);
  });

  it('names the path of every unknown predicate under a predicate or when field', () => {
    const content = {
      choices: [
        { id: 'ok', predicate: { type: 'hasFlag', flag: 'a' } },
        { id: 'bad', predicate: { type: 'hasflag', flag: 'a' }, options: [{ when: { type: 'minCountr', counter: 'c', value: 1 } }] },
      ],
      perks: { brave: { when: { type: 'not', predicate: { type: 'hasFlag', flag: 'b' } } } },
      notAPredicate: { when: 'onHit' },
    };

    expect(findUnknownPredicates(content, 'pack')).toEqual(['pack.choices[1].predicate', 'pack.choices[1].options[0].when']);
  });
});
