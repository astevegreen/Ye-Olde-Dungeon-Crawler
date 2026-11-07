// The Gemini API fallback in agy.mjs: used only where agy is not installed (a cloud session) and a key is set.
import { describe, expect, it } from 'vitest';
import {
  API,
  ARGON,
  FLASH,
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
const ok = (answer: string): ApiReply => ({
  status: 200,
  text: JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: answer }] }, finishReason: 'STOP' }],
  }),
});
const failed = (status: number, message: string): ApiReply => ({
  status,
  text: JSON.stringify({ error: { code: status, message } }),
});

interface Sent {
  url: string;
  body: { contents: { parts: { text: string }[] }[]; generationConfig: { thinkingConfig: unknown } };
  key: string;
}
// A fake post that records each request and answers from a list.
function posts(...replies: ApiReply[]) {
  const sent: Sent[] = [];
  const post = (url: string, body: unknown, key: string) => {
    sent.push({ url, body: body as Sent['body'], key });
    return replies[sent.length - 1];
  };
  return { post, sent };
}

const material = 'C:/tmp/second-look-x/material.md';
const read = (file: string) => {
  if (file !== material) throw new Error(`read ${file}`);
  return 'diff --git a/x b/x\n+one line';
};

describe('the Gemini API fallback', () => {
  it("says nothing can be read, and carries the material's text in place of its path", () => {
    const text = apiPrompt(buildPrompt('Review this change.', material), read);
    expect(text).toMatch(/^You are answering through the Gemini API: you cannot read files or run commands/);
    expect(text).not.toMatch(/You are running headless|each file read takes|The material is in/);
    expect(text).toMatch(/Review this change\.\n\nThe material follows, in full\.\n\ndiff --git a\/x b\/x\n\+one line\n$/);
  });

  it('refuses an audit with no material, since the API cannot read the repository', () => {
    expect(() => apiPrompt(buildPrompt('Audit the repo.'), read)).toThrow(/cannot read the repository/);
  });

  it('answers with the same model where agy is not installed and a key is set', () => {
    const { post, sent } = posts(ok('No findings.\n'));
    const api = geminiApi('test-key', post, read);
    expect(askModel(missing, buildPrompt('Review this.', material), FLASH, ['--add-dir', 'C:/tmp'], api)).toBe(
      'No findings.',
    );
    expect(sent[0].url).toBe(`${API}/gemini-3.8-flash:generateContent`);
    expect(sent[0].key).toBe('test-key');
    expect(sent[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'high' });
    expect(sent[0].body.contents[0].parts[0].text).toMatch(/\+one line\n$/);
  });

  it('is never asked while agy is installed, even with a key', () => {
    const run = () => ({ status: 0, stdout: JSON.stringify({ status: 'SUCCESS', response: 'From agy.' }), stderr: '' });
    const api = () => {
      throw new Error('the API was asked');
    };
    expect(askModel(run, 'Review this.', FLASH, [], api)).toBe('From agy.');
  });

  it('is absent without a key, and a missing agy then says how to use it', () => {
    expect(geminiApi('')).toBeNull();
    expect(() => askModel(missing, 'Review this.', FLASH, [], null)).toThrow(
      'agy is not installed, and GEMINI_API_KEY is not set for the Gemini API',
    );
    expect(() => parseReply({ error: { code: 'ENOENT' } })).toThrow('GEMINI_API_KEY is not set');
  });

  it("passes a deep review over a busy Argon and Claude's models to Flash", () => {
    const { post, sent } = posts(failed(429, 'Resource has been exhausted (e.g. check quota).'), ok('Deep findings.'));
    const api = geminiApi('test-key', post, read);
    const prompt = buildPrompt('Review this spec.', material);
    const result = askFirstAvailable(
      [ARGON, OPUS, FLASH, SONNET],
      (model) => askModel(missing, prompt, model, [], api),
      memory(),
      () => NOW,
    );
    expect(result.model).toBe(FLASH);
    expect(result.response).toBe('Deep findings.');
    expect(result.passed.map((p) => [p.model, p.why])).toEqual([
      [ARGON, 'was too busy'],
      [OPUS, 'is not on the Gemini API'],
    ]);
    expect(sent.map((s) => s.url)).toEqual([
      `${API}/gemini-4-argon:generateContent`,
      `${API}/gemini-3.8-flash:generateContent`,
    ]);
  });

  it('stops the review when the project has no credit, instead of passing it on', () => {
    // What the API answered on 2026-11-07, when the key's project had no prepaid credit.
    const broke = posts(failed(402, 'Your prepayment credits are depleted. Please go to AI Studio to manage billing.'));
    const api = geminiApi('test-key', broke.post, read);
    const ask = (model: string) => askModel(missing, buildPrompt('Review this.', material), model, [], api);
    expect(() => askFirstAvailable([FLASH, SONNET], ask, memory(), () => NOW)).toThrow(
      /^Gemini 3\.8 Flash \(high\): the Gemini API project has no credit left: Your prepayment credits/,
    );
    expect(broke.sent).toHaveLength(1);
  });

  it('reports a bad key, an unreachable API, a cut-off answer and an empty one', () => {
    expect(() => parseApiReply(failed(400, 'API key not valid.'))).toThrow(
      'the Gemini API answered 400: API key not valid.',
    );
    expect(() => parseApiReply({ status: 0, text: 'getaddrinfo ENOTFOUND' })).toThrow(
      'the Gemini API could not be reached (no answer): getaddrinfo ENOTFOUND',
    );
    const cut = { candidates: [{ content: { parts: [{ text: 'Half' }] }, finishReason: 'MAX_TOKENS' }] };
    expect(() => parseApiReply({ status: 200, text: JSON.stringify(cut) })).toThrow(/ran out of room/);
    const blocked = { promptFeedback: { blockReason: 'SAFETY' } };
    expect(() => parseApiReply({ status: 200, text: JSON.stringify(blocked) })).toThrow(
      'the model gave no answer (Gemini API reason SAFETY)',
    );
  });

  it('sends from a child node, and a refused connection comes back as a reason, not a crash', () => {
    const r = postApi('https://127.0.0.1:9/v1beta/models/x:generateContent', { contents: [] }, 'test-key');
    expect(r.status).toBe(0);
    expect(r.text).toMatch(/ECONNREFUSED/);
  });
});
