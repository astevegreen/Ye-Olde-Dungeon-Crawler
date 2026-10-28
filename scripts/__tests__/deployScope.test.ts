import { describe, expect, it } from 'vitest';
import { deployScope } from '../lib/deploy-scope.mjs';
import { deployOutcome, DEPLOY_STEP } from '../lib/deploy-outcome';

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
