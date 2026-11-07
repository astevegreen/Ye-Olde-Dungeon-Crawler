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

  // An array where a predicate goes is no predicate: the evaluator fails closed on it.
  it('names a predicate field holding an array', () => {
    expect(findUnknownPredicates({ endings: [{ when: [{ type: 'hasFlag', flag: 'a' }] }] }, 'pack')).toEqual(['pack.endings[0].when']);
  });

  // A shop's stock is built by its `initialInventory()` factory, so its items' predicates are on
  // no object the manifest holds; an unknown one would lock that stock for good in play.
  it("names an unknown predicate on a shop's stock", () => {
    const stock = () => [
      { id: 'torch', predicate: { type: 'hasFlag', flag: 'dark' } },
      { id: 'broth', predicate: { type: 'hasFlagg', flag: 'lit' } },
    ];
    const content = { town: { npcs: [{ merchantConfig: { id: 'olaf', initialInventory: stock, predicate: { type: 'hasFlag', flag: 'open' } } }] } };
    expect(findUnknownPredicates(content, 'pack')).toEqual(['pack.town.npcs[0].merchantConfig.initialInventory()[1].predicate']);
  });
});
