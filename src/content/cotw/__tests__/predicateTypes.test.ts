import { describe, it, expect } from 'vitest';
import { findUnknownPredicates } from '../../../engine/predicates/predicateValidation';
import { cotwManifest } from '../index';
import { fixtureManifest } from '../../../../tests/fixtures/fixture-pack';

// An unknown predicate type fails closed in play (it locks its choice or stock), so a
// misspelled one must fail here first, in every pack.
describe('content predicates', () => {
  it.each([
    ['cotw', cotwManifest],
    ['fixture pack', fixtureManifest],
  ])('the %s pack uses only predicate types the engine knows', (_name, manifest) => {
    expect(findUnknownPredicates(manifest)).toEqual([]);
  });
});
