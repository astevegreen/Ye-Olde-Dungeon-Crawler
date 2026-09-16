import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../quest/dungeonArc';
import { cotwManifest } from '../../content/cotw';

/**
 * Same seed, same floor (ARCHITECTURE.md §7.2).
 *
 * Floor generation is the codebase's heaviest consumer of simulation randomness: layout,
 * monster population, and loot placement. It used to call Math.random directly, so two
 * runs of one seed produced different floors. It now derives a seeded stream from the
 * floor seed.
 *
 * Note on scope: several other seeded call sites (dice rolls in parseAndRollDice, brute
 * and flee AI branches) are not reachable from shipped CotW content today — no CotW spell
 * uses dice notation — so this test cannot cover them. It asserts what content actually
 * exercises. The differing-seed case keeps the digest honest: if it ignored the
 * random-driven parts, both cases would pass.
 */
function floorDigest(seed: number, floorNumber = 3): string {
  const result = DungeonArc.generateFloor(floorNumber, seed, cotwManifest.quest, cotwManifest, 1.0);
  const monsters = result.map
    .getAllEntities()
    .map((e) => `${(e as { definitionId?: string }).definitionId ?? e.id}@${e.x},${e.y}`)
    .sort()
    .join('|');
  const loot = result.map
    .getAllGroundItems()
    .map((pile) => `${pile.x},${pile.y}:${pile.items.map((i) => i.name).sort().join('+')}`)
    .sort()
    .join('|');
  return `monsters=[${monsters}]||loot=[${loot}]`;
}

describe('Seeded determinism: floor generation', () => {
  it('produces an identical floor for two runs of the same seed', () => {
    expect(floorDigest(20260915)).toBe(floorDigest(20260915));
  });

  it('produces a different floor for a different seed (the digest is sensitive)', () => {
    expect(floorDigest(1)).not.toBe(floorDigest(999983));
  });

  it('stays stable across repeated generations of several seeds', () => {
    for (const seed of [7, 4242, 88888]) {
      expect(floorDigest(seed, 5)).toBe(floorDigest(seed, 5));
    }
  });
});
