#!/usr/bin/env node
/**
 * The sprint queue (docs/sprint.md, Machinery): the skills ask it instead of applying the queue rules by
 * hand. Prints one line of JSON and exits 0 (done), 2 (refused: act on `do`) or 1 (failed: stop).
 *
 *   has-work "<session title>"        {start, reason}; a plan adds {ready, todo}, integrate {issues}
 *   next <lane> [--taken <n,n>]       {mode, issue, concerns, reason} or null; research has its own modes
 *   move <n> <state> [--note '<text>'] the labels and the standard "Lane:" comment
 *   status [--write] [--also '<line>'] the sprint log's status block and its "Needs you" list
 *
 * It reads docs/sprint.md as pushed (origin/main), so every session and worktree reads one list, and runs
 * gh and git in this checkout whatever the caller's folder. The rules: queue-rules.mjs.
 */
import { spawnSync } from 'node:child_process';
import { freemem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { QueueError, run } from './queue-rules.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function exec(file, args, input) {
  const r = spawnSync(file, args, { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  return { status: r.error ? -1 : (r.status ?? -1), stdout: r.stdout ?? '', stderr: r.stderr || r.error?.message || '' };
}
const firstLine = (s) => s.trim().split(/\r?\n/)[0] ?? '';

const io = {
  sprintDoc() {
    const r = exec('git', ['show', 'origin/main:docs/sprint.md']);
    if (r.status !== 0) throw new QueueError(`git show origin/main:docs/sprint.md failed: ${firstLine(r.stderr)}`);
    return r.stdout;
  },
  gh(args, input) {
    const r = exec('gh', args, input);
    if (r.status !== 0) throw new QueueError(`gh ${args.slice(0, 2).join(' ')} failed: ${firstLine(r.stderr)}`);
    return r.stdout;
  },
  branchAhead(n) {
    const branch = `refs/heads/sprint/${n}`;
    if (exec('git', ['rev-parse', '--verify', '--quiet', branch]).status !== 0) return 0;
    const r = exec('git', ['rev-list', '--count', `origin/main..${branch}`]);
    if (r.status !== 0) throw new QueueError(`git rev-list origin/main..sprint/${n} failed: ${firstLine(r.stderr)}`);
    return Number(r.stdout.trim());
  },
  processInfo(pid) {
    if (process.platform !== 'win32') throw new QueueError('the soak check reads Windows processes; run it on the sprint computer');
    const script = `$p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue; if ($p) { '{0}|{1}' -f $p.ProcessName, $p.StartTime.ToUniversalTime().ToString('o') }; exit 0`;
    const r = exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    if (r.status !== 0) throw new QueueError(`Get-Process ${pid} failed: ${firstLine(r.stderr)}`);
    const [name, start] = r.stdout.trim().split('|');
    return name && start ? { name, start: new Date(start) } : null;
  },
  freeMb: () => Math.floor(freemem() / 1048576),
  now: () => new Date(),
};

const { code, line } = run(process.argv.slice(2), io);
process.stdout.write(`${line}\n`);
process.exitCode = code;
