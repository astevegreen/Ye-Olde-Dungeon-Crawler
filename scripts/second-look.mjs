// `node scripts/second-look.mjs [--rails-only] [--range <base>..<head>] "<the owner's words>"`: a second review of
// the change about to be pushed, by another model through agy (headless and read-only), run last, after the gates
// and the reviewer's fix round. It reviews origin/main..HEAD, the commits the push sends, or the range given. A
// change touching a rail (scripts/lib/second-look.mjs) is asked the rail question in the same call: whether it
// loosens a check, answered by Opus or Gemini's fast models (never Sonnet), with the owner's words to say which
// loosening they asked for; --rails-only asks the rail question alone. Both ask Gemini's fast models and agy's Claude
// models, as `agy models` lists them (lib/agy.mjs, LIGHT and ORDERS; owner, 19 Nov 2026): never Gemini's deep
// models, whose usage is too small. To spend less quota (owner, 28 Nov 2026), a change agy can't add to (docs,
// tests, lockfiles, or a small change off the high-risk paths and the rails) is skipped, and a run after an
// earlier one on the same branch and request builds on it (lib/agy.mjs, carryOver): a small fix keeps the earlier
// pass, and a bigger one is reviewed alone. Each run adds one line to the quota ledger (lib/agy.mjs, LEDGER_FILE).
// It prints the findings, then one line, `Verdict: <ship|fix|owner|retry>: <why>`, and exits 0 only for ship: a
// [blocker] holds the push like a reviewer blocker, a loosened rail holds it for the owner, and a review that did
// not run (no model answered, git failed) waits to be run again.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  appendLedger,
  askFirstAvailable,
  askModel,
  buildPrompt,
  byLine,
  carryOver,
  deltaPreamble,
  diffStats,
  pickDepth,
  readLedger,
  reviewModels,
  skipReason,
} from './lib/agy.mjs';
import { CUT_LINE, NO_API } from './lib/gemini-api.mjs';
import { RAILS, blockerLines, priorReview, railFiles, verdict } from './lib/second-look.mjs';

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
const isAncestor = (a, b) => run('git', ['merge-base', '--is-ancestor', a, b]).status === 0;

// The commits since this branch left origin/main, or the range given. Uncommitted and untracked files stay out: the
// push leaves them behind, and the main checkout holds untracked files no task made (docs/retros/ on 24 Oct).
function change(range) {
  const [from, to] = range ? range.split('..') : ['origin/main', 'HEAD'];
  const base = git('merge-base', from, to).trim();
  const head = git('rev-parse', to).trim();
  return { base, head, diff: git('diff', '--no-ext-diff', `${base}..${head}`) };
}

// An earlier review's commit can be built on when it lies on this branch: after the branch's base, before HEAD,
// with no merge commit since (a merge brings in changes nobody reviewed as part of this change).
const usableFrom = (base, head) => (sha) =>
  sha !== head && isAncestor(base, sha) && isAncestor(sha, head) && git('rev-list', '--merges', `${sha}..${head}`).trim() === '';

// Asks agy once with the prompt text and the material, trying the models in order; { answer, model, by, ... } or
// { error, ... }, with the seconds, tokens and models passed over for the ledger. models: a function, called inside
// the try, so a model list agy cannot give is a review that did not run. api: askModel's `api` (the Gemini API where
// agy is not installed); a rail question passes NO_API.
function ask(text, material, pick, models, tmp, api = undefined) {
  const file = path.join(tmp, 'material.md');
  writeFileSync(file, material);
  const prompt = buildPrompt(text, file);
  try {
    const answer = askFirstAvailable(models(), (model, meter) =>
      askModel((args) => run('agy', args), prompt, model, ['--add-dir', tmp], api, meter),
    );
    return { answer: answer.response, model: answer.model, by: byLine({ ...answer, ...pick }), ...answer };
  } catch (err) {
    return { error: err.message, seconds: err.seconds, tokens: err.tokens };
  }
}

const prompt = (name) => readFileSync(path.join(ROOT, 'scripts', name), 'utf8').trim();

function secondLook(request, { railsOnly, range }, tmp) {
  let found;
  try {
    found = change(range);
  } catch (err) {
    return { text: `Second look not run: ${err.message}`, decided: { verdict: 'retry', why: `${err.message}; nothing is pushed unreviewed` } };
  }
  const { base, head } = found;
  if (!found.diff.trim()) return { text: 'Second look skipped: no commits to push since origin/main.', decided: { verdict: 'ship', why: 'nothing to push' } };
  // A --rails-only run never read the rest of the change, so it gets its own hash and is never built on by a full one.
  const hash = createHash('sha256')
    .update(`${railsOnly ? 'rails-only:' : ''}${request}`)
    .digest('hex')
    .slice(0, 16);
  const ledger = (fields) => appendLedger({ repo: 'yodc', pr: null, sha: head, base, request: hash, ...fields });
  let diff = found.diff;
  let stats = diffStats(diff);
  let rails = railFiles(stats.files);
  let pick = pickDepth({ kind: 'change', ...stats }, DEEP_PATHS);
  const skip = railsOnly ? null : skipReason(stats, { deep: pick.depth === 'deep', rails: rails.length > 0 });
  if (skip) {
    ledger({ mode: 'skip', depth: pick.depth, model: null, passed: [], seconds: 0, tokens: null, verdict: 'ship', why: skip });
    return { text: `Second look skipped: ${skip}; the reviewer and CI still run.`, decided: { verdict: 'ship', why: `agy skipped: ${skip}` } };
  }
  let mode = 'full';
  let preamble = '';
  let what = `the commits ${base.slice(0, 8)}..${head.slice(0, 8)}, which the push sends`;
  let prior = null;
  try {
    prior = priorReview(readLedger(), hash, usableFrom(base, head));
  } catch {
    prior = null;
  }
  if (prior) {
    const delta = git('diff', '--no-ext-diff', `${prior.sha}..${head}`);
    const dStats = diffStats(delta);
    const dRails = railFiles(dStats.files);
    const dPick = pickDepth({ kind: 'change', ...dStats }, DEEP_PATHS);
    const plan = carryOver(prior, dStats, { deep: dPick.depth === 'deep', rails: dRails.length > 0 });
    const noRail = railsOnly && plan.mode === 'delta' && !dRails.length;
    if (plan.mode === 'carry' || noRail) {
      const why = noRail ? `no rail changed since ${prior.sha.slice(0, 8)}, whose rail answer stands` : plan.why;
      ledger({ mode: 'carry', depth: dPick.depth, model: null, passed: [], seconds: 0, tokens: null, verdict: 'ship', from: prior.sha, why });
      return { text: `Second look ${why}.`, decided: { verdict: 'ship', why } };
    }
    if (plan.mode === 'delta') {
      mode = 'delta';
      diff = delta;
      stats = dStats;
      rails = dRails;
      pick = dPick;
      preamble = `${deltaPreamble(prior)}\n`;
      what = `the commits ${prior.sha.slice(0, 8)}..${head.slice(0, 8)}, made since that review`;
    }
  }
  const shown = diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n${CUT_LINE}\n` : diff;
  // agy is asked for its models once; a note (a Gemini family nobody has sorted, or no fast one) ends the report.
  let note = '';
  const models = (order) => () => {
    const picked = reviewModels((args) => run('agy', args), order);
    note = picked.note;
    return picked.models;
  };
  // A rail change is asked the rail question in the same call, whatever its size, by Opus, then Gemini's fast models,
  // never Sonnet (lib/agy.mjs, ORDERS.rail). Never through the Gemini API, which sees only the diff and the rules
  // files: rails wait for agy (owner, 7 Nov: "Rails wait for the PC").
  const railed = rails.length > 0;
  if (railed) pick = pickDepth({ kind: 'change', ...stats }, RAILS);
  const text = railsOnly ? prompt('rail-audit.md') : railed ? `${prompt('second-look.md')}\n\n${prompt('rail-audit.md')}` : prompt('second-look.md');
  const railList = railed ? `# The rail files it touches\n\n${rails.map((f) => `- ${f}`).join('\n')}\n\n` : '';
  const material = `${preamble}# What the owner asked for, in their own words\n\n${request}\n\n${railList}# ${what}\n\n\`\`\`diff\n${shown}\`\`\`\n`;
  const answer = ask(text, material, pick, models(railed ? 'rail' : pick.depth), tmp, railed ? NO_API : undefined);
  const label = railsOnly ? 'Rail audit' : railed ? 'Second look and rail audit' : 'Second look';
  const out = [answer.error ? `${label} not run: ${answer.error}` : `${label} by ${answer.by}\n\n${answer.answer}`];
  if (note) out.push(note);
  const decided = verdict({ rails, rail: railed ? answer : null, look: railsOnly ? null : answer });
  ledger({
    mode,
    depth: railed ? 'rail' : pick.depth,
    model: answer.model ?? null,
    passed: (answer.passed ?? []).map((p) => p.model),
    seconds: answer.seconds ?? null,
    tokens: answer.tokens ?? null,
    verdict: decided.verdict,
    blockers: answer.answer ? blockerLines(answer.answer) : [],
    ...(prior && mode === 'delta' ? { from: prior.sha } : {}),
  });
  return { text: out.join('\n\n'), decided };
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
