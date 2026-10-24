// Scores the `reviewer` agent (.claude/agents/reviewer.md) on known answers: sprint tasks it passed
// that later broke, and tasks that never did (reviewer-cases.json). Each run is a fresh
// `claude -p` in this checkout, so it uses this checkout's reviewer; results go to the gitignored
// .prompts/evals/reviewer/. Scoring is a judgement call, so it is done by reading the verdicts and
// recorded in scores.json there; `report` prints the table.
//
//   node scripts/eval/reviewer-eval.mjs run [--case <id>]... [--runs 2] [--parallel 3] [--max-tokens 3000000]
//   node scripts/eval/reviewer-eval.mjs report
//
// `run` runs the first case once on its own and stops if that run read and wrote more than
// --max-tokens (input, cache reads and writes, and output, across every model the run used). A run
// whose result file exists is skipped, so an interrupted eval resumes. Run it from PowerShell:
// `claude` must be on PATH.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, '.prompts', 'evals', 'reviewer');
const { cases: CASES } = JSON.parse(readFileSync(new URL('./reviewer-cases.json', import.meta.url), 'utf8'));

const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};
const only = rest.flatMap((arg, i) => (rest[i - 1] === '--case' ? [arg] : []));

if (command === 'run') await run();
else if (command === 'report') report();
else {
  console.error('usage: reviewer-eval.mjs run [--case <id>]... [--runs 2] [--parallel 3] [--max-tokens 3000000] | report');
  process.exit(2);
}

async function run() {
  const runs = Number(flag('--runs', '2'));
  const parallel = Number(flag('--parallel', '3'));
  const maxTokens = Number(flag('--max-tokens', '3000000'));
  const cases = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
  if (cases.length === 0) throw new Error(`no case named ${only.join(', ')}`);
  mkdirSync(OUT, { recursive: true });
  for (const c of cases) branch(c);

  const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, k) => ({ c, k: k + 1 })));
  const todo = jobs.filter(({ c, k }) => !existsSync(resultPath(c, k)));
  console.log(`${todo.length} of ${jobs.length} runs to do; results in ${OUT}`);
  if (todo.length === 0) return;

  // The first run alone: its cost decides whether the rest start.
  const first = await runOne(todo[0].c, todo[0].k);
  if (first.tokens.total > maxTokens) {
    console.log(`stopped: ${todo[0].c.id} run ${todo[0].k} used ${first.tokens.total} tokens, over --max-tokens ${maxTokens}`);
    process.exit(1);
  }
  const queue = todo.slice(1);
  await Promise.all(
    Array.from({ length: Math.min(parallel, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await runOne(job.c, job.k);
    }),
  );
}

// eval/<id> at the task's commit: origin/main already holds the task and its later fix, so the
// reviewer diffs from the commit's parent instead.
function branch(c) {
  const sha = git('rev-parse', `${c.sha}^{commit}`);
  const ref = `eval/${c.id}`;
  let at = null;
  try {
    at = git('rev-parse', '--verify', '--quiet', `refs/heads/${ref}`);
  } catch {
    at = null;
  }
  if (!at) git('branch', ref, sha);
  else if (at !== sha) throw new Error(`${ref} points at ${at}, not ${sha}; delete it or rename the case`);
}

function prompt(c) {
  const head = `eval/${c.id}`;
  const inner =
    c.spec === 'body'
      ? `Request: ${issueBody(c.issue)}\nRange: ${c.sha}^..${head}`
      : `Issue ${c.issue}, branch ${head}, Base: ${c.sha}^.`;
  return [
    'Use the reviewer agent. Give it exactly the text between the two --- lines as its prompt, and reply with its answer only.',
    '---',
    inner,
    '---',
  ].join('\n');
}

function runOne(c, k) {
  const text = prompt(c);
  const started = Date.now();
  console.log(`start ${c.id} run ${k}`);
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'stream-json', '--verbose'], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      writeFileSync(resultPath(c, k).replace(/\.json$/, '.jsonl'), stdout);
      const parsed = parseStream(stdout);
      const result = {
        case: c.id,
        kind: c.kind,
        run: k,
        exit: code,
        prompt: text,
        seconds: Math.round((Date.now() - started) / 1000),
        ...parsed,
        stderr: stderr.trim().slice(0, 2000),
      };
      writeFileSync(resultPath(c, k), `${JSON.stringify(result, null, 2)}\n`);
      console.log(`done  ${c.id} run ${k}: ${result.verdict.summary}, ${result.tokens.total} tokens, ${result.seconds}s`);
      resolve(result);
    });
    child.stdin.end(text);
  });
}

// The stream's lines. The reviewer's own answer is the message of its SubagentHandback call (an
// event whose parent_tool_use_id is the Agent call that named it); with no handback, the Agent
// call's tool result. The final `result` line carries the run's usage across every model,
// subagents included.
function parseStream(stdout) {
  const lines = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  let callId = null;
  let handback = '';
  let toolResult = '';
  const reviewerModels = new Set();
  for (const e of lines) {
    const content = Array.isArray(e.message?.content) ? e.message.content : [];
    const inReviewer = Boolean(callId) && e.parent_tool_use_id === callId;
    for (const part of content) {
      if (part?.type === 'tool_use' && ['Agent', 'Task'].includes(part.name) && part.input?.subagent_type === 'reviewer') callId = part.id;
      if (part?.type === 'tool_use' && inReviewer && part.name === 'SubagentHandback') handback = String(part.input?.message ?? '');
      if (part?.type === 'tool_result' && callId && part.tool_use_id === callId) {
        toolResult = Array.isArray(part.content) ? part.content.map((x) => x?.text ?? '').join('\n') : String(part.content ?? '');
      }
    }
    if (e.type === 'assistant' && inReviewer && e.message?.model) reviewerModels.add(e.message.model);
  }
  const answer = handback || toolResult;
  const final = lines.findLast((e) => e.type === 'result') ?? {};
  const usage = Object.values(final.modelUsage ?? {});
  const sum = (key) => usage.reduce((s, m) => s + (m[key] ?? 0), 0);
  const tokens = {
    input: sum('inputTokens'),
    cacheRead: sum('cacheReadInputTokens'),
    cacheWrite: sum('cacheCreationInputTokens'),
    output: sum('outputTokens'),
  };
  tokens.total = tokens.input + tokens.cacheRead + tokens.cacheWrite + tokens.output;
  return {
    usedReviewer: Boolean(callId),
    reviewerModels: [...reviewerModels],
    verdict: summarise(answer || final.result || ''),
    answer,
    mainResult: final.result ?? '',
    tokens,
    costUSD: final.total_cost_usd ?? null,
    permissionDenials: (final.permission_denials ?? []).map((d) => `${d.tool_name}: ${String(d.tool_input?.command ?? '').slice(0, 160)}`),
  };
}

function summarise(text) {
  const t = text.trim();
  const blockers = (t.match(/\[blocker\]/gi) ?? []).length;
  const minors = (t.match(/\[minor\]/gi) ?? []).length;
  const kind = /^PASS\b/.test(t) ? 'PASS' : /^CONCERNS\b/m.test(t) ? 'CONCERNS' : 'unreadable';
  return { kind, blockers, minors, summary: kind === 'CONCERNS' ? `CONCERNS ${blockers}b/${minors}m` : kind };
}

function report() {
  const scoresFile = join(OUT, 'scores.json');
  const scores = existsSync(scoresFile) ? JSON.parse(readFileSync(scoresFile, 'utf8')) : {};
  const rows = [['case', 'kind', 'run 1', 'run 2', 'tokens (run 1 / run 2)']];
  for (const c of CASES) {
    const cells = [1, 2].map((k) => {
      if (!existsSync(resultPath(c, k))) return { text: '-', tokens: '-' };
      const r = JSON.parse(readFileSync(resultPath(c, k), 'utf8'));
      const score = scores[`${c.id}.run${k}`]?.score;
      return { text: `${r.verdict.summary}${score ? `, ${score}` : ''}${r.usedReviewer ? '' : ' (no reviewer call)'}`, tokens: String(r.tokens.total) };
    });
    rows.push([c.id, c.kind, cells[0].text, cells[1].text, `${cells[0].tokens} / ${cells[1].tokens}`]);
  }
  for (const row of rows) console.log(`| ${row.join(' | ')} |`);
}

function resultPath(c, k) {
  return join(OUT, `${c.id}.run${k}.json`);
}

function issueBody(n) {
  return execFileSync('gh', ['issue', 'view', String(n), '--json', 'body', '--jq', '.body'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function git(...args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
