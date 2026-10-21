import { describe, it, expect } from 'vitest';
import { SKALDIC_RUNESTONE_CHOICES, SKALDIC_RUNESTONE_LORE, SKALDIC_RUNESTONE_TILES } from '../runestones';

// The runestones tell of forgings; none teaches a spell, and there is no journal (N28, Q19).
const allText = (): string[] => [
  ...SKALDIC_RUNESTONE_TILES.map((t) => t.description ?? ''),
  ...Object.values(SKALDIC_RUNESTONE_CHOICES).flatMap((c) => [
    c.description,
    ...c.options.flatMap((o) => [o.label, o.description ?? '']),
    ...(c.resolvedStates ?? []).map((r) => r.message),
  ]),
  ...SKALDIC_RUNESTONE_LORE.map((l) => l.lore),
];

describe('runestone text', () => {
  it('names no journal', () => {
    expect(allText().filter((t) => /journal/i.test(t))).toEqual([]);
  });

  it('names none of the retired fused spells; a stone tells of a forge', () => {
    const fused = /thunder maul|hagalaz hail|steam lance|rime shard|surtr’s brand/i;
    expect(allText().filter((t) => fused.test(t))).toEqual([]);
  });

  it('names Hammer-Throw, not the retired Lightning Bolt, and keeps every forge pair', () => {
    expect(SKALDIC_RUNESTONE_LORE.filter((l) => /lightning bolt/i.test(l.lore)).map((l) => l.flag)).toEqual([]);
    for (const n of [3, 5, 6]) expect(SKALDIC_RUNESTONE_LORE[n - 1].lore).toContain('Hammer-Throw');
    expect(SKALDIC_RUNESTONE_LORE.map((l) => l.forgePair)).toEqual([
      undefined,
      ['cold', 'fire'],
      ['fire', 'lightning'],
      ['arcane', 'cold'],
      ['cold', 'lightning'],
      ['lightning', 'physical'],
    ]);
  });
});
