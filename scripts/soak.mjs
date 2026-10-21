#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { constants } from 'node:os';
import { seedRecord, runnerRecord, unfinishedSeeds } from './lib/soak-runs.mjs';

function printHelp() {
  console.log(`
Usage: node scripts/soak.mjs [options]

Options:
  --lens <lens>        chaos | player | ui-sweep (default: chaos)
  --from <seed>        Starting seed integer (default: 1)
  --count <count>      Number of seeds to run (default: 100)
  --actions <actions>  Maximum actions per run (default: 10000 for player, 1500 otherwise)
  --opening <opening>  play | skip (default: even play / odd skip for chaos, play for player)
  --until <HH:MM>      Wall-clock cutoff time (e.g. 06:30)
  --project <browser>  Playwright browser project (default: chromium)
  --workers <workers>  Seeds run at once, each in its own browser (default: 1)
  --start-floor <n>    Deep-floor start: outfit the hero for floor n and drop it there (default: 0, off)
  --start-level <n>    The level that outfit aims at (default: 1 + 0.7 x floor)
  --build <name>       player: warrior | caster | hybrid for every seed (default: by seed, n % 3)
  --runestones <p>     player: first | second | leave for every seed (default: by seed, floor(n / 3) % 3)
  --help               Show this help message
`);
}

const args = process.argv.slice(2);
let lens = 'chaos';
let fromSeed = 1;
let count = 100;
let actions = null;
let openingOverride = null;
let untilStr = null;
let project = 'chromium';
let workers = 1;
let startFloor = 0;
let startLevel = 0;
let build = null;
let runestones = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '--lens' && i + 1 < args.length) {
    lens = args[++i];
  } else if (arg === '--from' && i + 1 < args.length) {
    fromSeed = parseInt(args[++i], 10);
  } else if (arg === '--count' && i + 1 < args.length) {
    count = parseInt(args[++i], 10);
  } else if (arg === '--actions' && i + 1 < args.length) {
    actions = parseInt(args[++i], 10);
  } else if (arg === '--opening' && i + 1 < args.length) {
    openingOverride = args[++i];
  } else if (arg === '--until' && i + 1 < args.length) {
    untilStr = args[++i];
  } else if (arg === '--project' && i + 1 < args.length) {
    project = args[++i];
  } else if (arg === '--workers' && i + 1 < args.length) {
    workers = parseInt(args[++i], 10);
  } else if (arg === '--start-floor' && i + 1 < args.length) {
    startFloor = parseInt(args[++i], 10);
  } else if (arg === '--start-level' && i + 1 < args.length) {
    startLevel = parseInt(args[++i], 10);
  } else if (arg === '--build' && i + 1 < args.length) {
    build = args[++i];
  } else if (arg === '--runestones' && i + 1 < args.length) {
    runestones = args[++i];
  }
}

// The player lens plays until death in most runs; 1500 actions ended it on floor 2-4.
actions ??= lens === 'player' ? 10000 : 1500;

let cutoffMs = null;
if (untilStr) {
  const [h, m] = untilStr.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  cutoffMs = target.getTime();
  console.log(`[soak runner] Cutoff active: will stop at ${new Date(cutoffMs).toLocaleString()}`);
}

// A deep start keeps its own folder: its seeds would otherwise overwrite a run from town.
const soakOutDir = resolve(process.cwd(), '.prompts', 'soak', startFloor > 0 ? `${lens}-floor${startFloor}` : lens);
mkdirSync(soakOutDir, { recursive: true });

const runsLogPath = join(soakOutDir, 'runs.jsonl');
const testResultsDir = join(soakOutDir, 'test-results');

// The runner's own stop goes in runs.jsonl too: a soak that ends with no runner line was killed
// hard (`taskkill /F`, a closed machine), which nothing can catch.
const finished = new Set();
let runnerStopped = false;
function recordRunnerStop(stoppedBy, error) {
  if (runnerStopped) return;
  runnerStopped = true;
  const line = runnerRecord({ stoppedBy, unfinishedSeeds: unfinishedSeeds(fromSeed, count, finished), timestamp: new Date().toISOString(), error });
  appendFileSync(runsLogPath, JSON.stringify(line) + '\n');
}
// SIGHUP is a closed console window on Windows, SIGBREAK its Ctrl+Break.
for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(name, () => {
    console.log(`\n[soak runner] Stopped by ${name}.`);
    recordRunnerStop(`signal:${name}`);
    process.exit(128 + (constants.signals[name] ?? 0));
  });
}
for (const kind of ['uncaughtException', 'unhandledRejection']) {
  process.on(kind, (err) => {
    console.error(`[soak runner] ${kind}:`, err);
    recordRunnerStop(kind, err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  });
}

console.log(`[soak runner] Starting soak runs: lens=${lens}, seeds ${fromSeed} to ${fromSeed + count - 1}, maxActions=${actions}, ${workers} at once`);
console.log(`[soak runner] Output directory: ${soakOutDir}`);

/** One seed: one Playwright run of the soak spec, then a line in runs.jsonl. */
function runSeed(seed) {
  const opening = openingOverride ?? (lens === 'chaos' ? (seed % 2 === 0 ? 'play' : 'skip') : 'play');
  console.log(`[soak runner] Running seed ${seed} (${opening}, actions: ${actions})...`);

  const env = {
    ...process.env,
    SOAK: '1',
    SOAK_SEED: String(seed),
    SOAK_POLICY: lens,
    SOAK_ACTIONS: String(actions),
    SOAK_OUT: soakOutDir,
    SOAK_OPENING: opening,
    SOAK_START_FLOOR: String(startFloor),
    SOAK_START_LEVEL: String(startLevel),
    ...(build ? { SOAK_BUILD: build } : {}),
    ...(runestones ? { SOAK_RUNESTONES: runestones } : {}),
    // playwright.config.ts defines Firefox and WebKit only when this is set.
    PW_ALL_BROWSERS: '1',
  };

  // Seeds side by side: each keeps its own test-results folder, and the line reporter writes
  // no shared HTML report.
  const pwArgs = [
    'playwright',
    'test',
    'e2e/soak.spec.ts',
    `--project=${project}`,
    '--workers=1',
    '--reporter=line',
    `--output=${join(testResultsDir, String(seed))}`,
  ];
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const cmdArgs = process.platform === 'win32' ? ['/c', 'npx', ...pwArgs] : pwArgs;

  const startTime = Date.now();
  return new Promise((done) => {
    // Side by side, each seed's console goes to <seed>/console.txt rather than interleaving.
    let stdio = 'inherit';
    if (workers > 1) {
      mkdirSync(join(soakOutDir, String(seed)), { recursive: true });
      const out = openSync(join(soakOutDir, String(seed), 'console.txt'), 'w');
      stdio = ['ignore', out, out];
    }
    const child = spawn(cmd, cmdArgs, { env, stdio, shell: false });
    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startTime;

      const summaryFile = join(soakOutDir, String(seed), 'summary.json');
      let summary = null;
      if (existsSync(summaryFile)) {
        try {
          summary = JSON.parse(readFileSync(summaryFile, 'utf-8'));
        } catch {
          // ignore
        }
      }

      const runRecord = seedRecord({ seed, lens, opening, code, signal, durationMs, summary, timestamp: new Date().toISOString() });

      appendFileSync(runsLogPath, JSON.stringify(runRecord) + '\n');
      finished.add(seed);
      console.log(`[soak runner] Completed seed ${seed}: ${runRecord.stoppedBy} (exitCode=${runRecord.exitCode}), floor ${runRecord.deepestFloor}, ${runRecord.endedBy}, ${Math.round(durationMs / 1000)} s`);
      done();
    });
  });
}

let next = fromSeed;
let cutoffReached = false;
async function lane() {
  while (next < fromSeed + count) {
    if (cutoffMs && Date.now() >= cutoffMs) {
      if (!cutoffReached) console.log(`[soak runner] Cutoff time reached (${untilStr}). Stopping.`);
      cutoffReached = true;
      return;
    }
    await runSeed(next++);
  }
}

await Promise.all(Array.from({ length: Math.max(1, workers) }, lane));
recordRunnerStop(cutoffReached ? 'until' : 'done');
console.log(`\n[soak runner] ${cutoffReached ? 'Stopped at the cutoff.' : 'All scheduled runs completed.'}`);
