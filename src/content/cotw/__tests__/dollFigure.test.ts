import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';

/** Tracker 4.7: the paperdoll's figure is pack art, keyed like every UI icon. */
describe('cotw paperdoll figure', () => {
  it('draws ui~doll', () => {
    expect(typeof cotwManifest.spriteRecipes?.['ui~doll']).toBe('function');
  });
});
