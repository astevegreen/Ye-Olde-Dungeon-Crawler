/** Types for `soak-runs.mjs`, which `scripts/soak.mjs` runs under plain node. */

export type SeedStoppedBy = 'exit' | 'error' | 'no-summary' | `signal:${string}`;

export function seedStoppedBy(end: { code: number; signal: string | null; hasSummary: boolean }): SeedStoppedBy;

export interface SeedSummary {
  endedBy?: string;
  turnsPlayed?: number;
  deepestFloor?: number;
  causeOfDeath?: string;
  sha?: string;
  bot?: { deathCause?: string };
  hero?: { build?: string };
  findingCounts?: Record<string, number>;
}

export interface SeedRecord {
  seed: number;
  lens: string;
  opening: string;
  exitCode: number;
  signal: string | null;
  stoppedBy: SeedStoppedBy;
  status: 'passed' | 'failed';
  durationMs: number;
  endedBy: string | null;
  turnsPlayed: number | null;
  deepestFloor: number | null;
  causeOfDeath: string | null;
  sha: string | null;
  deathCause: string | null;
  build: string | null;
  findingCounts: Record<string, number>;
  timestamp: string;
}

export function seedRecord(run: {
  seed: number;
  lens: string;
  opening: string;
  code: number | null;
  signal: string | null;
  durationMs: number;
  summary: SeedSummary | null;
  timestamp: string;
}): SeedRecord;

export function unfinishedSeeds(fromSeed: number, count: number, finished: Set<number>): number[];

export interface RunnerRecord {
  runner: true;
  stoppedBy: string;
  unfinishedSeeds: number[];
  timestamp: string;
  error?: string;
}

export function runnerRecord(stop: { stoppedBy: string; unfinishedSeeds: number[]; timestamp: string; error?: string }): RunnerRecord;
