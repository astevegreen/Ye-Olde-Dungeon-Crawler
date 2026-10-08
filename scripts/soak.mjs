#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

function printHelp() {
  console.log(`
Usage: node scripts/soak.mjs [options]

Options:
  --lens <lens>        chaos | player | ui-sweep (default: chaos)
  --from <seed>        Starting seed integer (default: 1)
  --count <count>      Number of seeds to run (default: 100)
  --actions <actions>  Maximum actions per run (default: 1500)
  --opening <opening>  play | skip (default: even play / odd skip for chaos, play for player)
  --until <HH:MM>      Wall-clock cutoff time (e.g. 06:30)
  --project <browser>  Playwright browser project (default: chromium)
  --workers <workers>  Worker count (default: 1)
  --start-floor <n>    Deep-floor start: outfit the hero for floor n and drop it there (default: 0, off)
  --start-level <n>    The level that outfit aims at (default: 1 + 0.7 x floor)
  --help               Show this help message
`);
}

const args = process.argv.slice(2);
let lens = 'chaos';
let fromSeed = 1;
let count = 100;
let actions = 1500;
let openingOverride = null;
let untilStr = null;
let project = 'chromium';
let workers = 1;
let startFloor = 0;
let startLevel = 0;

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
  }
}

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
const reportDir = join(soakOutDir, 'report');

console.log(`[soak runner] Starting soak runs: lens=${lens}, seeds ${fromSeed} to ${fromSeed + count - 1}, maxActions=${actions}`);
console.log(`[soak runner] Output directory: ${soakOutDir}`);

for (let seed = fromSeed; seed < fromSeed + count; seed++) {
  if (cutoffMs && Date.now() >= cutoffMs) {
    console.log(`[soak runner] Cutoff time reached (${untilStr}). Stopping loop.`);
    break;
  }

  const opening = openingOverride ?? (lens === 'chaos' ? (seed % 2 === 0 ? 'play' : 'skip') : 'play');
  console.log(`\n======================================================`);
  console.log(`[soak runner] Running seed ${seed} (${opening}, actions: ${actions})...`);
  console.log(`======================================================`);

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
    PLAYWRIGHT_HTML_REPORT: reportDir,
    // playwright.config.ts defines Firefox and WebKit only when this is set.
    PW_ALL_BROWSERS: '1',
  };

  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const cmdArgs = process.platform === 'win32'
    ? [
        '/c',
        'npx',
        'playwright',
        'test',
        'e2e/soak.spec.ts',
        `--project=${project}`,
        `--workers=${workers}`,
        `--output=${testResultsDir}`,
      ]
    : [
        'playwright',
        'test',
        'e2e/soak.spec.ts',
        `--project=${project}`,
        `--workers=${workers}`,
        `--output=${testResultsDir}`,
      ];

  const startTime = Date.now();
  const child = spawnSync(cmd, cmdArgs, {
    env,
    stdio: 'inherit',
    shell: false,
  });
  const durationMs = Date.now() - startTime;
  const exitCode = child.status ?? (child.signal ? 1 : 0);

  // Read summary if written
  const summaryFile = join(soakOutDir, String(seed), 'summary.json');
  let summary = null;
  if (existsSync(summaryFile)) {
    try {
      summary = JSON.parse(readFileSync(summaryFile, 'utf-8'));
    } catch {
      // ignore
    }
  }

  const runRecord = {
    seed,
    lens,
    opening,
    exitCode,
    status: exitCode === 0 ? 'passed' : 'failed',
    durationMs,
    endedBy: summary?.endedBy ?? null,
    turnsPlayed: summary?.turnsPlayed ?? null,
    deepestFloor: summary?.deepestFloor ?? null,
    causeOfDeath: summary?.causeOfDeath ?? null,
    sha: summary?.sha ?? null,
    deathCause: summary?.bot?.deathCause ?? null,
    findingCounts: summary?.findingCounts ?? {},
    timestamp: new Date().toISOString(),
  };

  appendFileSync(runsLogPath, JSON.stringify(runRecord) + '\n');
  console.log(`[soak runner] Completed seed ${seed}: exitCode=${exitCode}, duration=${durationMs}ms`);
}

console.log(`\n[soak runner] All scheduled runs completed.`);
