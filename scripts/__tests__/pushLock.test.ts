// The sprint's push lock (scripts/sprint/push-lock.mjs): its rule, and the real pre-push hook refusing a
// push to main into a bare repository while a window file in the shared git folder says a sprint is open.
// SKIP_HOOKS=1 stops the hook after the lock, which it never lifts, so no gate runs here.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { INTEGRATOR, pushLockRefusal } from '../sprint/push-lock.mjs';

vi.setConfig({ testTimeout: 90_000 });

const HOOKS = fileURLToPath(new URL('../../.githooks', import.meta.url)).split(path.sep).join('/');
const NOW = new Date('2026-10-26T12:00:00Z');
const OPEN = JSON.stringify({ start: '2026-10-26T09:00:00.000Z', end: '2026-10-28T01:00:00.000Z' });
const MAIN = 'refs/heads/main 1111 refs/heads/main 2222';

describe('pushLockRefusal', () => {
  const refuse = (over: Partial<Parameters<typeof pushLockRefusal>[0]>) =>
    pushLockRefusal({ refs: MAIN, windowText: OPEN, now: NOW, toplevel: 'C:/Antigravity/YODC', ...over });

  it('refuses a push to main from another folder while the window is open', () => {
    expect(refuse({})).toMatch(/window is open until 2026-10-28T01:00:00.000Z.*not C:\/Antigravity\/YODC\./);
    expect(refuse({ toplevel: 'C:/Antigravity/YODC-lane-ux' })).not.toBeNull();
    expect(refuse({ refs: `refs/heads/handoffs 1 refs/heads/handoffs 2\n${MAIN}\n` })).not.toBeNull();
    expect(refuse({ refs: '(delete) 0000 refs/heads/main 2222' })).not.toBeNull();
  });

  it("lets the integrator's worktree push main, however git spells the folder", () => {
    expect(refuse({ toplevel: INTEGRATOR })).toBeNull();
    if (process.platform === 'win32') {
      expect(refuse({ toplevel: 'c:\\Antigravity\\YODC-integrate\\' })).toBeNull();
    }
  });

  it('lets a push go on outside the window, or to any other branch', () => {
    expect(refuse({ windowText: null })).toBeNull();
    expect(refuse({ now: new Date('2026-10-28T01:01:00Z') })).toBeNull();
    expect(refuse({ now: new Date('2026-10-26T08:59:00Z') })).toBeNull();
    expect(refuse({ refs: 'refs/heads/sprint/57 1 refs/heads/sprint/57 2\nrefs/heads/main 1 refs/heads/mainline 2' })).toBeNull();
    expect(refuse({ refs: '' })).toBeNull();
  });

  it("refuses when the window file can't be read, since a sprint may be running", () => {
    for (const windowText of ['{', 'null', '{}', JSON.stringify({ start: 'soon', end: '2026-10-28T01:00:00Z' })]) {
      expect(refuse({ windowText })).toMatch(/holds no window/);
    }
    expect(refuse({ windowText: '{', refs: 'refs/heads/x 1 refs/heads/x 2' })).toBeNull();
  });
});

// The pre-commit hook runs this suite with git's GIT_* variables set (GIT_INDEX_FILE among them): the
// children get none of them.
const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  SKIP_HOOKS: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function ok(cwd: string, ...args: string[]): Promise<string> {
  const r = await git(cwd, ...args);
  if (r.code !== 0) throw new Error(`git ${args.join(' ')}: ${r.out}`);
  return r.out;
}

// A bare origin and a clone on main whose hooks are this repository's, with a linked worktree beside it.
async function repos(): Promise<{ work: string; lane: string; windowFile: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'push-lock-'));
  roots.push(root);
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  const lane = path.join(root, 'lane');
  await Promise.all([ok(root, 'init', '-q', '--bare', '-b', 'main', origin), ok(root, 'init', '-q', '-b', 'main', work)]);
  await ok(work, 'config', 'commit.gpgsign', 'false');
  await ok(work, 'config', 'core.hooksPath', HOOKS);
  await ok(work, 'remote', 'add', 'origin', origin);
  await ok(work, 'commit', '-q', '--allow-empty', '-m', 'one');
  await ok(work, 'worktree', 'add', '-q', '-b', 'lane', lane);
  return { work, lane, windowFile: path.join(work, '.git', 'sprint-window.json') };
}

const window = (hoursFromNow: [number, number]) => {
  const at = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  return JSON.stringify({ start: at(hoursFromNow[0]), end: at(hoursFromNow[1]), environment: 'env_test' });
};

describe('.githooks/pre-push', () => {
  it('refuses a push to main from a checkout or a worktree while the window is open', async () => {
    const { work, lane, windowFile } = await repos();
    fs.writeFileSync(windowFile, window([-1, 39]));
    const fromWork = await git(work, 'push', 'origin', 'HEAD:main');
    expect(fromWork.code).not.toBe(0);
    expect(fromWork.out).toMatch(/pre-push: refused: the sprint window is open until .*\/sprint-stop ends the window/);
    const fromLane = await git(lane, 'push', 'origin', 'HEAD:main');
    expect(fromLane.code).not.toBe(0);
    expect(fromLane.out).toContain('pre-push: refused');
    expect(await git(work, 'ls-remote', 'origin', 'main')).toEqual({ code: 0, out: '' });
  });

  it('lets other branches, and main outside the window, through to the gates', async () => {
    const { work, lane, windowFile } = await repos();
    fs.writeFileSync(windowFile, window([-1, 39]));
    expect(await ok(lane, 'push', 'origin', 'HEAD:refs/heads/handoffs', 'lane')).toContain('pre-push: skipped (SKIP_HOOKS=1)');
    fs.writeFileSync(windowFile, window([-41, -1]));
    expect(await ok(work, 'push', 'origin', 'HEAD:main')).toContain('pre-push: skipped (SKIP_HOOKS=1)');
    fs.rmSync(windowFile);
    await ok(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    expect(await ok(work, 'push', 'origin', 'HEAD:main')).toContain('pre-push: skipped (SKIP_HOOKS=1)');
  });
});
