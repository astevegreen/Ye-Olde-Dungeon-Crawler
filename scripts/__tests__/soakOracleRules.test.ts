import { describe, expect, it } from 'vitest';
import { adjacentRepeats, countFindings, diedAfterRaid } from '../../e2e/soak/oracleRules';

/** The soak's pure oracle rules (e2e/soak/oracleRules.ts); Vitest skips e2e/, so they are tested here. */

describe('diedAfterRaid', () => {
  const played = { isAlive: false, turn: 150, raidEndTurn: 100, raidEndedReason: 'warlocks slain', opening: 'play' as const, messages: ['A', 'B'] };

  it('reports a death under 200 turns after a played raid', () => {
    expect(diedAfterRaid(played)).toBe('died 50 turns after the raid: A | B');
  });

  it('says nothing for a living hero or a death 200 turns or more after the raid', () => {
    expect(diedAfterRaid({ ...played, isAlive: true })).toBeNull();
    expect(diedAfterRaid({ ...played, turn: 300 })).toBeNull();
  });

  it('says nothing before the raid has ended', () => {
    expect(diedAfterRaid({ ...played, raidEndTurn: null, raidEndedReason: undefined })).toBeNull();
  });

  it('says nothing when the raid was skipped, as in every deep start', () => {
    // A skipped opening sets raidEndTurn to the first turn seen, so an early death is no raid death.
    expect(diedAfterRaid({ ...played, opening: 'skip', raidEndedReason: 'skipped (triage)' })).toBeNull();
    expect(diedAfterRaid({ ...played, raidEndedReason: 'skipped (triage)' })).toBeNull();
    expect(diedAfterRaid({ ...played, opening: 'skip' })).toBeNull();
  });

  it('keeps only the last 20 log lines', () => {
    const messages = Array.from({ length: 25 }, (_, i) => `m${i}`);
    expect(diedAfterRaid({ ...played, messages })).toBe(`died 50 turns after the raid: ${messages.slice(-20).join(' | ')}`);
  });
});

describe('adjacentRepeats', () => {
  const bite = 'A bites you for 3.';

  it('finds a line shown on adjacent rows, with the length of the run', () => {
    expect(adjacentRepeats([bite, bite, bite])).toEqual([{ line: bite, rows: 3 }]);
  });

  it('treats a row with a count and one without as the same line', () => {
    expect(adjacentRepeats([`${bite} (×2)`, bite])).toEqual([{ line: bite, rows: 2 }]);
  });

  it('says nothing for a folded row followed by another line', () => {
    expect(adjacentRepeats([`${bite} (×4)`, 'B misses.'])).toEqual([]);
  });

  it('says nothing for lines that repeat on rows apart, as a melee of three turns shows', () => {
    expect(adjacentRepeats([bite, 'B misses.', bite, 'B misses.', bite, 'B misses.'])).toEqual([]);
  });

  it('says nothing for different lines or an empty strip', () => {
    expect(adjacentRepeats(['One.', 'Two.', 'Three.'])).toEqual([]);
    expect(adjacentRepeats([])).toEqual([]);
  });

  it('reports each run apart', () => {
    expect(adjacentRepeats(['One.', 'One.', 'Two.', 'Three.', 'Three. (×2)', 'Three.'])).toEqual([
      { line: 'One.', rows: 2 },
      { line: 'Three.', rows: 3 },
    ]);
  });
});

describe('countFindings', () => {
  it('counts untagged findings by category and tagged ones apart', () => {
    expect(
      countFindings([
        { category: 'ux' },
        { category: 'ux', tag: 'latency' },
        { category: 'bug' },
      ])
    ).toEqual({ bug: 1, softlock: 0, text: 0, ux: 1, tagged: 1 });
  });

  it('gives zeroes for a clean run', () => {
    expect(countFindings([])).toEqual({ bug: 0, softlock: 0, text: 0, ux: 0, tagged: 0 });
  });
});
