import { describe, expect, it } from 'vitest';
import { runnerRecord, seedRecord, seedStoppedBy, unfinishedSeeds } from '../lib/soak-runs.mjs';

/** scripts/soak.mjs's lines in runs.jsonl say how each seed's run, and the runner, stopped. */

const base = { seed: 7, lens: 'player', opening: 'play', durationMs: 1000, timestamp: '2026-10-21T10:00:00.000Z' };
const summary = { endedBy: 'death', turnsPlayed: 900, deepestFloor: 4, sha: 'abc1234', bot: { deathCause: 'surrounded' }, hero: { build: 'caster' } };

describe('soak runs.jsonl records', () => {
  it('a seed that exits 0 with a summary stopped by "exit"', () => {
    const r = seedRecord({ ...base, code: 0, signal: null, summary });
    expect(r).toMatchObject({ seed: 7, exitCode: 0, signal: null, stoppedBy: 'exit', status: 'passed', deepestFloor: 4, deathCause: 'surrounded', build: 'caster' });
  });

  it('a seed that exits non-zero with a summary stopped by "error"', () => {
    expect(seedRecord({ ...base, code: 1, signal: null, summary })).toMatchObject({ exitCode: 1, signal: null, stoppedBy: 'error', status: 'failed' });
  });

  it('a seed killed by a signal keeps the signal name', () => {
    expect(seedRecord({ ...base, code: null, signal: 'SIGTERM', summary: null })).toMatchObject({
      exitCode: 1,
      signal: 'SIGTERM',
      stoppedBy: 'signal:SIGTERM',
      status: 'failed',
    });
  });

  it('a seed that ends with no summary.json stopped by "no-summary", whatever its code', () => {
    expect(seedRecord({ ...base, code: 0, signal: null, summary: null }).stoppedBy).toBe('no-summary');
    expect(seedStoppedBy({ code: 3, signal: null, hasSummary: false })).toBe('no-summary');
  });

  it('lists the seeds still running or never started', () => {
    expect(unfinishedSeeds(5, 4, new Set([5, 7]))).toEqual([6, 8]);
    expect(unfinishedSeeds(5, 2, new Set([5, 6]))).toEqual([]);
  });

  it("writes the runner's own stop, with a crash's error only when there is one", () => {
    const at = '2026-10-21T11:00:00.000Z';
    for (const stoppedBy of ['done', 'until', 'signal:SIGINT', 'signal:SIGHUP', 'signal:SIGBREAK']) {
      expect(runnerRecord({ stoppedBy, unfinishedSeeds: [3], timestamp: at })).toEqual({ runner: true, stoppedBy, unfinishedSeeds: [3], timestamp: at });
    }
    expect(runnerRecord({ stoppedBy: 'uncaughtException', unfinishedSeeds: [], timestamp: at, error: 'Error: boom' })).toEqual({
      runner: true,
      stoppedBy: 'uncaughtException',
      unfinishedSeeds: [],
      timestamp: at,
      error: 'Error: boom',
    });
  });
});
