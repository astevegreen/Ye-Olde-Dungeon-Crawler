// The Gemini API fallback in agy.mjs: used only where agy is not installed (a cloud session) and a key is set.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import {
  API,
  API_NOTE,
  ARGON,
  CONTEXT,
  FLASH,
  NO_API,
  OPUS,
  SONNET,
  apiPrompt,
  askFirstAvailable,
  askModel,
  buildPrompt,
  geminiApi,
  parseApiReply,
  parseReply,
  postApi,
  type ApiReply,
} from '../lib/agy.mjs';

const NOW = Date.parse('2026-11-07T12:00:00Z');
const memory = () => ({ outUntil: () => null, markOut: () => {} });
const missing = () => ({ error: { code: 'ENOENT' } });
const ok = (answer: string, finishReason = 'STOP'): ApiReply => ({
  status: 200,
  text: JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: answer }] }, finishReason }],
  }),
});
const failed = (status: number, message: string): ApiReply => ({
  status,
  text: JSON.stringify({ error: { code: status, message } }),
});

type Post = (url: string, body: unknown, key: string) => ApiReply;
interface Sent {
  url: string;
  body: { contents: { parts: { text: string }[] }[]; generationConfig: { thinkingConfig: unknown } };
  key: string;
}
// A fake post that records each request and answers from a list.
function posts(...replies: ApiReply[]) {
  const sent: Sent[] = [];
  const post: Post = (url, body, key) => {
    sent.push({ url, body: body as Sent['body'], key });
    return replies[sent.length - 1];
  };
  return { post, sent };
}

const material = 'C:/tmp/second-look-x/material.md';
const DIFF = 'diff --git a/x b/x\n+one line';
// Reads the material, and any rules file as a stand-in that names the findings format.
const reader =
  (text = DIFF) =>
  (file: string) =>
    file === material ? text : `Start each finding with [blocker] or [note]. (${path.basename(file)})`;
const read = reader();
const viaApi = (post: Post, prompt: string) => (model: string) =>
  askModel(missing, prompt, model, [], geminiApi('k', post, read, []));

describe('the Gemini API fallback', () => {
  it("carries the repo's rules, the task and the material's text, and says nothing can be read", () => {
    const text = apiPrompt(buildPrompt('Review this change.', material), read, ['.agents/rules/project-rules.md']);
    expect(text).toMatch(/^# The repository's rules\n\n## \.agents\/rules\/project-rules\.md\n\nStart each finding/);
    expect(text).toMatch(/# The task\n\nYou are answering through the Gemini API: you cannot read files or run/);
    expect(text).not.toMatch(/You are running headless|each file read takes|The material is in/);
    expect(text).toMatch(/Review this change\.\n\n# The material, in full\n\ndiff --git a\/x b\/x\n\+one line\n$/);
  });

  it('gives the API the rules agy reads by itself, and they exist', () => {
    expect(CONTEXT).toEqual(['.agents/rules/project-rules.md']);
    for (const file of CONTEXT) expect(existsSync(path.join(import.meta.dirname, '..', '..', file))).toBe(true);
  });

  it('refuses an audit with no material, a truncated diff, and a whole-repo audit', () => {
    expect(() => apiPrompt(buildPrompt('Audit the repo.'), read, [])).toThrow(/cannot read the repository/);
    const cut = reader(`${DIFF}\n... (diff truncated; read the rest from disk)\n`);
    expect(() => apiPrompt(buildPrompt('Review this.', material), cut, [])).toThrow(/truncated diff/);
    const ask = (model: string) => askModel(missing, buildPrompt('Tour the code.', material), model, [], NO_API);
    expect(() => askFirstAvailable([ARGON, FLASH], ask, memory(), () => NOW)).toThrow(
      'Gemini 4 Argon (high): the Gemini API cannot read the repository, which this audit reads',
    );
  });

  it('answers with the same model where agy is not installed and a key is set, and says how', () => {
    const { post, sent } = posts(ok('No findings.\n'));
    const api = geminiApi('test-key', post, read, []);
    expect(askModel(missing, buildPrompt('Review this.', material), FLASH, ['--add-dir', 'C:/tmp'], api)).toBe(
      `No findings.\n\n${API_NOTE}`,
    );
    expect(sent[0].url).toBe(`${API}/gemini-3.8-flash:generateContent`);
    expect(sent[0].key).toBe('test-key');
    expect(sent[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'high' });
    expect(sent[0].body.contents[0].parts[0].text).toMatch(/\+one line\n$/);
  });

  it('is never asked while agy is installed, even with a key', () => {
    const run = () => ({ status: 0, stdout: JSON.stringify({ status: 'SUCCESS', response: 'From agy.' }), stderr: '' });
    expect(askModel(run, 'Review this.', FLASH, [], NO_API)).toBe('From agy.');
  });

  it('is absent without a key, and a missing agy then says how to use it', () => {
    expect(geminiApi('')).toBeNull();
    expect(() => askModel(missing, 'Review this.', FLASH, [], null)).toThrow(
      'agy is not installed, and GEMINI_API_KEY is not set for the Gemini API',
    );
    expect(() => parseReply({ error: { code: 'ENOENT' } })).toThrow('GEMINI_API_KEY is not set');
  });

  it("passes a busy model, a 5xx and a model the API lacks on; Claude's models cost no request", () => {
    const { post, sent } = posts(
      failed(429, 'Resource has been exhausted (e.g. check quota).'),
      failed(404, 'models/gemini-3.8-flash is not found'),
    );
    const ask = viaApi(post, buildPrompt('Review this spec.', material));
    expect(() => askFirstAvailable([ARGON, OPUS, FLASH, SONNET], ask, memory(), () => NOW)).toThrow(
      'no model answered: Gemini 4 Argon (high) was too busy; Claude Opus 5.5 (high) is not on the Gemini API; ' +
        'Gemini 3.8 Flash (high) is not on the Gemini API; Claude Sonnet 5.5 (high) is not on the Gemini API',
    );
    expect(sent).toHaveLength(2);
    expect(() => parseApiReply(failed(503, 'The model is overloaded.'))).toThrow(/overloaded \(503\)/);
  });

  it('passes a deep review over a busy Argon and Opus to Flash', () => {
    const { post } = posts(failed(429, 'Too many requests.'), ok('Deep findings.'));
    const ask = viaApi(post, buildPrompt('Review this spec.', material));
    const result = askFirstAvailable([ARGON, OPUS, FLASH, SONNET], ask, memory(), () => NOW);
    expect(result.model).toBe(FLASH);
    expect(result.response).toBe(`Deep findings.\n\n${API_NOTE}`);
    expect(result.passed.map((p) => [p.model, p.why])).toEqual([
      [ARGON, 'was too busy'],
      [OPUS, 'is not on the Gemini API'],
    ]);
  });

  it("stops the review on no credit, a bad key or a forbidden project, whatever Google's words say", () => {
    // The 402 is what the API answered on 2026-11-07, when the key's project had no prepaid credit.
    const replies: [ApiReply, RegExp][] = [
      [failed(402, 'Your prepayment credits are depleted. Please go to AI Studio.'), /no credit left/],
      [failed(400, 'API key not valid.'), /refused the request \(400\): API key not valid/],
      [failed(403, 'Quota project lacks capacity permission.'), /refused the request \(403\)/],
    ];
    for (const [reply, message] of replies) {
      const { post, sent } = posts(reply);
      const ask = viaApi(post, buildPrompt('Review this.', material));
      let thrown = '';
      try {
        askFirstAvailable([FLASH, ARGON], ask, memory(), () => NOW);
      } catch (err) {
        thrown = (err as Error).message;
      }
      expect(thrown).toMatch(/^Gemini 3\.8 Flash \(high\): /);
      expect(thrown).toMatch(message);
      expect(sent).toHaveLength(1);
    }
  });

  it('takes only a finished reply as an answer: a cut-off, blocked or empty one is reported', () => {
    for (const reason of ['SAFETY', 'RECITATION', 'OTHER', 'BLOCKLIST'])
      expect(() => parseApiReply(ok('[note] half a review', reason))).toThrow(
        `the model gave no finished answer (Gemini API reason ${reason})`,
      );
    expect(() => parseApiReply(ok('Half', 'MAX_TOKENS'))).toThrow(/ran out of room/);
    const blocked = { promptFeedback: { blockReason: 'SAFETY' } };
    expect(() => parseApiReply({ status: 200, text: JSON.stringify(blocked) })).toThrow(/reason SAFETY/);
    expect(() => parseApiReply(ok('  '))).toThrow(/gave no answer/);
    expect(parseApiReply(ok('Fine.'))).toBe('Fine.');
  });

  it('stops on an unreachable API, and passes on a request that ran out of time', () => {
    expect(() => parseApiReply({ status: 0, text: 'getaddrinfo ENOTFOUND' })).toThrow(
      'the Gemini API could not be reached (no answer): getaddrinfo ENOTFOUND',
    );
    let late: (Error & { stop?: boolean }) | undefined;
    try {
      parseApiReply({ status: 0, text: 'the model ran out of time before finishing its answer' });
    } catch (err) {
      late = err as Error & { stop?: boolean };
    }
    expect(late?.message).toMatch(/ran out of time/);
    expect(late?.stop).toBeUndefined();
  });

  it('hands the key to the child node in its environment, never on its command line', () => {
    let seen: { cmd: string; args: string[]; opts: { input: string; env: Record<string, string | undefined> } } | undefined;
    postApi(`${API}/x:generateContent`, { contents: [] }, 'secret-key', (cmd, args, opts) => {
      seen = { cmd, args, opts };
      return { stdout: JSON.stringify({ status: 200, text: '{}' }) };
    });
    expect(seen?.cmd).toBe(process.execPath);
    expect(JSON.stringify(seen?.args)).not.toContain('secret-key');
    expect(seen?.opts.input).not.toContain('secret-key');
    expect(seen?.opts.env.GEMINI_API_KEY).toBe('secret-key');
  });

  it('sends from a child node, and a refused connection comes back as a reason, not a crash', () => {
    const r = postApi('https://127.0.0.1:9/v1beta/models/x:generateContent', { contents: [] }, 'test-key');
    expect(r.status).toBe(0);
    expect(r.text).toMatch(/ECONNREFUSED/);
  });
});
