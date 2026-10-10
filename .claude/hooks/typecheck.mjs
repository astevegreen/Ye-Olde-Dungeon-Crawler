// Stop hook: type-check once when Claude finishes a turn that left TypeScript changed in a folder
// tsc covers (tsconfig.json: src, tests, scripts, relay; e2e/tsconfig.json: e2e).
// Exit 2 feeds tsc's errors back to Claude, which fixes them before finishing; any other path
// exits 0 silently. A turn whose edits were committed already ran tsc in the pre-commit lint.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

// Already continuing because of a Stop hook: don't loop.
if (input?.stop_hook_active) process.exit(0);

const cwd = input?.cwd ?? process.cwd();

const status = spawnSync(
  'git',
  ['status', '--porcelain', '--', 'src', 'tests', 'scripts', 'relay', 'e2e', 'vite.config.ts', 'playwright.config.ts'],
  { cwd, encoding: 'utf8' },
);
if (status.status !== 0) process.exit(0);
const changed = status.stdout
  .split('\n')
  .map((line) => line.slice(3).trim().replace(/^.* -> /, ''))
  .filter((file) => /\.tsx?$/.test(file));
if (changed.length === 0) process.exit(0);

// Find tsc the way Node does, walking up from cwd: an app-made worktree has no node_modules
// junction and uses the parent checkout's. Not installed anywhere: nothing to check with.
let tscPath;
try {
  tscPath = createRequire(join(cwd, 'package.json')).resolve('typescript/bin/tsc');
} catch {
  process.exit(0);
}

// Straight to tsc, without npx and a shell; tsconfig.json's incremental build info makes a rerun ~1s.
const tsc = (...project) =>
  spawnSync(process.execPath, [tscPath, '--noEmit', '--pretty', 'false', ...project], {
    cwd,
    encoding: 'utf8',
  });
const runs = [tsc()];
if (changed.some((file) => file.startsWith('e2e/') || file === 'playwright.config.ts')) {
  runs.push(tsc('-p', 'e2e/tsconfig.json'));
}

const failed = runs.filter((res) => res.status !== 0);
if (failed.length === 0) process.exit(0);

const out = failed
  .map((res) => `${res.stdout ?? ''}${res.stderr ?? ''}`.trim())
  .join('\n')
  .split('\n')
  .slice(0, 40)
  .join('\n');
process.stderr.write(`tsc --noEmit failed with ${changed.length} changed TypeScript file(s):\n${out}\n`);
process.exit(2);
