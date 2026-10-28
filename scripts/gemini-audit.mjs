// Hands Gemini (agy, headless) read-only material and posts its answer to GitHub itself, as Terminal Dusk's
// tools/gemini-audit.mjs does. Gemini never gets GitHub access or write permission; a failed run posts one
// "skipped" line. Changes are reviewed by scripts/second-look.mjs before a push, so there is no pull-request mode.
// Usage: node scripts/gemini-audit.mjs specs <issue numbers...> | weekly | narrative [--dry-run]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ORDER, askFirstAvailable, askModel, buildPrompt, byLine, pickDepth } from './lib/agy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USAGE = 'usage: node scripts/gemini-audit.mjs specs <issue numbers...> | weekly | narrative [--dry-run]';
// The queue (scripts/sprint/queue-rules.mjs) skips comments that start with this, so an audit never reads as a
// sprint step.
const MARKER = '<!-- gemini-audit -->';
const PINNED = { weekly: 'Gemini weekly audit', narrative: 'How the code is organised' };

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const [mode, ...numbers] = argv.filter((a) => a !== '--dry-run');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'gemini-audit-'));

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 11 * 60_000,
  });
}
function gh(...args) {
  const r = run('gh', args);
  if (r.status !== 0)
    throw new Error(
      `gh ${args.slice(0, 2).join(' ')} failed: ${(r.stderr || r.error?.message || '').trim().split('\n')[0]}`,
    );
  return r.stdout;
}

// what: what is reviewed, for pickDepth. Returns { model, response, passed, depth, why }, so the comment can say
// which model answered and why it was chosen.
function askGemini(promptName, material, what) {
  const text = readFileSync(path.join(ROOT, 'scripts', 'gemini-prompts', `${promptName}.md`), 'utf8');
  let file;
  if (material) {
    file = path.join(tmp, 'material.md');
    writeFileSync(file, material);
  }
  const prompt = buildPrompt(text, file);
  const pick = pickDepth(what);
  const answer = askFirstAvailable(ORDER[pick.depth], (model) =>
    askModel((args) => run('agy', args), prompt, model, ['--add-dir', tmp]),
  );
  return { ...answer, ...pick };
}

function post(number, text) {
  const body = `${MARKER}\n${text}\n`;
  if (DRY) return console.log(`--- would comment on issue #${number} ---\n${body}`);
  const file = path.join(tmp, `comment-${number}.md`);
  writeFileSync(file, body);
  gh('issue', 'comment', String(number), '--body-file', file);
}

// The answering model may be a Claude model when a Gemini model ahead of it in the order could not answer;
// the by-line names it.
const report = (label, answer) => `**Gemini audit: ${label}**\n_${byLine(answer)}_\n\n${answer.response}`;
const skipped = (err) => `Gemini audit skipped: ${err.message}`;

function issueText(n) {
  const i = JSON.parse(gh('issue', 'view', String(n), '--json', 'number,title,body'));
  return `# #${i.number} ${i.title}\n\n${i.body}\n`;
}

function pinnedIssue(title) {
  const found = JSON.parse(
    gh('issue', 'list', '--state', 'open', '--search', `"${title}" in:title`, '--json', 'number,title'),
  ).find((i) => i.title === title);
  if (found) return found.number;
  if (DRY) return 0;
  const url = gh(
    'issue',
    'create',
    '--title',
    title,
    '--body',
    'One comment per run from scripts/gemini-audit.mjs.',
  ).trim();
  const n = Number(url.split('/').pop());
  // GitHub pins three issues at most; an unpinned audit issue still works.
  try {
    gh('issue', 'pin', String(n));
  } catch (err) {
    console.error(err.message);
  }
  return n;
}

function specs() {
  if (!numbers.length) throw new Error('specs needs at least one issue number');
  const material = numbers.map(issueText).join('\n---\n\n');
  let answer;
  try {
    answer = askGemini('spec-audit', material, { kind: 'spec' });
  } catch (err) {
    for (const n of numbers) post(n, skipped(err));
    return;
  }
  // The prompt asks for one "## #<n>" section per issue; post each issue its own section.
  for (const n of numbers) {
    const section = new RegExp(String.raw`^## #${n}\b[\s\S]*?(?=^## #\d+|(?![\s\S]))`, 'm').exec(answer.response)?.[0];
    post(n, report('spec', { ...answer, response: section ?? answer.response }));
  }
}

function repoWide(promptName, label) {
  const n = pinnedIssue(PINNED[mode]);
  const date = new Date().toISOString().slice(0, 10);
  // The model can run no command, so the narrative's "what changed since last month" reads a month of git log here.
  const log =
    mode === 'narrative'
      ? `# git log, last month\n\n${run('git', ['log', '--since=1 month ago', '--no-merges', '--date=short', '--format=%h %ad %s']).stdout}`
      : null;
  let text;
  try {
    text = report(`${label} ${date}`, askGemini(promptName, log, { kind: 'repo' }));
  } catch (err) {
    text = skipped(err);
  }
  post(n, text);
}

try {
  if (mode === 'specs') specs();
  else if (mode === 'weekly') repoWide('weekly-audit', 'weekly');
  else if (mode === 'narrative') repoWide('narrative', 'how the code is organised,');
  else throw new Error(USAGE);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
