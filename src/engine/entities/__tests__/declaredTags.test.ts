import { describe, it, expect } from 'vitest';
import { Monster } from '../monster';

const make = (definitionId: string, tags?: string[]) =>
  new Monster({ id: definitionId, name: definitionId, position: { x: 0, y: 0 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 }, definitionId, tags });

// A monster answers to the tags its definition declares, never to substrings of its ID.
describe('Entity.hasTag', () => {
  it('does not guess tags from the definition ID', () => {
    expect(make('giant_rat').hasTag('giant')).toBe(false);
    expect(make('skeleton_archer').hasTag('undead')).toBe(false);
  });

  it('answers to declared tags', () => {
    expect(make('fire_giant', ['fire_giant', 'giant']).hasTag('giant')).toBe(true);
    expect(make('bone_walker', ['undead']).hasTag('UNDEAD')).toBe(true);
  });
});
