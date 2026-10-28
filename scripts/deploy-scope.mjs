// `node scripts/deploy-scope.mjs`, run by .github/workflows/deploy.yml: lists the files changed from BEFORE to
// GITHUB_SHA (a push to main, or what landed after a commit whose deploy was overtaken), prints `ships=true|false`
// and writes it to GITHUB_OUTPUT (scripts/lib/deploy-scope.mjs decides). Both commits are fetched one deep: a diff
// needs only their trees, never the history between them.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { deployScope } from './lib/deploy-scope.mjs';

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' });
const { BEFORE = '', GITHUB_SHA = '', GITHUB_EVENT_NAME = 'push', GITHUB_OUTPUT } = process.env;

function changedFiles() {
  if (!/^[0-9a-f]{40}$/.test(BEFORE) || /^0+$/.test(BEFORE) || !GITHUB_SHA) return null;
  if (git('fetch', '--no-tags', '--depth=1', 'origin', BEFORE, GITHUB_SHA).status !== 0) return null;
  const r = git('diff', '--name-only', '--no-renames', BEFORE, GITHUB_SHA);
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
}

const scope = deployScope(GITHUB_EVENT_NAME === 'push' ? changedFiles() : null, GITHUB_EVENT_NAME);
console.log(`ships=${scope.ships}: ${scope.why}`);
if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `ships=${scope.ships}\n`);
