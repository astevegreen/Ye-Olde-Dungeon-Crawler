import { describe, expect, it } from 'vitest';
import { soakReport, type ReportSummary } from '../lib/soak-report';

/** The P-36 soak report (scripts/soak-report.ts) answers the owner's five questions from summaries. */

const floor = (casts: Record<string, number>, spellDamage: number, meleeDamage: number) => ({
  casts,
  failed: { slow: 1 },
  damage: { spell: spellDamage, melee: meleeDamage, other: 0, world: 0 },
  kills: { spell: 1, melee: 1, other: 0, world: 0 },
  spellDamage: { magic_arrow: spellDamage },
  spellKills: { magic_arrow: 1 },
});

const run = (seed: number, build: string, policy: string, over: Partial<ReportSummary> = {}): ReportSummary => ({
  seed,
  startFloor: 0,
  sha: 'abc1234',
  partial: false,
  endedBy: 'death',
  deepestFloor: 2,
  findings: { 'bug|magic: cast of slow succeeded without spending its turn|spellPipeline.ts': 2 },
  bot: { deathCause: 'surrounded' },
  magic: {
    floors: { '1': floor({ magic_arrow: 4 }, 30, 10), '2': floor({ magic_arrow: 2 }, 10, 30) },
    learned: [{ spellId: 'slow', via: 'stone', floor: 2 }],
    spellsKnown: ['magic_arrow', 'slow'],
    stones: { '4': 'missed' },
    altars: { '4:galdr_altar_tyr': 'reached' },
    catalog: { magic_arrow: { type: 'damage', stoneFrom: null }, slow: { type: 'control', stoneFrom: 1 }, fireball: { type: 'damage', stoneFrom: 26 } },
  },
  pace: {
    '0': { turns: 100, actions: 120, wallMs: 60000, visits: 1, firstTurn: 0, spellsOnEntry: 1 },
    '1': { turns: 400, actions: 300, wallMs: 60000, visits: 1, firstTurn: 100, spellsOnEntry: 1 },
    '2': { turns: 600, actions: 500, wallMs: 120000, visits: 1, firstTurn: 500, spellsOnEntry: 2 },
  },
  belowTurns: 1000,
  hero: { build, runestonePolicy: policy, level: 3, runestones: policy === 'leave' ? { skaldic_runestone_1: 'left' } : {} },
  ...over,
});

const report = soakReport(
  [run(1, 'warrior', 'first'), run(2, 'caster', 'leave', { deepestFloor: 3 }), run(3, 'caster', 'leave', { partial: true })],
  { coldStages: [300, 3000] }
);

describe('soak report', () => {
  it('counts finished runs only', () => {
    expect(report).toContain('2 finished runs (1 still partial), sha abc1234');
  });

  it('splits damage by source per floor, and depth by build', () => {
    expect(report).toContain('| 1 | 2 | 75% | 25% | 0% | 0% |');
    expect(report).toMatch(/\| caster \| 0 \| 1 \| 3 \|/);
  });

  it('marks a spell nobody knew, and counts failed casts and kills per spell', () => {
    expect(report).toMatch(/\| fireball \| damage \| 26 \| 0 \|.*never known \|/);
    expect(report).toMatch(/\| magic_arrow \| damage \| - \| 2 \| 0 \| 12 \| 0 \| 80 \| 4 \|/);
    expect(report).toMatch(/\| slow \| control \| 1 \| 2 \| 2 \| 0 \| 4 \|.*never cast \|/);
  });

  it("puts a harmless spell's damage down to what its neighbours lent it", () => {
    const slowFloor = {
      ...floor({ slow: 3 }, 12, 0),
      spellDamage: { slow: 12 },
      spellKills: {},
      lent: { slow: { Knockback: 3, Chill: 2 } },
    };
    const lentRun = run(4, 'caster', 'first', {
      magic: {
        ...run(4, 'caster', 'first').magic!,
        floors: { '1': slowFloor },
        catalog: { slow: { type: 'control', stoneFrom: 1, ownDamage: false } },
      },
    });
    expect(soakReport([lentRun], { coldStages: [300] })).toMatch(
      /\| slow \| control \| 1 \| 1 \| 1 \| 3 \| 1 \| 12 \| 0 \| Knockback 3, Chill 2 \| all its damage borrowed \|/
    );
  });

  it('shows the learning routes, and stones and altars never used', () => {
    expect(report).toContain('Spells learned, by route: stone 2.');
    expect(report).toContain('| 4 | 0 | 0 | 2 |');
    expect(report).toContain('| 4:galdr_altar_tyr | 0 | 2 | 0 |');
  });

  it('paces each floor, and sums the turns below town on reaching it', () => {
    expect(report).toContain('| 2 | 2 | 600 | 600 | 500 | 2 |');
    // Floor 2 is reached after floor 1's 400 turns below: past the first cold stage (300).
    expect(report).toContain('| 2 | 2 | 400 | 400 | 400 | 1 |');
  });

  it('splits outcome by Runestone policy, and ranks magic findings by seeds', () => {
    expect(report).toMatch(/\| leave \| 0 \| 1 \| 1 \| 3 \|/);
    expect(report).toContain('skaldic_runestone_1=left 1');
    expect(report).toContain('| bug: magic: cast of slow succeeded without spending its turn | 2 | 4 |');
  });

  it('counts the same seed in two folders as two affected runs', () => {
    const twoFolders = soakReport([run(3, 'caster', 'first', { folder: 'player' }), run(3, 'caster', 'first', { folder: 'player-floor12' })], {
      coldStages: [300],
    });
    expect(twoFolders).toContain('| bug: magic: cast of slow succeeded without spending its turn | 2 | 4 |');
  });

  it('counts the same seed in one folder, or with no folder, once', () => {
    const oneFolder = soakReport([run(3, 'caster', 'first', { folder: 'player' }), run(3, 'caster', 'first', { folder: 'player' })], {
      coldStages: [300],
    });
    expect(oneFolder).toContain('| bug: magic: cast of slow succeeded without spending its turn | 1 | 4 |');
    const noFolder = soakReport([run(3, 'caster', 'first'), run(3, 'caster', 'first')], { coldStages: [300] });
    expect(noFolder).toContain('| bug: magic: cast of slow succeeded without spending its turn | 1 | 4 |');
  });
});
