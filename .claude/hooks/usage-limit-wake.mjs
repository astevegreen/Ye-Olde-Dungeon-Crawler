// StopFailure hook on rate_limit: a usage limit stops every sprint session, and no supervisor run can start
// until it resets. Scheduled sessions can't read the reset beforehand (they have no get_session), but Claude Code
// records it on the stopped session's error entry and names it in the error. `queue.mjs wake` reads it and,
// during an open sprint window, arms one waiter (scripts/sprint/wake-waiter.mjs), started here detached so it
// outlives this session, to fire the supervisor 2 minutes past the reset. Claude Code ignores this hook's output.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
if (input.error !== 'rate_limit') process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const args = [path.join(root, 'scripts', 'sprint', 'queue.mjs'), 'wake'];
if (input.transcript_path) args.push('--transcript', input.transcript_path);
if (input.last_assistant_message) args.push('--message', String(input.last_assistant_message));

for (let attempt = 0; attempt < 2; attempt++) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    process.exit(0);
  }
  if (out.arm) {
    spawn(process.execPath, [path.join(root, 'scripts', 'sprint', 'wake-waiter.mjs'), out.at], {
      cwd: root, detached: true, stdio: 'ignore', windowsHide: true,
    }).unref();
    process.exit(0);
  }
  // The transcript is written a moment behind the stop: read it once more before giving up on a reset time.
  if (!/names no reset time/.test(out.reason ?? '')) process.exit(0);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
}
