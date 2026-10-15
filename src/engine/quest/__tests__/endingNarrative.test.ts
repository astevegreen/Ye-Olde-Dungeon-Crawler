import { describe, expect, it } from 'vitest';
import { endingNarrative } from '../endingNarrative';
import { createWorldState, setFlag } from '../../state/worldState';
import type { EndingDefinition } from '../../types/manifest';

const ending: EndingDefinition = {
  id: 'test',
  victoryDialogue: '',
  victoryEpitaph: '',
  narrative: ['one', 'two', 'three'],
  conditionalNarrative: [
    { when: { type: 'hasFlag', flag: 'a' }, before: 2, text: 'a before three' },
    { when: { type: 'hasFlag', flag: 'b' }, text: 'b at the end' },
    { when: { type: 'hasFlag', flag: 'c' }, before: 0, text: 'c first' },
  ],
};

describe('endingNarrative', () => {
  it('tells only the base narrative when no condition holds', () => {
    expect(endingNarrative(ending, createWorldState())).toEqual(['one', 'two', 'three']);
  });

  it('places each paragraph whose condition holds before the one it names, or at the end', () => {
    const ws = createWorldState();
    setFlag(ws, 'a', true);
    setFlag(ws, 'b', true);
    setFlag(ws, 'c', true);
    expect(endingNarrative(ending, ws)).toEqual(['c first', 'one', 'two', 'a before three', 'three', 'b at the end']);
  });

  it('works for an ending with no conditional paragraphs', () => {
    expect(endingNarrative({ ...ending, conditionalNarrative: undefined }, createWorldState())).toEqual(['one', 'two', 'three']);
  });
});
