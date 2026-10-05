import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';

/** Tracker 4.7: the paperdoll's figure is pack art, keyed like every UI icon. */
describe('cotw paperdoll figure', () => {
  it('draws ui~doll', () => {
    expect(typeof cotwManifest.spriteRecipes?.['ui~doll']).toBe('function');
  });
});

/** Tracker 4.10: the descent's tree is pack art too. */
describe('cotw descent art', () => {
  it('draws ui~descent', () => {
    expect(typeof cotwManifest.spriteRecipes?.['ui~descent']).toBe('function');
  });
});
