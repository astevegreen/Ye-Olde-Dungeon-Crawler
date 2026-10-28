// The commit-msg hook (.githooks/commit-msg) on §8.1 protected files, run by real git in a throwaway repo with only
// that hook installed, so no other gate runs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

const HOOK = path.resolve(__dirname, '../../.githooks/commit-msg');
const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && k !== 'SKIP_HOOKS')),
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

let repo: string;
const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-msg-'));
  const hooks = path.join(repo, '.hooks');
  fs.mkdirSync(hooks);
  fs.copyFileSync(HOOK, path.join(hooks, 'commit-msg'));
  fs.chmodSync(path.join(hooks, 'commit-msg'), 0o755);
  git('init', '-q');
  git('config', 'core.hooksPath', hooks.split(path.sep).join('/'));
  git('config', 'core.autocrlf', 'false');
});
afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

/** Stages a change to `file` and commits it with `message`: git's exit code and the hook's words. */
function commit(file: string, message: string): { code: number | null; out: string } {
  const full = path.join(repo, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.appendFileSync(full, `${message.length}\n`);
  git('add', file);
  const run = spawnSync('git', ['commit', '-q', '-F', '-'], { cwd: repo, env, encoding: 'utf8', input: message });
  // A refused commit leaves its change staged; the next test stages on top of it.
  return { code: run.status, out: `${run.stdout}${run.stderr}` };
}

describe('.githooks/commit-msg on §8.1 protected files', () => {
  it('takes exception 1 anywhere, and refuses a protected file with no exception named', () => {
    expect(commit('src/engine/engine.ts', 'fix(engine): x\n\n§8.1 exception 1').code).toBe(0);
    const bare = commit('src/engine/engine.ts', 'feat(engine): x');
    expect(bare.code).not.toBe(0);
    expect(bare.out).toContain('changes a §8.1 protected file');
  });
  it('on engine.ts and actionPipeline.ts, exceptions 4 and 5 state the change and are reminded of the reviewer and second look', () => {
    for (const file of ['src/engine/engine.ts', 'src/engine/actions/actionPipeline.ts']) {
      expect(commit(file, 'feat(engine): x\n\n§8.1 exception 4').code, file).not.toBe(0);
      const four = commit(file, 'feat(engine): x\n\n§8.1 exception 4: adds the onFloorEnter hook point');
      expect(four.code, file).toBe(0);
      expect(four.out).toContain("push only after the reviewer's PASS and a second-look ship");
      expect(commit(file, 'feat(engine): x\n\n§8.1 exception 5: the scheduler owns the turn order').code, file).toBe(0);
    }
  });
  it('keeps migrator.ts the owner\'s: exception 5 never covers it, and no reminder stands in for the owner', () => {
    expect(commit('src/engine/storage/migrator.ts', 'feat(save): x\n\n§8.1 exception 5: the save needs a field').code).not.toBe(0);
    const owner = commit('src/engine/storage/migrator.ts', 'feat(save): x\n\n§8.1 exception 4: "add the hearth field to saves"');
    expect(owner.code).toBe(0);
    expect(owner.out).not.toContain('second-look');
  });
});
