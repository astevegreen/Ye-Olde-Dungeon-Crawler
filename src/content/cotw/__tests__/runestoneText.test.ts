import { describe, it, expect } from 'vitest';
import { SKALDIC_RUNESTONE_CHOICES, SKALDIC_RUNESTONE_LORE, SKALDIC_RUNESTONE_TILES } from '../runestones';

// The runestones tell of fusions; none teaches a spell, and there is no journal (N28, Q19).
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

  it('never says a stone teaches or masters a fused spell; the fusion is forged at the altar', () => {
    const fusion = /thunder maul|hagalaz hail|steam lance|rime shard|surtr/i;
    const learns = /\b(teach\w*|taught|master\w*|embrace)\b/i;
    expect(allText().filter((t) => fusion.test(t) && learns.test(t))).toEqual([]);
  });
});
