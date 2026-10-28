#!/usr/bin/env node
/**
 * Fires the sprint supervisor 2 minutes past a usage-limit reset (docs/sprint.md, Machinery). A limit stops
 * every Claude session until it resets, the supervisor's own runs included, so the usage-limit hook
 * (.claude/hooks/usage-limit-wake.mjs) starts this detached, outside any session: it sleeps until `at`, asks
 * `queue.mjs wake --due <at>` whether the sprint still wants it, and has one short headless Claude run fire
 * the supervisor trigger, since only a Claude session holds the remote-trigger API. That run fires it only
 * while the trigger is switched on, so the owner's pause holds. Each step is a line in .prompts/tmp/sprint-wake.txt.
 *
 *   node scripts/sprint/wake-waiter.mjs <at, ISO>
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LOG = path.join(ROOT, '.prompts', 'tmp', 'sprint-wake.txt');

function log(line) {
  mkdirSync(path.dirname(LOG), { recursive: true });
  appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
}

const at = process.argv[2] ?? '';
const when = Date.parse(at);
if (Number.isNaN(when)) {
  log(`not started: "${at}" is not a time`);
  process.exit(1);
}
log(`waiting until ${at}`);
// setTimeout holds at most about 24 days; a window is at most 4.
await new Promise((resolve) => setTimeout(resolve, Math.max(0, when - Date.now())));

const due = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'sprint', 'queue.mjs'), 'wake', '--due', at], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
let answer;
try {
  answer = JSON.parse(due.stdout);
} catch {
  log(`queue.mjs wake --due failed: ${(due.stderr || due.stdout || '').trim().split(/\r?\n/)[0]}`);
  process.exit(1);
}
if (!answer.fire) {
  log(`not fired: ${answer.reason}`);
  process.exit(0);
}

const trigger = answer.supervisor;
const prompt = [
  `Use the RemoteTrigger tool (load it with ToolSearch if it is deferred). First call it with action "get" and trigger_id "${trigger}".`,
  `If that trigger's "enabled" is true, call it with action "run" and trigger_id "${trigger}", then reply with the one word FIRED.`,
  'If "enabled" is false, reply "SKIPPED: switched off". If a call fails, reply "FAILED: " and the error. Do nothing else.',
].join(' ');
// A folder with no project settings, so no project hook or CLAUDE.md runs for one tool call.
const r = spawnSync('claude', ['-p', prompt, '--model', 'haiku', '--setting-sources', 'user', '--allowedTools', 'RemoteTrigger,ToolSearch', '--max-turns', '6'], {
  cwd: tmpdir(), encoding: 'utf8', timeout: 5 * 60_000, windowsHide: true,
});
const said = (r.stdout || r.stderr || r.error?.message || '').trim().replace(/\s+/g, ' ').slice(0, 300);
log(`${trigger}: ${said || `claude exited ${r.status}`}`);
