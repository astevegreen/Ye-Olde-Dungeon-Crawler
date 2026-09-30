import { describe, it, expect } from 'vitest';
import { getCurrentObjective, type ObjectiveStateView } from '../objectives';
import type { ObjectiveDefinition } from '../../types/manifest';

const OBJECTIVES: ObjectiveDefinition[] = [
  { id: 'descend', text: 'Go down.', doneWhenCounterAtLeast: { counter: 'deepest', value: 1 } },
  { id: 'find', text: 'Find the forge.', doneWhenAnyFlag: ['forge_found', 'forge_skipped'] },
  { id: 'boss', text: 'Face the wyrm.', availableWhenFlag: 'warned', doneWhenAnyFlag: ['wyrm_slain'] },
];

function view(flags: string[] = [], counters: Record<string, number> = {}, objectives = OBJECTIVES): ObjectiveStateView {
  return {
    manifest: { objectives },
    getWorldFlag: (f) => flags.includes(f),
    getWorldCounter: (c) => counters[c] ?? 0,
  };
}

describe('getCurrentObjective', () => {
  it('starts with the first objective', () => {
    expect(getCurrentObjective(view())?.id).toBe('descend');
  });

  it('moves on when a counter or any listed flag completes one', () => {
    expect(getCurrentObjective(view([], { deepest: 3 }))?.id).toBe('find');
    expect(getCurrentObjective(view(['forge_skipped'], { deepest: 3 }))).toBeUndefined();
  });

  it('skips an objective until it becomes available', () => {
    expect(getCurrentObjective(view(['forge_found', 'warned'], { deepest: 3 }))?.id).toBe('boss');
  });

  it('is undefined for a pack with no objectives', () => {
    const none: ObjectiveStateView = { manifest: {}, getWorldFlag: () => false, getWorldCounter: () => 0 };
    expect(getCurrentObjective(none)).toBeUndefined();
  });
});
