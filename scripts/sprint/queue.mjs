#!/usr/bin/env node
/**
 * The sprint queue (docs/sprint.md, Machinery): the skills ask it instead of applying the queue rules by
 * hand. Prints one line of JSON and exits 0 (done), 2 (refused: act on `do`) or 1 (failed: stop).
 *
 *   window                            {phase, window, environment, supervisor, archiver, wake, stoppedBy, logIssue, titles}
 *   window start [hours] --environment <env> [--dry-run]   opens the window now (/sprint-start)
 *   window ids [--supervisor <trig>] [--archiver <trig>] [--wake <trig>]   records the scheduled tasks' ids
 *   wake [--resets-at <epoch s>]      {arm, at, wake, reason}: move the wake supervisor to after a usage limit
 *   window stop | window archived     ends the window now (/sprint-stop); clears the archiver once it is off
 *   started "<title>" <trig>          records a trigger the supervisor created
 *   sessions [--all]                  {title: trigger id or null}; --all lists every one, newest first
 *   lock | unlock                     one supervisor run at a time
 *   resume --log <file> --last-event <ISO>   {start, reason, restartAt}: when a usage-limit stop may restart
 *   identity                          {login, ok}: gh is signed in as the bot (/sprint-start)
 *   has-work "<session title>" [--starting <n>]   {start, reason}; a plan adds {ready, todo}, integrate {issues}
 *   next <lane> [--taken <n,n>]       {mode, issue, concerns, reason} or null; research has its own modes
 *   move <n> <state> [--note '<text>'] the labels and the standard "Lane:" comment
 *   status [--write] [--also '<line>'] the sprint log's status block and its "Needs you" list
 *
 * It reads docs/sprint.md as pushed (origin/main), so every session and worktree reads one list; the
 * window, ledger and lock live in this checkout's git folder, which every worktree shares; and it runs gh
 * and git in this checkout whatever the caller's folder. The rules: queue-rules.mjs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { freemem } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueueError, run } from './queue-rules.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function exec(file, args, input) {
  const r = spawnSync(file, args, { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  return { status: r.error ? -1 : (r.status ?? -1), stdout: r.stdout ?? '', stderr: r.stderr || r.error?.message || '' };
}
const firstLine = (s) => s.trim().split(/\r?\n/)[0] ?? '';

let stateDir = null;
/** The git folder the main checkout and every worktree share: the sprint's state on this computer. */
function state(name) {
  if (!stateDir) {
    const r = exec('git', ['rev-parse', '--git-common-dir']);
    if (r.status !== 0) throw new QueueError(`git rev-parse --git-common-dir failed: ${firstLine(r.stderr)}`);
    stateDir = path.resolve(ROOT, r.stdout.trim());
  }
  return path.join(stateDir, name);
}
function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new QueueError(`${file} is not JSON (${e.message})`, 'Start nothing. Report it on the sprint log; the owner fixes or deletes the file.');
  }
}

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
  local: {
    read: (name) => readJson(state(name)),
    // The whole file, then a rename, so a reader never sees half of one.
    write(name, value) {
      const file = state(name);
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
      renameSync(tmp, file);
    },
    claim(name, value) {
      try {
        writeFileSync(state(name), `${JSON.stringify(value)}\n`, { flag: 'wx' });
        return true;
      } catch (e) {
        if (e.code === 'EEXIST') return false;
        throw e;
      }
    },
    remove: (name) => rmSync(state(name), { force: true }),
  },
  readFile(file) {
    try {
      return readFileSync(path.resolve(file), 'utf8');
    } catch (e) {
      throw new QueueError(`cannot read ${file}: ${e.message}`, 'Save the end of the run log with the Write tool and pass that file.', 2);
    }
  },
  freeMb: () => Math.floor(freemem() / 1048576),
  now: () => new Date(),
};

const { code, line } = run(process.argv.slice(2), io);
process.stdout.write(`${line}\n`);
process.exitCode = code;
