// `node scripts/deploy-scope.mjs`, run by .github/workflows/deploy.yml: lists the files changed from BEFORE to
// GITHUB_SHA (a push to main, or what landed after a commit whose deploy was overtaken), prints `ships=true|false`
// and writes it to GITHUB_OUTPUT (scripts/lib/deploy-scope.mjs decides). A commit missing here is fetched; one deep
// only in a clone that is already shallow (CI's checkout), since in a full clone that would cut off the history.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { deployScope } from './lib/deploy-scope.mjs';

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' });
const { BEFORE = '', GITHUB_SHA = '', GITHUB_EVENT_NAME = 'push', GITHUB_OUTPUT } = process.env;

function changedFiles() {
  const sha = /^[0-9a-f]{40}$/;
  if (!sha.test(BEFORE) || /^0+$/.test(BEFORE) || !sha.test(GITHUB_SHA)) return null;
  const missing = [BEFORE, GITHUB_SHA].filter((c) => git('cat-file', '-e', `${c}^{commit}`).status !== 0);
  if (missing.length) {
    const shallow = git('rev-parse', '--is-shallow-repository').stdout.trim() === 'true';
    if (git('fetch', '--no-tags', ...(shallow ? ['--depth=1'] : []), 'origin', ...missing).status !== 0) return null;
  }
  const r = git('diff', '--name-only', '--no-renames', BEFORE, GITHUB_SHA);
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
}

const scope = deployScope(GITHUB_EVENT_NAME === 'push' ? changedFiles() : null, GITHUB_EVENT_NAME);
console.log(`ships=${scope.ships}: ${scope.why}`);
if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `ships=${scope.ships}\n`);
