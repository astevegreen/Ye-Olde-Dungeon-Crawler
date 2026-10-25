#!/usr/bin/env node
/**
 * The sprint's push lock, run first by `.githooks/pre-push` with the push's ref lines on stdin: while this
 * computer's sprint window is open, a push to main is refused unless it comes from the integrator's
 * worktree, so lane work lands only through the integrator (docs/sprint.md). The guard refuses a lane
 * session's push before it runs (.claude/hooks/sprint-guard.mjs); this also stops one from the owner's
 * terminal or a session without the guard. SKIP_HOOKS does not lift it; /sprint-stop ends the window.
 * Exits 0 to let the push go on, 1 to refuse it, with the reason on stderr.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOW_FILE } from './queue-rules.mjs';

/** Where the integrator works (.claude/skills/sprint-integrate/SKILL.md). */
export const INTEGRATOR = 'C:/Antigravity/YODC-integrate';

const folder = (p) => {
  const abs = path.resolve(p).replaceAll('\\', '/').replace(/\/$/, '');
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
};

/**
 * Why this push is refused, or null to let it go on. `refs` is pre-push's stdin, one line per ref:
 * `<local ref> <local sha> <remote ref> <remote sha>`. `windowText` is the window file's text, or null when
 * no sprint was ever started here. A window file that can't be read refuses: whether a sprint runs is unknown.
 */
export function pushLockRefusal({ refs, windowText, now, toplevel, integrator = INTEGRATOR }) {
  const toMain = refs.split('\n').some((line) => line.trim().split(/\s+/)[2] === 'refs/heads/main');
  if (!toMain || windowText === null) return null;
  let start;
  let end;
  try {
    const w = JSON.parse(windowText);
    start = new Date(w.start);
    end = new Date(w.end);
  } catch {
    start = end = new Date(Number.NaN);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${WINDOW_FILE} holds no window, so whether a sprint is running is unknown. Report it to the owner.`;
  }
  if (now < start || now > end || folder(toplevel) === folder(integrator)) return null;
  return (
    `the sprint window is open until ${end.toISOString()}, and main takes pushes only from the integrator's ` +
    `worktree (${integrator}), not ${toplevel}. Lane work lands through the integrator; /sprint-stop ends the window.`
  );
}

function git(...args) {
  const r = spawnSync('git', ['rev-parse', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git rev-parse ${args.join(' ')} failed: ${r.stderr.trim()}`);
  return path.resolve(r.stdout.trim());
}

function main() {
  let windowText = null;
  try {
    windowText = readFileSync(path.join(git('--git-common-dir'), WINDOW_FILE), 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const refusal = pushLockRefusal({ refs: readFileSync(0, 'utf8'), windowText, now: new Date(), toplevel: git('--show-toplevel') });
  if (refusal) {
    console.error(`pre-push: refused: ${refusal}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
