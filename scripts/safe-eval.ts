/**
 * Runs an ad-hoc TypeScript probe with stdin closed and a hard timeout.
 *
 * `tsx` with no script — which is what `npx tsx -e "<code>"` becomes when
 * Windows PowerShell drops or mangles the quoted code argument — starts a REPL
 * that waits on stdin forever. Write the probe to a file and run it here:
 *
 *   npm run safe:eval -- <script-path> [script args...]
 *
 * Deliberately no `-e` mode: inline code goes through the same shell quoting
 * that causes the hang.
 *
 * The probe runs as `node --import tsx <script>` directly — no npx, no shell,
 * no tsx CLI child — so the timeout kills the process that is actually running.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TIMEOUT_MS = 30_000;

const [scriptArg, ...scriptArgs] = process.argv.slice(2);
if (!scriptArg || scriptArg.startsWith('-')) {
  console.error('Usage: npm run safe:eval -- <script-path> [script args...]');
  console.error('Inline code (-e) is not supported: write the probe to a file (.prompts/ or a scratch dir).');
  process.exit(1);
}

const scriptPath = path.resolve(process.cwd(), scriptArg);
if (!fs.existsSync(scriptPath)) {
  console.error(`Script file not found: ${scriptPath}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), scriptPath, ...scriptArgs], {
  stdio: ['ignore', 'inherit', 'inherit'],
  timeout: TIMEOUT_MS,
  killSignal: 'SIGKILL',
});

if (result.error) {
  const timedOut = (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
  console.error(timedOut ? `Timed out after ${TIMEOUT_MS / 1000}s` : `Execution error: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
