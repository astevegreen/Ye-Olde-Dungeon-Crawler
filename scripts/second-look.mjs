// `node scripts/second-look.mjs "<the owner's words>"`: a second review of the change about to be pushed, by another
// model through agy (headless and read-only), run beside the reviewer agent. Like the reviewer, it reviews
// origin/main..HEAD, the commits the push sends. It prints the findings, or one "skipped" line, and never holds
// the push.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ORDER,
  TIMEOUT,
  askFirstAvailable,
  buildPrompt,
  byLine,
  diffStats,
  parseReply,
  pickDepth,
} from './lib/agy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USAGE = 'usage: node scripts/second-look.mjs "<the owner\'s words>"';
const MAX_DIFF = 200_000;
// Where a mistake costs most: the engine (with the save format and the §8.1 protected files), the invariants
// themselves, the gates that enforce them, and the relay the internet can reach. A change touching one gets the
// deep review.
const DEEP_PATHS = ['src/engine/', 'ARCHITECTURE.md', 'scripts/check-', '.githooks/', 'relay/'];

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 11 * 60_000,
  });
}
const git = (...args) => run('git', args).stdout ?? '';

// The commits since this branch left origin/main. Uncommitted and untracked files stay out: the push leaves them
// behind, and the main checkout holds untracked files no task made (docs/retros/ on 24 Oct).
function change() {
  const base = git('merge-base', 'origin/main', 'HEAD').trim() || 'HEAD';
  return { base, diff: git('diff', '--no-ext-diff', `${base}..HEAD`) };
}

function secondLook(request, tmp) {
  const { base, diff } = change();
  if (!diff.trim()) return 'Second look skipped: no commits to push since origin/main.';
  const pick = pickDepth({ kind: 'change', ...diffStats(diff) }, DEEP_PATHS);
  const shown =
    diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n... (diff truncated; read the rest from disk)\n` : diff;
  const material = path.join(tmp, 'material.md');
  writeFileSync(
    material,
    `# The owner's request\n\n${request}\n\n# The commits since ${base.slice(0, 8)}, which the push sends\n\n\`\`\`diff\n${shown}\`\`\`\n`,
  );
  const prompt = buildPrompt(readFileSync(path.join(ROOT, 'scripts', 'second-look.md'), 'utf8'), material);
  try {
    const answer = askFirstAvailable(ORDER[pick.depth], (model) =>
      parseReply(
        run('agy', [
          '-p',
          prompt,
          '--output-format',
          'json',
          '--model',
          model,
          '--print-timeout',
          TIMEOUT,
          '--add-dir',
          tmp,
        ]),
      ),
    );
    return `Second look by ${byLine({ ...answer, ...pick })}\n\n${answer.response}`;
  } catch (err) {
    return `Second look skipped: ${err.message}`;
  }
}

const request = process.argv.slice(2).join(' ').trim();
if (!request) {
  console.error(USAGE);
  process.exit(2);
}
const tmp = mkdtempSync(path.join(os.tmpdir(), 'second-look-'));
try {
  console.log(secondLook(request, tmp));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
