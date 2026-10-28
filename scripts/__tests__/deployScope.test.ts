import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deployScope } from '../lib/deploy-scope.mjs';
import { deployOutcome, DEPLOY_STEP } from '../lib/deploy-outcome';

vi.setConfig({ testTimeout: 60_000 });

describe('which pushes deploy', () => {
  it('a push of docs, tooling, sprint machinery and tests alone runs the gates only', () => {
    const files = [
      'docs/sprint.md',
      'CLAUDE.md',
      'ARCHITECTURE.md',
      '.claude/skills/sprint-lane/SKILL.md',
      '.githooks/pre-push',
      'scripts/sprint/queue-rules.mjs',
      'scripts/check-engine-purity.ts',
      'tests/fixtures/fixture-pack/index.ts',
      'src/engine/__tests__/encumbrance.test.ts',
      'src/engine/__fixtures__/testHelpers.ts',
      'src/content/cotw/rot.test.ts',
      'e2e/soak/playerBot.ts',
      'e2e/soak.spec.ts',
      'relay/src/worker.ts',
      '.github/workflows/ci.yml',
      'knip.json',
    ];
    expect(deployScope(files)).toEqual({ ships: false, why: `its ${files.length} files ship nothing (docs, tooling, tests): gates only` });
  });
  it('anything that reaches the bundle or the browser tests deploys, as does any file it does not know', () => {
    for (const file of ['src/engine/engine.ts', 'src/content/cotw/rot.ts', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json',
      'tsconfig.json', 'e2e/gameplay.spec.ts', 'e2e/fixtures.ts', 'playwright.config.ts', '.github/workflows/deploy.yml',
      '.github/workflows/playwright.yml', '.npmrc', 'src/content/cotw/notes.md.ts', 'public/icon.png']) {
      expect(deployScope(['docs/sprint.md', file]), file).toMatchObject({ ships: true, why: `it changes ${file}` });
    }
  });
  it('deploys when the files cannot be listed, and on a manual run', () => {
    expect(deployScope(null)).toMatchObject({ ships: true });
    expect(deployScope(['docs/sprint.md'], 'workflow_dispatch')).toEqual({ ships: true, why: 'a workflow_dispatch run always deploys' });
  });
});

describe('what the CI watcher says of a green run', () => {
  const build = { name: 'build', conclusion: 'success', steps: [{ name: 'Run Quality Gates', conclusion: 'success' }] };
  it('deployed, skipped because nothing ships, or overtaken by a newer push', () => {
    expect(deployOutcome([build, { name: 'deploy', conclusion: 'success', steps: [{ name: DEPLOY_STEP, conclusion: 'success' }] }])).toBe('deployed');
    expect(deployOutcome([build, { name: 'deploy', conclusion: 'skipped', steps: [] }])).toMatch(/ships nothing/);
    expect(deployOutcome([build, { name: 'deploy', conclusion: 'success', steps: [{ name: DEPLOY_STEP, conclusion: 'skipped' }] }])).toMatch(/newer push/);
  });
});

describe('scripts/deploy-scope.mjs in a real clone', () => {
  const SCRIPT = path.resolve(__dirname, '../deploy-scope.mjs');
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && !k.startsWith('GITHUB_'))),
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  let root: string;
  const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, env, encoding: 'utf8' }).stdout.trim();
  const shas: string[] = [];
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-scope-'));
    const work = path.join(root, 'work');
    fs.mkdirSync(work);
    git(work, 'init', '-q', '-b', 'main');
    for (const file of ['src/a.ts', 'docs/x.md', 'src/b.ts']) {
      fs.mkdirSync(path.join(work, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(work, file), `${file}\n`);
      git(work, 'add', file);
      git(work, 'commit', '-q', '-m', file);
      shas.push(git(work, 'rev-parse', 'HEAD'));
    }
    git(root, 'clone', '-q', '--bare', work, 'origin.git');
    const url = `file://${path.join(root, 'origin.git').split(path.sep).join('/').replace(/^([A-Za-z]):/, '/$1:')}`;
    git(root, 'clone', '-q', url, 'full');
    git(root, 'clone', '-q', '--depth=1', url, 'ci');
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
  const scope = (clone: string, before: string, sha: string, output?: string) =>
    spawnSync(process.execPath, [SCRIPT], { cwd: path.join(root, clone), env: { ...env, BEFORE: before, GITHUB_SHA: sha, ...(output && { GITHUB_OUTPUT: output }) }, encoding: 'utf8' }).stdout.trim();

  it('reads a docs-only push in a full clone and leaves its history whole', () => {
    expect(scope('full', shas[0]!, shas[1]!)).toBe('ships=false: its 1 file ship nothing (docs, tooling, tests): gates only');
    expect(git(path.join(root, 'full'), 'rev-parse', '--is-shallow-repository')).toBe('false');
  });
  it('fetches the commit before a push one deep into CI\'s shallow checkout, and writes the output', () => {
    const output = path.join(root, 'output.txt');
    expect(scope('ci', shas[1]!, shas[2]!, output)).toBe('ships=true: it changes src/b.ts');
    expect(fs.readFileSync(output, 'utf8')).toBe('ships=true\n');
  });
  it('deploys when the push before is unknown', () => {
    expect(scope('full', '0'.repeat(40), shas[2]!)).toBe('ships=true: the files this push changed could not be listed');
    expect(scope('full', 'f'.repeat(40), shas[2]!)).toBe('ships=true: the files this push changed could not be listed');
  });
});
