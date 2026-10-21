/**
 * The lines `scripts/soak.mjs` appends to `runs.jsonl`: one per seed, saying how its browser run
 * ended, and one when the runner itself stops, so a soak that dies early says why. Pure, so the
 * tests can cover each ending; read back by `scripts/lib/soak-report.ts`. Types: `soak-runs.d.mts`.
 */

/**
 * How one seed's run ended. A signal says more than a missing summary, and a missing summary
 * more than an exit code: the spec writes `summary.json` even when the run fails.
 */
export function seedStoppedBy({ code, signal, hasSummary }) {
  if (signal) return `signal:${signal}`;
  if (!hasSummary) return 'no-summary';
  return code === 0 ? 'exit' : 'error';
}

/** The seed's line in `runs.jsonl`, from the child's `close` event and its `summary.json`. */
export function seedRecord({ seed, lens, opening, code, signal, durationMs, summary, timestamp }) {
  const exitCode = code ?? (signal ? 1 : 0);
  return {
    seed,
    lens,
    opening,
    exitCode,
    signal: signal ?? null,
    stoppedBy: seedStoppedBy({ code: exitCode, signal, hasSummary: summary !== null }),
    status: exitCode === 0 ? 'passed' : 'failed',
    durationMs,
    endedBy: summary?.endedBy ?? null,
    turnsPlayed: summary?.turnsPlayed ?? null,
    deepestFloor: summary?.deepestFloor ?? null,
    causeOfDeath: summary?.causeOfDeath ?? null,
    sha: summary?.sha ?? null,
    deathCause: summary?.bot?.deathCause ?? null,
    build: summary?.hero?.build ?? null,
    findingCounts: summary?.findingCounts ?? {},
    timestamp,
  };
}

/** The scheduled seeds that have no line yet: still running, or never started. */
export function unfinishedSeeds(fromSeed, count, finished) {
  const out = [];
  for (let seed = fromSeed; seed < fromSeed + count; seed++) if (!finished.has(seed)) out.push(seed);
  return out;
}

/**
 * The runner's own last line. `stoppedBy`: `done`, `until`, `signal:<NAME>`, `uncaughtException`
 * or `unhandledRejection`; `error` carries a crash's message. A hard kill writes nothing.
 */
export function runnerRecord({ stoppedBy, unfinishedSeeds: seeds, timestamp, error }) {
  return { runner: true, stoppedBy, unfinishedSeeds: seeds, timestamp, ...(error ? { error } : {}) };
}
