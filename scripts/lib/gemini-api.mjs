// The Gemini API half of agy.mjs: how a model is asked through the API where agy is not installed (a cloud session).
// Split out of agy.mjs; the same file is in all three repos (blockchain-technology-course/tools/gemini-api.mjs,
// terminal-dusk/tools/gemini/gemini-api.mjs, YODC/scripts/lib/gemini-api.mjs): change all three.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ARGON, EFFORT, FLASH, HEADLESS } from './agy.mjs';

// The Gemini API, for a session without agy (in the cloud). It has the Gemini models only, under their own ids;
// Claude's are passed over. It reads no files and runs nothing, so the prompt carries what agy would have read
// by itself (the repo's rules for Gemini, CONTEXT) and the material, and its answer says it saw only those.
export const API = 'https://generativelanguage.googleapis.com/v1beta/models';
// A function, not a constant: agy.mjs and this file import each other, and the ids are read only when a model is asked.
export const apiModels = () => ({
  [ARGON]: 'gemini-4-argon',
  [FLASH]: 'gemini-3.8-flash',
});
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
    f.endsWith('/')
      ? list(f)
          .filter((n) => n.endsWith('.md'))
          .sort()
          .map((n) => f + n)
      : [f],
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
  if (r.error?.code === 'ETIMEDOUT')
    return {
      status: 0,
      text: 'the model ran out of time before finishing its answer',
    };
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
    const id = apiModels()[model];
    if (!id) throw new Error('this model is not on the Gemini API');
    const body = {
      contents: [{ role: 'user', parts: [{ text: apiPrompt(prompt, read, context) }] }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: EFFORT },
        maxOutputTokens: 65_536,
      },
    };
    return `${parseApiReply(post(`${API}/${id}:generateContent`, body, key))}\n\n${API_NOTE}`;
  };
}
