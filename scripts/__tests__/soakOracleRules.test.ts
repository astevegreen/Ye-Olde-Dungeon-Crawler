import { describe, expect, it } from 'vitest';
import { countFindings, diedAfterRaid } from '../../e2e/soak/oracleRules';

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
