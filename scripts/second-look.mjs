// `node scripts/second-look.mjs [--rails-only] [--range <base>..<head>] "<the owner's words>"`: a second review of
// the change about to be pushed, by another model through agy (headless and read-only), run beside the reviewer
// agent. It reviews origin/main..HEAD, the commits the push sends, or the range given. A change touching a rail
// (scripts/lib/second-look.mjs) also gets a deep rail audit first, by Argon or Opus only, asking whether it loosens
// a check; --rails-only runs that audit alone. It prints the findings, then one line,
// `Verdict: <ship|fix|owner|retry>: <why>`, and exits 0 only for ship: a [blocker] holds the push like a reviewer
// blocker, a loosened rail holds it for the owner, and a review that did not run (no model answered, git failed)
// waits to be run again.
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
import { RAILS, RAIL_MODELS, railFiles, verdict } from './lib/second-look.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USAGE = 'usage: node scripts/second-look.mjs [--rails-only] [--range <base>..<head>] "<the owner\'s words>"';
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
// A git command's output; a git that fails throws, so a failure never reads as an empty change that ships.
function git(...args) {
  const r = run('git', args);
  if (r.error || r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.error?.message ?? r.stderr ?? '').trim().split('\n')[0]}`);
  return r.stdout;
}

// The commits since this branch left origin/main, or the range given. Uncommitted and untracked files stay out: the
// push leaves them behind, and the main checkout holds untracked files no task made (docs/retros/ on 24 Oct).
function change(range) {
  const [from, head] = range ? range.split('..') : ['origin/main', 'HEAD'];
  const base = git('merge-base', from, head).trim();
  return { base, head, diff: git('diff', '--no-ext-diff', `${base}..${head}`) };
}

// Asks agy with one prompt file and the material, trying the models in order; { answer, model, by } or { error }.
function ask(promptFile, material, pick, models, tmp) {
  const file = path.join(tmp, `${path.basename(promptFile, '.md')}-material.md`);
  writeFileSync(file, material);
  const prompt = buildPrompt(readFileSync(path.join(ROOT, 'scripts', promptFile), 'utf8'), file);
  try {
    const answer = askFirstAvailable(models, (model) =>
      parseReply(
        run('agy', ['-p', prompt, '--output-format', 'json', '--model', model, '--print-timeout', TIMEOUT, '--add-dir', tmp]),
      ),
    );
    return { answer: answer.response, model: answer.model, by: byLine({ ...answer, ...pick }) };
  } catch (err) {
    return { error: err.message };
  }
}

function secondLook(request, { railsOnly, range }, tmp) {
  let found;
  try {
    found = change(range);
  } catch (err) {
    return { text: `Second look not run: ${err.message}`, decided: { verdict: 'retry', why: `${err.message}; nothing is pushed unreviewed` } };
  }
  const { base, head, diff } = found;
  if (!diff.trim()) return { text: 'Second look skipped: no commits to push since origin/main.', decided: { verdict: 'ship', why: 'nothing to push' } };
  const stats = diffStats(diff);
  const rails = railFiles(stats.files);
  const shown = diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n... (diff truncated; read the rest from disk)\n` : diff;
  const what = `the commits ${base.slice(0, 8)}..${head}, which the push sends`;
  const out = [];
  let rail = null;
  if (rails.length) {
    // Every rail change gets the deep review, whatever its size, and only from Argon or Opus.
    const pick = pickDepth({ kind: 'change', ...stats }, RAILS);
    rail = ask(
      'rail-audit.md',
      `# The request\n\n${request}\n\n# The rail files it touches\n\n${rails.map((f) => `- ${f}`).join('\n')}\n\n# ${what}\n\n\`\`\`diff\n${shown}\`\`\`\n`,
      pick,
      RAIL_MODELS,
      tmp,
    );
    out.push(rail.error ? `Rail audit not run: ${rail.error}` : `Rail audit by ${rail.by}\n\n${rail.answer}`);
  }
  let look = null;
  if (!railsOnly) {
    const pick = pickDepth({ kind: 'change', ...stats }, DEEP_PATHS);
    look = ask('second-look.md', `# The owner's request\n\n${request}\n\n# ${what}\n\n\`\`\`diff\n${shown}\`\`\`\n`, pick, ORDER[pick.depth], tmp);
    out.push(look.error ? `Second look not run: ${look.error}` : `Second look by ${look.by}\n\n${look.answer}`);
  }
  return { text: out.join('\n\n'), decided: verdict({ rails, rail, look }) };
}

const args = process.argv.slice(2);
const railsOnly = args.includes('--rails-only');
const at = args.indexOf('--range');
const range = at >= 0 ? args[at + 1] : undefined;
const flagged = new Set(at >= 0 ? [at, at + 1] : []);
const request = args
  .filter((a, k) => a !== '--rails-only' && !flagged.has(k))
  .join(' ')
  .trim();
if (!request || (at >= 0 && !/^[^.\s]+\.\.[^.\s]+$/.test(range ?? ''))) {
  console.error(USAGE);
  process.exit(2);
}
const tmp = mkdtempSync(path.join(os.tmpdir(), 'second-look-'));
try {
  const { text, decided } = secondLook(request, { railsOnly, range }, tmp);
  console.log(`${text}\n\nVerdict: ${decided.verdict}: ${decided.why}`);
  process.exitCode = decided.verdict === 'ship' ? 0 : 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
