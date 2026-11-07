// How the second look talks to agy: which model reviews what, what every prompt starts with, and how a reply is
// read. The same rules are in terminal-dusk/tools/gemini/agy.mjs and blockchain-technology-course/tools/agy.mjs:
// change all three. Types: agy.d.mts.
// Where agy is not installed (a cloud session), the Gemini models are asked through the Gemini API instead.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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

// The Gemini API, for a session without agy (in the cloud). It has the Gemini models only, under their own ids;
// Claude's are passed over. It reads no files and runs nothing, so the prompt carries what agy would have read
// by itself (the repo's rules for Gemini, CONTEXT) and the material, and its answer says it saw only those.
export const API = 'https://generativelanguage.googleapis.com/v1beta/models';
export const API_MODELS = { [ARGON]: 'gemini-4-argon', [FLASH]: 'gemini-3.8-flash' };
const REPO = path.resolve(import.meta.dirname, '..', '..');
// The files the review prompts judge against, which agy reads by itself; a folder (ending in /) is its .md files.
export const CONTEXT = ['ARCHITECTURE.md', '.agents/rules/'];

const API_HEADLESS =
  'You are answering through the Gemini API: you cannot read files or run commands, so this prompt is ' +
  'everything you have: the repository rules, then the task, then its material. A change you cannot judge ' +
  'without a file this prompt does not include is never passed: report it, naming the file, as a blocking ' +
  'finding in the format the task asks for (for a rail audit, as a loosening).';
const MATERIAL = /\nThe material is in (.+)\. Read all of it before answering\.\n$/;
// The line the callers put where they cut a long diff; inside a diff line (+, - or space first) it is not a cut.
const TRUNCATED = /^\.\.\. \(diff truncated; read the rest from disk\)$/m;
export const API_NOTE =
  '_Answered through the Gemini API, which cannot read the repository: this review saw only the material._';

// An error that would fail the same way on every model, so askFirstAvailable stops instead of passing it on.
const stop = (message) => Object.assign(new Error(message), { stop: true });

// A buildPrompt prompt rewritten for the API: the repo's rules first, told it can read nothing, and the material
// file's text in place of its path. Material that leaves part of the change on disk, or none at all, is refused.
export function apiPrompt(
  prompt,
  read = (file) => readFileSync(file, 'utf8'),
  context = CONTEXT,
  list = (dir) => readdirSync(path.join(REPO, dir)),
) {
  const text = prompt.startsWith(HEADLESS) ? API_HEADLESS + prompt.slice(HEADLESS.length) : prompt;
  const m = MATERIAL.exec(text);
  if (!m) throw stop('the Gemini API cannot read the repository, and this audit gave it no material');
  const material = read(m[1]);
  if (TRUNCATED.test(material))
    throw stop('the Gemini API cannot read the rest of a truncated diff from disk, so it would review part of it');
  const files = context.flatMap((f) =>
    f.endsWith('/') ? list(f).filter((n) => n.endsWith('.md')).sort().map((n) => f + n) : [f],
  );
  const rules = files.map((file) => `## ${file}\n\n${read(path.join(REPO, file)).trim()}\n`).join('\n');
  return `# The repository's rules\n\n${rules}\n# The task\n\n${text.slice(0, m.index)}\n\n# The material, in full\n\n${material}\n`;
}

// For an audit that must read the repository (a whole-repo audit): askModel's `api`, refusing.
export const NO_API = () => {
  throw stop('the Gemini API cannot read the repository, which this audit reads');
};

// askModel's `api` for what an audit reviews (pickDepth's kind). A whole-repo audit and a spec audit read files the
// API cannot, so they wait for agy; only a change, whose diff is the material, goes to the API.
export const apiFor = (kind) => (kind === 'repo' || kind === 'spec' ? NO_API : undefined);

// Reads one generateContent reply ({ status, text }) and returns the answer, or throws why not. By status: busy
// (429, 5xx) passes to the next model; anything else (no credit, a bad key, a wrong model id, a
// refused request) stops the review. Only a reply that finished (STOP) is an answer: any other ending is cut off.
export function parseApiReply({ status, text }) {
  let out;
  try {
    out = JSON.parse(text);
  } catch {
    if (/ran out of time/.test(text)) throw new Error(text.trim());
    if (status === 429 || status >= 500) throw new Error(`the Gemini API is overloaded (${status})`);
    throw stop(`the Gemini API could not be reached (${status || 'no answer'}): ${text.trim().split('\n')[0]}`);
  }
  if (out.error) {
    const said = out.error.message ?? '';
    const code = out.error.code ?? status;
    if (code === 429 || code >= 500) throw new Error(`the Gemini API is overloaded (${code}): ${said}`);
    if (code === 404) throw stop(`the Gemini API has no model by that id (404): ${said}`);
    if (code === 402) throw stop(`the Gemini API project has no credit left: ${said}`);
    throw stop(`the Gemini API refused the request (${code}): ${said}`);
  }
  const reply = out.candidates?.[0];
  const why = out.promptFeedback?.blockReason ?? reply?.finishReason ?? 'none';
  if (why === 'MAX_TOKENS') throw new Error('the model ran out of room before finishing its answer');
  if (why !== 'STOP') throw stop(`the model gave no finished answer (Gemini API reason ${why})`);
  const answer = (reply.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!answer) throw stop('the model gave no answer (Gemini API reason STOP)');
  return answer;
}

// The audits run synchronously, so the request goes from a child node and this waits for it. The key reaches the
// child in its environment, never on its command line. node:https rather than fetch, whose 5-minute wait for
// headers is shorter than a deep review; it tunnels through HTTPS_PROXY itself, which node:https alone ignores.
const POST = `
const http = require("node:http");
const https = require("node:https");
const tls = require("node:tls");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d)).on("end", () => {
  const { url, body, timeout } = JSON.parse(input);
  let sent = false;
  const done = (status, text) => {
    if (sent) return;
    sent = true;
    // Exit once the answer is out, so nothing left open (such as the tunnel) holds the child until the time limit.
    process.stdout.write(JSON.stringify({ status, text }), () => process.exit(0));
  };
  const target = new URL(url);
  const headers = { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY };
  const send = (options) => {
    const req = https.request(url, { method: "POST", headers, timeout, ...options }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d)).on("end", () => done(res.statusCode, text)).on("error", (e) => done(0, e.message));
    });
    req.on("timeout", () => req.destroy(new Error("the model ran out of time before finishing its answer")));
    req.on("error", (e) => done(0, e.message));
    req.end(JSON.stringify(body));
  };
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const skip = (process.env.NO_PROXY || process.env.no_proxy || "").split(",").map((s) => s.trim().replace(/^\\./, ""));
  const direct = ["localhost", "127.0.0.1", "::1"].includes(target.hostname) ||
    skip.some((s) => s === "*" || (s && (target.hostname === s || target.hostname.endsWith("." + s))));
  if (!proxy || direct) return send({});
  // Through the proxy, as cloud sessions require: a CONNECT tunnel, then TLS to the API inside it.
  const p = new URL(proxy);
  const auth = p.username
    ? { "proxy-authorization": "Basic " + Buffer.from(decodeURIComponent(p.username) + ":" + decodeURIComponent(p.password)).toString("base64") }
    : {};
  const hostPort = target.hostname + ":" + (target.port || 443);
  const connect = http.request({ host: p.hostname, port: p.port || 80, method: "CONNECT", path: hostPort, headers: { host: hostPort, ...auth } });
  connect.on("connect", (res, socket) => {
    // A cut tunnel reaches the request through its TLS socket. This listener only keeps a stray error on the raw
    // socket (as when the tunnel sat unused and the proxy cut it) from crashing the child with no answer.
    socket.on("error", () => {});
    if (res.statusCode !== 200) return done(0, "the proxy refused the tunnel (" + res.statusCode + ")");
    // No agent: only then does node:https use createConnection. (agent: false makes a new agent that ignores it
    // and goes direct, leaving the tunnel idle until the proxy cuts it.)
    send({ createConnection: () => tls.connect({ socket, servername: target.hostname }) });
  });
  connect.on("error", (e) => done(0, "the proxy could not be reached: " + e.message));
  connect.end();
});`;
const API_TIMEOUT_MS = 10 * 60_000;

export function postApi(url, body, key, spawn = spawnSync) {
  const r = spawn(process.execPath, ['-e', POST], {
    input: JSON.stringify({ url, body, timeout: API_TIMEOUT_MS }),
    env: { ...process.env, GEMINI_API_KEY: key },
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: API_TIMEOUT_MS + 60_000,
  });
  if (r.error?.code === 'ETIMEDOUT') return { status: 0, text: 'the model ran out of time before finishing its answer' };
  if (r.error) return { status: 0, text: r.error.message };
  try {
    return JSON.parse(r.stdout);
  } catch {
    // A crash prints a stack: its "Error: ..." line says why, where the first line is only where it was thrown.
    const stderr = (r.stderr || '').trim();
    const why = stderr.split('\n').find((line) => /^\w*Error\b/.test(line));
    return { status: 0, text: why ?? (stderr || 'the request gave no answer') };
  }
}

// Returns how askModel asks a model through the Gemini API, or null when GEMINI_API_KEY is not set. The answer
// ends with API_NOTE, so whoever reads the review knows it saw only the material.
export function geminiApi(key = process.env.GEMINI_API_KEY, post = postApi, read = undefined, context = CONTEXT) {
  if (!key) return null;
  return (prompt, model) => {
    const id = API_MODELS[model];
    if (!id) throw new Error('this model is not on the Gemini API');
    const body = {
      contents: [{ role: 'user', parts: [{ text: apiPrompt(prompt, read, context) }] }],
      generationConfig: { thinkingConfig: { thinkingLevel: EFFORT }, maxOutputTokens: 65_536 },
    };
    return `${parseApiReply(post(`${API}/${id}:generateContent`, body, key))}\n\n${API_NOTE}`;
  };
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
  [/ran out of room/, 'ran out of room for its answer'],
  [/not allowed to do/, 'tried a command it may not run'],
  [/not on the Gemini API/, 'is not on the Gemini API'],
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
