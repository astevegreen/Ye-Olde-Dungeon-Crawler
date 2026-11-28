// How the second look talks to agy: which model reviews what, what every prompt starts with, and how a reply is
// read. The same rules are in terminal-dusk/tools/gemini/agy.mjs, blockchain-technology-course/tools/agy.mjs and
// Korean/tools/gemini/agy.mjs (the flashcards repo): change all four. Types: agy.d.mts.
// Where agy is not installed (a cloud session), the Gemini models are asked through the Gemini API instead.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { geminiApi } from './gemini-api.mjs';

// Every model runs at high effort; agy names the effort in the model id.
export const EFFORT = 'high';

// Which models review (owner, 19 Nov 2026): Gemini's fast, cheap models, the "flash" kind, and the two Claude
// models agy offers, Opus and Sonnet, whose agy usage the owner spends on nothing else. Gemini's deep models
// (Argon, Carbon, Neon) have too little usage to spend on reviews: they are never asked.
//
// LIGHT is the one list to edit when Google releases a model. It holds the fast models, newest first, as agy
// names them without the effort. Only the family, the words after the version, is matched against what `agy models` lists, so:
// - a retired model (3.8 Flash) drops out by itself, and may stay in this list;
// - a new version of a known family ("gemini-4.5-hydrogen") is picked up by itself, ahead of the older version;
// - a new fast family is one new line at the top.
export const LIGHT = ['gemini-4-hydrogen', 'gemini-3.8-flash'];
// The families that are never asked. A Gemini family in neither list is new: unsorted() names it for the report.
export const HEAVY = ['argon', 'carbon', 'neon'];

// The family is what follows the version, and may be more than one word ("flash-lite").
const family = (base) => base.replace(/^gemini-\d+(?:\.\d+)*-/, '');
// A Gemini model at this effort, as agy lists it: gemini-<version>-<family>-<effort>.
const LISTED = new RegExp(String.raw`^gemini-(\d+(?:\.\d+)*)-([a-z]+(?:-[a-z]+)*)-${EFFORT}$`);
// Versions ("3.8", "5-5") newest first, number by number, so "10" is newer than "9". No localeCompare: its order
// depends on the locale and ICU build; a tie on every number falls back to a code-unit comparison.
export function newerFirst(a, b) {
  const nums = (v) => String(v).split(/[.-]/).map(Number);
  const [x, y] = [nums(a), nums(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (y[i] ?? -1) - (x[i] ?? -1);
    if (d) return d;
  }
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

// The model ids in what `agy models` prints: one "<id><tab><name>" line per model.
export const parseModels = (stdout) => [...(stdout ?? '').matchAll(/^(\S+)\t/gm)].map((m) => m[1]);

// The models agy offers, or null when it cannot say (agy missing, as in a cloud session, or not signed in).
export function listModels(run) {
  const r = run(['models']);
  const ids = r.error || r.status !== 0 ? [] : parseModels(r.stdout);
  return ids.length > 0 ? ids : null;
}

// The models a review asks, in order: the fast families newest first, and within a family the newest version
// first. `listed` is listModels' answer; with none, LIGHT is asked as written, and a retired model passes to the next.
export function lightModels(listed, light = LIGHT) {
  if (!listed) return light.map((base) => `${base}-${EFFORT}`);
  const families = light.map(family);
  return listed
    .map((id) => ({ id, m: LISTED.exec(id) }))
    .filter(({ m }) => m && families.includes(m[2]))
    .sort((a, b) => families.indexOf(a.m[2]) - families.indexOf(b.m[2]) || newerFirst(a.m[1], b.m[1]))
    .map(({ id }) => id);
}

// The listed Gemini models whose family is in neither LIGHT nor HEAVY: released since this file was last edited.
export function unsorted(listed, light = LIGHT, heavy = HEAVY) {
  const known = [...light.map(family), ...heavy];
  return (listed ?? []).filter((id) => LISTED.test(id) && !known.includes(LISTED.exec(id)[2]));
}

// Claude's two models in agy, as written when agy cannot list its models. With a list, the newest version of each
// is read from it ("claude-opus-6-high" needs no edit here), and one agy no longer offers is left out.
export const CLAUDE = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' };
export function claudeModel(listed, kind, claude = CLAUDE) {
  if (!listed) return `${claude[kind]}-${EFFORT}`;
  const named = new RegExp(String.raw`^claude-${kind}-(\d+(?:-\d+)*)-${EFFORT}$`);
  const versions = listed.filter((id) => named.test(id)).sort((a, b) => newerFirst(named.exec(a)[1], named.exec(b)[1]));
  return versions[0] ?? null;
}

// Who is asked, in order, by kind of review. The fast Gemini models are `light`, newest first.
// - deep: Opus, the deepest reader left, then Gemini, then Sonnet.
// - standard: Gemini first, then Sonnet; Opus last.
// - rail: the rail audit. Opus, then Gemini; never Sonnet, since the Claude reviewer already covers that family
//   (owner, 28 Oct 2026, whose order was Argon, Opus, then Flash).
// - gemini: Gemini alone, for a script whose point is Gemini's view.
export const ORDERS = {
  deep: ({ light, opus, sonnet }) => [opus, ...light, sonnet],
  standard: ({ light, opus, sonnet }) => [...light, sonnet, opus],
  rail: ({ light, opus }) => [opus, ...light],
  gemini: ({ light }) => light,
};

// What a script asks: { models, note }. `note` is a line for the report when agy lists a Gemini family nobody has
// sorted, or none of the fast ones. With nobody to ask, the review cannot run, and the error says which list to edit.
export function reviewModels(run, order = 'gemini') {
  const listed = listModels(run);
  const light = lightModels(listed);
  const none = `agy lists none of the fast Gemini models this script knows (${LIGHT.join(', ')}): add the current one to LIGHT in scripts/lib/agy.mjs`;
  const opus = claudeModel(listed, 'opus');
  const sonnet = claudeModel(listed, 'sonnet');
  const models = ORDERS[order]({ light, opus, sonnet }).filter(Boolean);
  if (models.length === 0) throw new Error(none);
  const fresh = unsorted(listed);
  const notes = [
    light.length === 0 ? `No Gemini model reviews: ${none}.` : '',
    fresh.length
      ? `New Gemini model in agy: ${fresh.join(', ')}. No review asks it yet: if it is a fast, cheap model, add it to LIGHT in scripts/lib/agy.mjs; if not, to HEAVY.`
      : '',
  ];
  return { models, note: notes.filter(Boolean).join('\n') };
}

// A model's name for the report, from its id: "gemini-4-hydrogen-high" is "Gemini 4 Hydrogen (high)".
export function modelName(model) {
  const m = /^(.+)-(low|medium|high|xhigh|max)$/.exec(model);
  if (!m) return model;
  const name = m[1]
    .replace(/(\d)-(?=\d)/g, '$1.')
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
  return `${name} (${m[2]})`;
}

// A change of more than this many lines (added plus removed) gets a deep review wherever it is.
export const LARGE = 300;

// How deep a review must be, from what it reviews, with the reason in words for the report. The depth picks
// the order the models are asked in (ORDERS), and is named with its reason in the report.
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

// The files a unified diff changes, and how many lines it adds or removes. A rename or copy names both paths, the
// old one first (from the `rename from` / `copy from` and `... to` lines, else the header's `a/` and `b/` paths):
// moving a rail or a high-risk file out of its folder removes it there, so it is audited like any other change to it.
export function diffStats(diff) {
  const files = [];
  let entry = null;
  let lines = 0;
  for (const raw of diff.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const head = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    const moved = entry && !entry.changed && /^(?:rename|copy) (from|to) (.+)$/.exec(line);
    if (head) {
      entry = { file: head[2], from: head[1] === head[2] ? undefined : head[1], changed: 0 };
      files.push(entry);
    } else if (moved) entry[moved[1] === 'from' ? 'from' : 'file'] = moved[2];
    else if (/^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line)) {
      lines++;
      if (entry) entry.changed++;
    }
  }
  return { files: files.flatMap(({ file, from }) => (from && from !== file ? [from, file] : [file])), lines };
}

// How long agy may run before it is cut off (its --print-timeout); the prompt tells the model so it can pace itself.
export const TIMEOUT = '10m';

// agy runs headless, so it cannot ask before a command; it blocks anything its settings don't allow and the
// model then ends with an empty answer. Its settings allow reading files but almost no commands (on 24 Oct 2026,
// only an exact `git status`; Opus was blocked running one), so the material carries what git would show.
// Each file read takes about 20 seconds, and a model that keeps following references never gets to answer.
export const HEADLESS =
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
  if (r.error)
    throw new Error(
      r.error.code === 'ENOENT' ? 'agy is not installed, and GEMINI_API_KEY is not set for the Gemini API' : r.error.message,
    );
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error(`agy exited ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n')[0]}`);
  }
  // Past --print-timeout agy returns whatever the model had written so far; never post that as a finished audit.
  // The conversation keeps what the model read, so askModel can resume it for an answer.
  const timedOut =
    /print timeout after (\S+)/i.exec(r.stderr ?? '')?.[1] ??
    (out.finished_reason === 'print_timeout' ? (/after (\S+)/.exec(out.error ?? '')?.[1] ?? 'its limit') : null);
  if (timedOut)
    throw Object.assign(new Error(`the model ran out of time (${timedOut}) before finishing its answer`), {
      conversation: out.conversation_id,
      timedOut: true,
    });
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

// What a model is told when its conversation is resumed after it ran out of time.
const LATE =
  'Your time is up: read nothing more and run no command. From what you have already read, write your answer ' +
  'now, in the format the task asked for.';

// How long a resumed run may take. A resume that reads nothing still took about 4 minutes on Flash (5 Nov 2026).
export const RESUME_TIMEOUT = '6m';

const agyArgs = (prompt, model, extra, timeout = TIMEOUT) => [
  '-p',
  prompt,
  '--output-format',
  'json',
  '--model',
  model,
  '--print-timeout',
  timeout,
  ...extra,
];

// Asks one model through `run(args)` (agy, run to the end) and returns its answer, or throws why not; `extra`
// adds flags such as --add-dir. A model can be cut off with no answer though it read everything: by trying a
// command (Opus ended a rail audit on `echo blocked`, 28 Oct), or by running out of time (Flash on a 401-line deep
// review, 5 Nov). Either way its conversation is resumed once, told why, so the reading is not thrown away.
// Where agy is not installed and GEMINI_API_KEY is set, `api` asks the model instead (see geminiApi).
export function askModel(run, prompt, model, extra = [], api = geminiApi()) {
  const first = run(agyArgs(prompt, model, extra));
  if (first.error?.code === 'ENOENT' && api) return api(prompt, model);
  try {
    return parseReply(first);
  } catch (err) {
    if (!err.conversation) throw err;
    const resume = [...extra, '--conversation', err.conversation];
    if (err.timedOut) return parseReply(run(agyArgs(LATE, model, resume, RESUME_TIMEOUT)));
    return parseReply(run(agyArgs(REFUSED, model, resume)));
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
// limit, it tried a command (models differ in keeping to "run no command"), or Google has retired it.
const PASS_ON = [
  [/quota|rate.?limit|resource.?exhausted|\b429\b|overloaded|capacity/i, 'was too busy'],
  [/ran out of time/, 'ran out of time'],
  [/handshake did not finish/, 'could not be reached through the proxy tunnel in time'],
  [/ran out of room/, 'ran out of room for its answer'],
  [/not allowed to do/, 'tried a command it may not run'],
  [/not on the Gemini API/, 'is not on the Gemini API'],
  // agy's words for an id it does not have (19 Nov 2026): reached only when `agy models` could not be read.
  [/not recognized as a known model/, 'is no longer offered by agy'],
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
      if (err.stop) throw new Error(`${modelName(model)}: ${err.message}`, { cause: err });
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
