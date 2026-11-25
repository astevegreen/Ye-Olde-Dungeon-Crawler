// The audit comment scripts/gemini-audit.mjs posts: the model-list note (a new Gemini family in agy, or none of the
// fast ones) has to reach the comment, not only stderr, or a log nobody reads is the only place it shows.
import { afterAll, expect, it } from 'vitest';
import type { AgyRun, QuotaStore } from '../lib/agy.mjs';
import { askGemini, cleanUp, report } from '../gemini-audit.mjs';

afterAll(cleanUp);

const MODELS = [
  'gemini-4-hydrogen-high\tGemini 4 Hydrogen (High)',
  'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
  'claude-opus-5-5-high\tClaude Opus 5.5 (High)',
  'claude-sonnet-5-5-high\tClaude Sonnet 5.5 (High)',
  '',
].join('\n');
// No model is out of quota, and nothing is written down.
const store: QuotaStore = { outUntil: () => null, markOut: () => {} };

// A fake agy: lists `listed`, and answers every review with `response`.
const agy =
  (listed: string, response: string) =>
  (args: string[]): AgyRun =>
    args[0] === 'models'
      ? { status: 0, stdout: listed, stderr: '' }
      : { status: 0, stdout: JSON.stringify({ status: 'SUCCESS', response }), stderr: '' };

it('names a new Gemini family in agy in the posted comment', () => {
  const listed = `${MODELS}gemini-5-helium-high\tGemini 5 Helium (High)\n`;
  const answer = askGemini('weekly-audit', null, { kind: 'repo' }, agy(listed, 'All clear.'), store);
  const comment = report('weekly 2026-11-25', answer);
  expect(comment).toMatch(/^> New Gemini model in agy: gemini-5-helium-high\. .*LIGHT in scripts\/lib\/agy\.mjs/m);
  expect(comment).toMatch(/\n\nAll clear\.$/);
});

it('says which list to edit when agy lists no fast Gemini model', () => {
  const listed = MODELS.replace(/^gemini.*\n/gm, '');
  const answer = askGemini('weekly-audit', null, { kind: 'repo' }, agy(listed, 'Done.'), store);
  expect(report('weekly', answer)).toMatch(/^> No Gemini model reviews: .*add the current one to LIGHT/m);
});

it('posts only the by-line and the answer when the model list needs nothing', () => {
  const answer = askGemini('weekly-audit', null, { kind: 'repo' }, agy(MODELS, 'All clear.'), store);
  expect(answer.note).toBe('');
  const comment = report('weekly', answer);
  expect(comment).not.toMatch(/^>/m);
  expect(comment).toMatch(/^\*\*Gemini audit: weekly\*\*\n_Gemini 4 Hydrogen.*_\n\nAll clear\.$/);
});

it('quotes a note of two lines line by line', () => {
  const answer = { model: 'gemini-4-hydrogen-high', depth: 'standard' as const, why: 'x', note: 'one\ntwo', response: 'r' };
  expect(report('weekly', answer)).toMatch(/\n> one\n> two\n\nr$/);
});
