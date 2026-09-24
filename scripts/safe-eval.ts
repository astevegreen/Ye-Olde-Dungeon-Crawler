import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Safe script runner for ad-hoc inspection, testing, and diagnostics.
 * Prevents Windows PowerShell stdin hangs by running scripts in a child process
 * with stdin explicitly closed (ignored) and an enforced execution timeout.
 *
 * Usage:
 *   npx tsx scripts/safe-eval.ts <script-path>
 *   npm run safe:eval -- <script-path>
 *   npm run safe:eval -- -e "<code>"
 */

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tsx scripts/safe-eval.ts <script-path> | -e "<code>"');
  process.exit(1);
}

const TIMEOUT_MS = 30_000;
let scriptPath = '';
let tempCreated = false;

if (args[0] === '-e') {
  const code = args.slice(1).join(' ');
  const tempFile = path.resolve(os.tmpdir(), `yodc_eval_${Date.now()}.ts`);
  fs.writeFileSync(tempFile, code, 'utf-8');
  scriptPath = tempFile;
  tempCreated = true;
} else {
  scriptPath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script file not found: ${scriptPath}`);
    process.exit(1);
  }
}

let exitCode = 0;
try {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'npx.cmd' : 'npx';
  const result = spawnSync(cmd, ['tsx', scriptPath], {
    stdio: ['ignore', 'inherit', 'inherit'], // Closed stdin prevents REPL/input hangs
    timeout: TIMEOUT_MS,
    shell: isWindows,
  });

  if (result.error) {
    if ((result.error as any).code === 'ETIMEDOUT') {
      console.error(`Execution timed out after ${TIMEOUT_MS / 1000}s`);
    } else {
      console.error('Execution error:', result.error.message);
    }
    exitCode = 1;
  } else {
    exitCode = result.status ?? 0;
  }
} finally {
  if (tempCreated && fs.existsSync(scriptPath)) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // Ignore cleanup error
    }
  }
}

process.exit(exitCode);
