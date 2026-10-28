// How the second look talks to agy: which model reviews what, what every prompt starts with, and how a reply is
// read. The same rules are in terminal-dusk/tools/gemini/agy.mjs and blockchain-technology-course/tools/agy.mjs:
// change all three. Types: agy.d.mts.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Every model runs at high effort; agy names the effort in the model id.
export const EFFORT = 'high';
export const ARGON = `gemini-4-argon-${EFFORT}`;
export const OPUS = `claude-opus-5-5-${EFFORT}`;
export const FLASH = `gemini-3.8-flash-${EFFORT}`;
export const SONNET = `claude-sonnet-5-5-${EFFORT}`;
const NAMES = {
  [ARGON]: 'Gemini 4 Argon',
  [OPUS]: 'Claude Opus 5.5',
  [FLASH]: 'Gemini 3.8 Flash',
  [SONNET]: 'Claude Sonnet 5.5',
};
export const modelName = (model) => `${NAMES[model] ?? model} (${EFFORT})`;

// The order each depth of review asks the models in; a model that is out of usage passes to the next.
// Argon reads deepest but has the smallest quota, so only a deep review spends it; Opus is the next deepest.
// A standard review starts on Flash, which is fast and has usage to spare, and never spends Argon's.
export const ORDER = {
  deep: [ARGON, OPUS, FLASH, SONNET],
  standard: [FLASH, SONNET, OPUS],
};

// A change of more than this many lines (added plus removed) gets a deep review wherever it is.
export const LARGE = 300;

// How deep a review must be, from what it reviews, with the reason in words for the report.
// kind: "spec" (a plan, before any code), "repo" (a whole-repo audit) or "change" (a diff's files and lines).
// deepPaths: the path prefixes where a mistake costs most in this repo.
export function pickDepth({ kind, files = [], lines = 0 }, deepPaths = []) {
  if (kind === 'spec') return { depth: 'deep', why: 'it is a spec, where a gap is cheapest to fix' };
  if (kind === 'repo')
    return { depth: 'standard', why: 'it reads the whole repo, which has to finish inside the time limit' };
  const hit = files.find((f) => deepPaths.some((p) => f.startsWith(p)));
  if (hit) return { depth: 'deep', why: `it touches ${hit}` };
  if (lines > LARGE) return { depth: 'deep', why: `it changes ${lines} lines` };
  return { depth: 'standard', why: `it changes ${lines} lines and touches none of the high-risk paths` };
}

// The files a unified diff changes, and how many lines it adds or removes.
export function diffStats(diff) {
  const files = [...diff.matchAll(/^diff --git a\/.+? b\/(.+)$/gm)].map((m) => m[1]);
  const lines = diff.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).length;
  return { files, lines };
}

// How long agy may run before it is cut off (its --print-timeout); the prompt tells the model so it can pace itself.
export const TIMEOUT = '10m';

// agy runs headless, so it cannot ask before a command; it blocks anything its settings don't allow and the
// model then ends with an empty answer. Its settings allow reading files but almost no commands (on 24 Oct 2026,
// only an exact `git status`; Opus was blocked running one), so the material carries what git would show.
// Each file read takes about 20 seconds, and a model that keeps following references never gets to answer.
const HEADLESS =
  'You are running headless. You can read any file in the repository, but you cannot run any command, ' +
  'not even git: every command is blocked, and a blocked command ends your turn with no answer, ' +
  "so never try one: read files instead (for example, to count a file's lines). " +
  `You have ${TIMEOUT} in total and each file read takes about 20 seconds. Read the material first, then ` +
  'at most 15 other files, choosing the ones that matter most, and leave time to write your answer. ' +
  'An answer that is not finished in time is thrown away.';

export function buildPrompt(text, materialFile) {
  let prompt = `${HEADLESS}\n\n${text.trim()}`;
  if (materialFile) prompt += `\nThe material is in ${materialFile}. Read all of it before answering.\n`;
  return prompt;
}

// Reads one `agy -p ... --output-format json` run (a spawnSync result) and returns the model's answer, or throws why not.
export function parseReply(r) {
  if (r.error) throw new Error(r.error.code === 'ENOENT' ? 'agy is not installed' : r.error.message);
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error(`agy exited ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`);
  }
  // Past --print-timeout agy returns whatever the model had written so far; never post that as a finished audit.
  const timedOut = /print timeout after (\S+)/i.exec(r.stderr ?? '')?.[1];
  if (timedOut) throw new Error(`the model ran out of time (${timedOut}) before finishing its answer`);
  if (out.status === 'SUCCESS' && out.response?.trim()) return out.response.trim();
  if (out.error) throw new Error(out.error);
  const denied = (out.denied_actions ?? []).map((a) => a.display_name ?? a.action);
  if (denied.length)
    throw Object.assign(
      new Error(`the model gave no answer after trying something it is not allowed to do (${denied.join(', ')})`),
      { conversation: out.conversation_id },
    );
  throw new Error(`the model gave no answer (agy status ${out.status})`);
}

// What a model is told when its conversation is resumed after a refused command.
const REFUSED =
  'Your command was refused: no command can run here, so do not try another. From what you have read, and ' +
  'reading files if you must, write your answer now, in the format the task asked for.';

const agyArgs = (prompt, model, extra) => [
  '-p',
  prompt,
  '--output-format',
  'json',
  '--model',
  model,
  '--print-timeout',
  TIMEOUT,
  ...extra,
];

// Asks one model through `run(args)` (agy, run to the end) and returns its answer, or throws why not; `extra`
// adds flags such as --add-dir. A model that tries a command is cut off with no answer though it may have read
// everything (Opus ended a rail audit on `echo blocked`, 28 Oct), so its conversation is resumed once, told why.
export function askModel(run, prompt, model, extra = []) {
  try {
    return parseReply(run(agyArgs(prompt, model, extra)));
  } catch (err) {
    if (!err.conversation) throw err;
    return parseReply(run(agyArgs(REFUSED, model, [...extra, '--conversation', err.conversation])));
  }
}

// agy says when a used-up quota comes back ("Resets in 151h45m8s"); without that, the model is tried again in an hour.
export function resetsAt(message, now) {
  const m = /resets in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i.exec(message);
  const [h, min, s] = [m?.[1], m?.[2], m?.[3]].map((n) => Number(n ?? 0));
  return new Date(now + (((h * 60 + min) * 60 + s) * 1000 || 3_600_000));
}

// Remembers which models are out of usage and until when, so a review skips them instead of spending about
// 40 seconds finding out again. One file serves every repo on this PC, because the quota is the account's.
export const QUOTA_FILE = path.join(os.tmpdir(), 'agy-quota.json');

export function quotaFile(file = QUOTA_FILE) {
  const read = () => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return {};
    }
  };
  return {
    outUntil(model, now) {
      const t = Date.parse(read()[model]);
      return t > now ? new Date(t) : null;
    },
    markOut(model, until) {
      // The whole file, then a rename: three repos' reviews share it, so a reader never sees half of one.
      const tmp = `${file}.${process.pid}.tmp`;
      try {
        writeFileSync(tmp, JSON.stringify({ ...read(), [model]: until.toISOString() }, null, 2));
        renameSync(tmp, file);
      } catch {
        // A review never fails because it could not write down a quota.
      }
    },
  };
}

// A used-up quota says so, or says when it resets. A per-minute rate limit can mention a quota too
// ("Quota exceeded for quota metric ... per minute"), so the word alone only means busy.
const USED_UP = /individual quota|resets in/i;
// Not used up, so tried again next time, but this model won't answer now: it is too busy, too slow for the time
// limit (Argon and Opus are the slowest), or it tried a command (models differ in keeping to "run no command").
const PASS_ON = [
  [/quota|rate.?limit|resource.?exhausted|\b429\b|overloaded|capacity/i, 'was too busy'],
  [/ran out of time/, 'ran out of time'],
  [/not allowed to do/, 'tried a command it may not run'],
];

const when = (d) =>
  d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const passedOver = (p) => `${modelName(p.model)} ${p.until ? `is out of usage until ${when(p.until)}` : p.why}`;

// Asks each model in turn until one answers, skipping any the store knows is out of usage. Running out of
// usage, or any reason in PASS_ON, moves on to the next model; anything else (agy missing, not signed in)
// would fail the same way on every model, so it is thrown with the model's name in front.
// Returns { model, response, passed }: passed lists the models it went past, for the report.
export function askFirstAvailable(models, ask, store = quotaFile(), now = Date.now) {
  const passed = [];
  for (const model of models) {
    const until = store.outUntil(model, now());
    if (until) {
      passed.push({ model, until });
      continue;
    }
    try {
      return { model, response: ask(model), passed };
    } catch (err) {
      const why = PASS_ON.find(([pattern]) => pattern.test(err.message))?.[1];
      if (USED_UP.test(err.message)) {
        const reset = resetsAt(err.message, now());
        store.markOut(model, reset);
        passed.push({ model, until: reset });
      } else if (why) passed.push({ model, why });
      else throw new Error(`${modelName(model)}: ${err.message}`, { cause: err });
    }
  }
  throw new Error(`no model answered: ${passed.map(passedOver).join('; ')}`);
}

// One line for the report: which model answered, how deep a review it was and why, and whom it stood in for.
export function byLine({ model, depth, why, passed = [] }) {
  return [`${modelName(model)}, a ${depth} review because ${why}.`, ...passed.map((p) => `${passedOver(p)}.`)].join(
    ' ',
  );
}
