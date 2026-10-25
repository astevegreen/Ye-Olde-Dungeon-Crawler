import { describe, expect, it } from 'vitest';
import { parseRunsJsonl, soakReport, type ReportSummary } from '../lib/soak-report';

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

  describe('energy debt per floor', () => {
    const spent = (actions: number, debt: number, debtEnergy: number) => ({ actions, debt, debtEnergy });
    const withEnergy = (seed: number, energy: NonNullable<ReportSummary['magic']>['energy']) =>
      run(seed, 'caster', 'first', { magic: { ...run(seed, 'caster', 'first').magic!, energy } });
    const energyReport = soakReport(
      [
        withEnergy(1, {
          '1': { hero: spent(100, 10, 500), foes: spent(200, 50, 2000) },
          '2': { hero: spent(0, 0, 0), foes: spent(0, 0, 0) },
        }),
        withEnergy(2, {
          '1': { hero: spent(300, 30, 1500), foes: spent(200, 0, 0) },
          '2': { hero: spent(0, 0, 0), foes: spent(0, 0, 0) },
        }),
      ],
      { coldStages: [300] }
    );
    // The energy table: its header row down to the first line that is no table row.
    const energyTable = (text: string): string[] => {
      const lines = text.split('\n');
      const start = lines.findIndex((l) => l.startsWith('| floor | runs | hero actions |'));
      if (start < 0) return [];
      const end = lines.findIndex((l, i) => i > start && !l.startsWith('|'));
      return lines.slice(start, end < 0 ? undefined : end);
    };

    it('sums the actions, shares the debt, and takes the median debt energy over the runs', () => {
      // Hero: 40 of 400 in debt, median of 500 and 1500; foes: 50 of 400, median of 2000 and 0.
      expect(energyTable(energyReport)).toContain('| 1 | 2 | 400 | 10% | 1000 | 400 | 13% | 1000 |');
    });

    it('leaves out a floor with no actions', () => {
      const rows = energyTable(energyReport);
      expect(rows).toHaveLength(3);
      expect(rows.some((l) => l.startsWith('| 2 |'))).toBe(false);
    });

    it('says an older soak predates the counter', () => {
      expect(report).toContain('No energy counts: the soak predates the energy counter.');
      expect(energyTable(report)).toEqual([]);
      expect(energyReport).not.toContain('predates the energy counter');
    });
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

  describe('how the soak stopped (runs.jsonl)', () => {
    const seedLine = (seed: number, stoppedBy?: string) => JSON.stringify({ seed, status: 'passed', ...(stoppedBy ? { stoppedBy } : {}), timestamp: `t${seed}` });
    const runnerLine = (stoppedBy: string, unfinishedSeeds: number[], error?: string) =>
      JSON.stringify({ runner: true, stoppedBy, unfinishedSeeds, timestamp: `stop-${stoppedBy}`, ...(error ? { error } : {}) });
    const withRuns = (folder: string, lines: string[]) => soakReport([run(1, 'warrior', 'first')], { coldStages: [300], runs: [{ folder, lines: parseRunsJsonl(lines.join('\n')) }] });

    it('tables runs by how they stopped, old lines as unknown, and skips a half-written line', () => {
      const text = withRuns('player', [seedLine(1), seedLine(2, 'exit'), seedLine(3, 'exit'), seedLine(4, 'signal:SIGTERM'), seedLine(5, 'no-summary'), '{"seed": 6, "stopp', runnerLine('done', [])]);
      expect(text).toContain('## How the soak stopped');
      expect(text).toContain('| player | exit | 2 |');
      expect(text).toContain('| player | signal:SIGTERM | 1 |');
      expect(text).toContain('| player | no-summary | 1 |');
      expect(text).toContain('| player | unknown | 1 |');
      expect(text).toContain('| player | stop-done | done | 5 | 0 |  |');
      expect(text).not.toContain('without a trace');
    });

    it("shows each of the runner's stops: the cutoff, a signal, a crash", () => {
      const text = withRuns('player', [
        seedLine(1, 'exit'),
        runnerLine('until', [2, 3, 4, 5, 6, 7]),
        seedLine(2, 'error'),
        runnerLine('signal:SIGHUP', [3]),
        runnerLine('uncaughtException', [3], 'Error: a | b\n    at soak.mjs:1'),
      ]);
      expect(text).toContain('| player | stop-until | until | 1 | 6 (2, 3, 4, 5, 6, ...) |  |');
      expect(text).toContain('| player | stop-signal:SIGHUP | signal:SIGHUP | 1 | 1 (3) |  |');
      expect(text).toContain('| player | stop-uncaughtException | uncaughtException | 0 | 1 (3) | Error: a \\| b |');
    });

    it('says a runner with seed lines but no stop line stopped without a trace', () => {
      const text = withRuns('player-floor12', [seedLine(1, 'exit'), runnerLine('done', []), seedLine(2, 'exit'), seedLine(3, 'error')]);
      expect(text).toContain('| player-floor12 | t3 | runner stopped without a trace (hard kill or crash) | 2 | - |  |');
    });

    it('does not blame a runner for old lines that predate stop records', () => {
      expect(withRuns('player', [seedLine(1), seedLine(2)])).not.toContain('without a trace');
    });

    it('leaves the section out when no folder has a runs.jsonl', () => {
      expect(report).not.toContain('How the soak stopped');
    });
  });

  it('lists the NPCs each run met in one line, or none (K1)', () => {
    const met = soakReport(
      [
        run(2, 'caster', 'first', { folder: 'C:\\soak\\player-floor13', npcsMet: { hub_two: { floor: 26, option: 'spare' }, ivalda: { floor: 13, option: 'left' } } }),
        run(1, 'warrior', 'first', { folder: '/soak/player-floor13' }),
        run(3, 'caster', 'first', { folder: '/soak/player-floor13', partial: true, npcsMet: { ivalda: { floor: 13, option: 'left' } } }),
      ],
      { coldStages: [300] }
    );
    expect(met).toContain('## NPCs met');
    expect(met).toContain('- player-floor13 seed 1: NPCs met: none');
    expect(met).toContain('- player-floor13 seed 2: NPCs met: ivalda (floor 13, left), hub_two (floor 26, spare)');
    expect(met).not.toContain('seed 3: NPCs met');
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
