import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CLAUDE,
  HEAVY,
  LIGHT,
  ORDERS,
  RESUME_TIMEOUT,
  askFirstAvailable,
  askModel,
  buildPrompt,
  byLine,
  claudeModel,
  diffStats,
  lightModels,
  listModels,
  modelName,
  newerFirst,
  parseModels,
  parseReply,
  pickDepth,
  quotaFile,
  resetsAt,
  reviewModels,
  unsorted,
  type AgyRun,
  type Order,
  type QuotaStore,
} from '../lib/agy.mjs';

// Sample ids, as agy names them. Only the fast Gemini ones are ever asked (agy.mjs, LIGHT); the rest stand for any
// model a quota file or an old report may still name.
const HYDROGEN = 'gemini-4-hydrogen-high';
const FLASH = 'gemini-3.8-flash-high';
const ARGON = 'gemini-4-argon-high';
const OPUS = 'claude-opus-5-5-high';
const SONNET = 'claude-sonnet-5-5-high';

// The message agy actually returned when the Argon quota ran out (2026-10-16).
const QUOTA =
  'Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 151h45m8s.';
const NOW = Date.parse('2026-10-24T12:00:00Z');
const HOUR = 3_600_000;

/** A quota memory held in a plain object, so no test touches the real file. */
function memory(out: Record<string, number> = {}): QuotaStore & { out: Record<string, number> } {
  return {
    out,
    outUntil: (model, now) => (out[model] > now ? new Date(out[model]) : null),
    markOut: (model, until) => {
      out[model] = until.getTime();
    },
  };
}

function ask(models: string[], outcomes: Record<string, string | Error>, store = memory()) {
  const asked: string[] = [];
  const result = askFirstAvailable(
    models,
    (model) => {
      asked.push(model);
      const outcome = outcomes[model];
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    store,
    () => NOW,
  );
  return { result, asked, store };
}

// What `agy models` printed on 2026-11-19, two days after Neon's release, with 3.8 Flash still offered.
const AGY_MODELS = [
  'Fetching available models...',
  'gemini-4-neon-high\tGemini 4 Neon (High)',
  'gemini-4-neon-xhigh\tGemini 4 Neon (XHigh)',
  'gemini-4-argon-medium\tGemini 4 Argon (Medium)',
  'gemini-4-argon-high\tGemini 4 Argon (High)',
  'gemini-4-hydrogen-high\tGemini 4 Hydrogen (High)',
  'gemini-4-hydrogen-xhigh\tGemini 4 Hydrogen (XHigh)',
  'gemini-4-hydrogen-low\tGemini 4 Hydrogen (Low)',
  'gemini-pro-orchestrator-neon\tOrchestrator (Neon)',
  'gemini-pro-orchestrator-g1-pro\tOrchestrator (Argon)',
  'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
  'gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)',
  'claude-opus-5-5-high\tClaude Opus 5.5 (High)',
  'claude-sonnet-5-5-high\tClaude Sonnet 5.5 (High)',
  'gpt-oss-120b-medium\tGPT-OSS 120B (Medium)',
  '',
].join('\n');
const LISTED = parseModels(AGY_MODELS);
const agyLists =
  (stdout: string) =>
  (args: string[]): AgyRun => {
    expect(args).toEqual(['models']);
    return { status: 0, stdout, stderr: '' };
  };
const noAgy = (): AgyRun => ({ error: { code: 'ENOENT' } });

describe('which model reviews what', () => {
  it("runs every model at high effort, and reads its name from its id", () => {
    for (const model of lightModels(null)) expect(model).toMatch(/-high$/);
    for (const model of lightModels(LISTED)) expect(model).toMatch(/-high$/);
    expect(modelName(HYDROGEN)).toBe('Gemini 4 Hydrogen (high)');
    expect(modelName(FLASH)).toBe('Gemini 3.8 Flash (high)');
    expect(modelName(ARGON)).toBe('Gemini 4 Argon (high)');
    expect(modelName(OPUS)).toBe('Claude Opus 5.5 (high)');
    expect(modelName(SONNET)).toBe('Claude Sonnet 5.5 (high)');
    expect(modelName('a')).toBe('a');
  });

  // Owner, 19 Nov 2026: "I want to have the 2nd reviewer only use the less expensive "flash" type models-- the latest
  // one of these is now Hydrogen."
  it("asks only Gemini's fast models, newest first: never Neon or Argon", () => {
    expect(LISTED).toHaveLength(14);
    expect(lightModels(LISTED)).toEqual([HYDROGEN, FLASH]);
    expect(reviewModels(agyLists(AGY_MODELS))).toEqual({ models: [HYDROGEN, FLASH], note: '' });
    expect(LIGHT[0]).toBe('gemini-4-hydrogen');
    for (const heavy of ['argon', 'carbon', 'neon']) expect(HEAVY, heavy).toContain(heavy);
  });

  it('drops a retired model by itself, and asks a new version of a fast family first, with no edit', () => {
    const retired = LISTED.filter((id) => !id.includes('flash'));
    expect(lightModels(retired)).toEqual([HYDROGEN]);
    const newer = [...LISTED, 'gemini-4.5-hydrogen-high', 'gemini-10-flash-high', 'gemini-5-neon-high'];
    expect(lightModels(newer)).toEqual(['gemini-4.5-hydrogen-high', HYDROGEN, 'gemini-10-flash-high', FLASH]);
  });

  it('names a Gemini family nobody has sorted in a note, and does not ask it', () => {
    const listed = [...LISTED, 'gemini-5-helium-high', 'gemini-5-helium-low', 'gemini-5-carbon-high'];
    expect(unsorted(listed)).toEqual(['gemini-5-helium-high']);
    expect(unsorted(LISTED)).toEqual([]);
    // A family of two words is one family: named while unsorted, asked once it is in LIGHT, and not taken for Flash.
    const lite = [...LISTED, 'gemini-5-flash-lite-high'];
    expect(unsorted(lite)).toEqual(['gemini-5-flash-lite-high']);
    expect(lightModels(lite)).toEqual([HYDROGEN, FLASH]);
    expect(lightModels(lite, ['gemini-5-flash-lite', ...LIGHT])).toEqual(['gemini-5-flash-lite-high', HYDROGEN, FLASH]);
    const { models, note } = reviewModels(agyLists(`${AGY_MODELS}gemini-5-helium-high\tGemini 5 Helium (High)\n`));
    expect(models).toEqual([HYDROGEN, FLASH]);
    expect(note).toMatch(
      /^New Gemini model in agy: gemini-5-helium-high\. .* add it to LIGHT in scripts\/lib\/agy\.mjs; if not, to HEAVY\.$/,
    );
  });

  it('asks the known fast models as written when agy cannot list its models', () => {
    const signedOut = (): AgyRun => ({ status: 1, stdout: '', stderr: 'sign in first' });
    for (const run of [noAgy, signedOut, agyLists('Fetching available models...\n')]) {
      expect(listModels(run)).toBeNull();
      expect(reviewModels(run)).toEqual({ models: [HYDROGEN, FLASH], note: '' });
    }
    // A retired one is then still asked: agy's words for it (2026-11-19) pass the review to the next model.
    const gone = new Error(
      'agy exited 1: error: invalid model selection (--model "gemini-3.8-flash-high" --effort ""): model gemini-3.8-flash-high is not recognized as a known model or custom model in settings',
    );
    const { result } = ask([FLASH, HYDROGEN], { [FLASH]: gone, [HYDROGEN]: 'ok' });
    expect(result.model).toBe(HYDROGEN);
    expect(result.passed).toEqual([{ model: FLASH, why: 'is no longer offered by agy' }]);
  });

  it('names the list to edit when agy lists no fast model it knows, and Gemini alone cannot review', () => {
    const onlyDeep = 'gemini-5-neon-high\tGemini 5 Neon (High)\nclaude-opus-5-5-high\tClaude Opus 5.5 (High)\n';
    expect(() => reviewModels(agyLists(onlyDeep))).toThrow(/lists none of the fast Gemini models .* LIGHT in scripts\/lib\/agy\.mjs/);
    const { models, note } = reviewModels(agyLists(onlyDeep), 'deep');
    expect(models).toEqual([OPUS]);
    expect(note).toMatch(/^No Gemini model reviews: agy lists none of the fast Gemini models .* LIGHT in scripts\/lib\/agy\.mjs\.$/);
    expect(() => reviewModels(agyLists('gemini-5-neon-high\tGemini 5 Neon (High)\n'), 'deep')).toThrow(/lists none of the fast/);
  });

  // Owner, 19 Nov 2026: "agy does also have Sonnet and Opus-- you should also use those models for 2nd review because
  // I don't use them in agy anyway".
  it("has agy's Opus and Sonnet review too: deep starts on Opus, standard on Gemini, the rail audit skips Sonnet", () => {
    expect(Object.keys(ORDERS)).toEqual(['deep', 'standard', 'rail', 'gemini']);
    const asks = (order: Order, stdout = AGY_MODELS) => reviewModels(agyLists(stdout), order).models;
    expect(asks('deep')).toEqual([OPUS, HYDROGEN, FLASH, SONNET]);
    expect(asks('standard')).toEqual([HYDROGEN, FLASH, SONNET, OPUS]);
    expect(asks('rail')).toEqual([OPUS, HYDROGEN, FLASH]);
    expect(asks('gemini')).toEqual([HYDROGEN, FLASH]);
    for (const order of Object.keys(ORDERS) as Order[]) expect(asks(order).some((id) => /argon|carbon|neon/.test(id)), order).toBe(false);
    // With no list, the Claude models are asked as written; with one, the newest version, and a dropped one is left out.
    expect(reviewModels(noAgy, 'deep').models).toEqual([OPUS, HYDROGEN, FLASH, SONNET]);
    expect(`${CLAUDE.opus}-high`).toBe(OPUS);
    const newer = [...LISTED, 'claude-opus-6-high', 'claude-opus-5-10-high', 'claude-opus-6-medium'];
    expect(claudeModel(newer, 'opus')).toBe('claude-opus-6-high');
    expect(claudeModel(newer, 'sonnet')).toBe(SONNET);
    expect(claudeModel(LISTED.filter((id) => !id.includes('sonnet')), 'sonnet')).toBeNull();
    expect(asks('deep', AGY_MODELS.replace(/^claude-sonnet.*\n/gm, ''))).toEqual([OPUS, HYDROGEN, FLASH]);
  });

  it('gives a spec a deep review and a whole-repo audit a standard one', () => {
    expect(pickDepth({ kind: 'spec' }).depth).toBe('deep');
    expect(pickDepth({ kind: 'repo' }).depth).toBe('standard');
  });

  it('gives an engine change a deep review and names the file', () => {
    expect(
      pickDepth({ kind: 'change', files: ['README.md', 'src/engine/engine.ts'], lines: 3 }, ['src/engine/']),
    ).toEqual({
      depth: 'deep',
      why: 'it touches src/engine/engine.ts',
    });
  });

  it('gives a change over 300 lines a deep review anywhere, and a smaller one elsewhere a standard review', () => {
    expect(pickDepth({ kind: 'change', files: ['src/ui/hud.ts'], lines: 301 }, ['src/engine/']).depth).toBe('deep');
    expect(pickDepth({ kind: 'change', files: ['src/ui/hud.ts'], lines: 300 }, ['src/engine/']).depth).toBe('standard');
  });

  it("counts a diff's files and changed lines, not its headers", () => {
    const diff = [
      'diff --git a/src/engine/a.ts b/src/engine/a.ts',
      '--- a/src/engine/a.ts',
      '+++ b/src/engine/a.ts',
      '-old',
      '+new',
      ' same',
      'diff --git a/docs/new.md b/docs/new.md',
      '--- /dev/null',
      '+++ b/docs/new.md',
      '+one',
    ].join('\n');
    expect(diffStats(diff)).toEqual({ files: ['src/engine/a.ts', 'docs/new.md'], lines: 3 });
  });

  it('names both paths of a rename, so moving a rail out of its folder still counts as touching it', () => {
    const pure = [
      'diff --git a/.githooks/pre-push b/docs/pre-push',
      'similarity index 100%',
      'rename from .githooks/pre-push',
      'rename to docs/pre-push',
    ].join('\n');
    expect(diffStats(pure)).toEqual({ files: ['.githooks/pre-push', 'docs/pre-push'], lines: 0 });
    // A path with " b/" in it makes the header ambiguous: the `rename from` line is the old path.
    const spaced = [
      'diff --git a/x b/y b/z',
      'similarity index 90%',
      'rename from x b/y',
      'rename to z',
      '--- a/x b/y',
      '+++ b/z',
      '-old',
      '+new',
    ].join('\n');
    expect(diffStats(spaced)).toEqual({ files: ['x b/y', 'z'], lines: 2 });
  });

  it('sorts model versions newest first, number by number, without the locale', () => {
    expect(['3.8', '10', '4', '4.5', '5-5', '9'].sort(newerFirst)).toEqual(['10', '9', '5-5', '4.5', '4', '3.8']);
    expect(newerFirst('4', '4')).toBe(0);
  });
});

describe('falling back when a model has no usage left', () => {
  it('never asks the next model when the first answers', () => {
    const { result, asked } = ask(['a', 'b'], { a: 'looks fine', b: 'unused' });
    expect(result).toEqual({ model: 'a', response: 'looks fine', passed: [] });
    expect(asked).toEqual(['a']);
  });

  it('passes a model out of quota to the next, and remembers it until agy says it resets', () => {
    const { result, store } = ask(['a', 'b'], { a: new Error(QUOTA), b: 'two concerns' });
    expect(result.model).toBe('b');
    expect(store.out.a).toBe(NOW + ((151 * 60 + 45) * 60 + 8) * 1000);
  });

  it('skips a model remembered as out of usage without asking agy, until its reset passes', () => {
    expect(ask(['a', 'b'], { a: 'unused', b: 'ok' }, memory({ a: NOW + HOUR })).asked).toEqual(['b']);
    expect(ask(['a', 'b'], { a: 'back', b: 'unused' }, memory({ a: NOW - 1 })).asked).toEqual(['a']);
  });

  it('moves past a busy model without remembering it', () => {
    const { result, store } = ask(['a', 'b'], { a: new Error('RESOURCE_EXHAUSTED (code 429): try later'), b: 'ok' });
    expect(result.model).toBe('b');
    expect(result.passed).toEqual([{ model: 'a', why: 'was too busy' }]);
    expect(store.out).toEqual({});
  });

  it('treats a per-minute rate limit that mentions a quota as busy, not used up', () => {
    // Found by the second look on its own change (24 Oct): such a 429 would have locked the model out for an hour.
    const limit = new Error("RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Generate requests' per minute");
    const { result, store } = ask(['a', 'b'], { a: limit, b: 'ok' });
    expect(result.passed).toEqual([{ model: 'a', why: 'was too busy' }]);
    expect(store.out).toEqual({});
  });

  it('moves past a model that runs out of time, to one that may be faster', () => {
    const slow = new Error('the model ran out of time (10m0s) before finishing its answer');
    const { result } = ask(['a', 'b'], { a: slow, b: 'one note' });
    expect(result.model).toBe('b');
    expect(result.passed).toEqual([{ model: 'a', why: 'ran out of time' }]);
  });

  it('moves past a model that tried a blocked command, without remembering it', () => {
    // On 2026-10-24 Opus tried a command during this repo's second look and was blocked with no answer.
    const blocked = new Error('the model gave no answer after trying something it is not allowed to do (RunCommand)');
    const { result, asked, store } = ask(['a', 'b'], { a: blocked, b: 'No findings.' });
    expect(asked).toEqual(['a', 'b']);
    expect(result.passed).toEqual([{ model: 'a', why: 'tried a command it may not run' }]);
    expect(store.out).toEqual({});
  });

  it("reports any other failure with the model's name, without trying another", () => {
    expect(() => ask([FLASH, SONNET], { [FLASH]: new Error('agy is not installed'), [SONNET]: 'unused' })).toThrow(
      'Gemini 3.8 Flash (high): agy is not installed',
    );
  });

  it('names every model, and why, when none answers', () => {
    expect(() => ask([ARGON, OPUS], { [OPUS]: new Error(QUOTA) }, memory({ [ARGON]: NOW + HOUR }))).toThrow(
      /^no model answered: Gemini 4 Argon \(high\) is out of usage until .+; Claude Opus 5\.5 \(high\)/,
    );
  });

  it("reads the reset time from agy's message, or waits an hour when it gives none", () => {
    expect(resetsAt('Resets in 2h5m', NOW).getTime()).toBe(NOW + 2 * HOUR + 5 * 60_000);
    expect(resetsAt('Individual quota reached.', NOW).getTime()).toBe(NOW + HOUR);
  });

  it('keeps one reset time per model in the quota file and survives a broken file', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agy-quota-test-'));
    try {
      const file = path.join(dir, 'quota.json');
      const store = quotaFile(file);
      store.markOut(ARGON, new Date(NOW + HOUR));
      expect(store.outUntil(ARGON, NOW)).toEqual(new Date(NOW + HOUR));
      expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')))).toEqual([ARGON]);
      expect(readdirSync(dir)).toEqual(['quota.json']); // written whole and renamed, no temp file left
      writeFileSync(file, 'not json');
      expect(store.outUntil(ARGON, NOW)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('says in the by-line which model answered, why, and whom it stood in for', () => {
    const line = byLine({
      model: OPUS,
      depth: 'deep',
      why: 'it touches src/engine/engine.ts',
      passed: [{ model: ARGON, until: new Date(NOW) }],
    });
    expect(line).toMatch(/^Claude Opus 5\.5 \(high\), a deep review because it touches src\/engine\/engine\.ts\. /);
    expect(line).toMatch(/Gemini 4 Argon \(high\) is out of usage until .+\.$/);
  });
});

describe('talking to agy', () => {
  it('tells the model it can run no command, not even git, and where the material is', () => {
    const prompt = buildPrompt('Review this.', 'C:/tmp/material.md');
    expect(prompt).toMatch(/^You are running headless/);
    expect(prompt).toMatch(/cannot run any command, not even git/);
    expect(prompt).toMatch(/Review this\.\nThe material is in C:\/tmp\/material\.md\./);
  });

  it("returns the answer, passes agy's own error on word for word, and refuses a timed-out one", () => {
    const reply = (json: object, stderr = '') => ({ status: 0, stdout: JSON.stringify(json), stderr });
    expect(parseReply(reply({ status: 'SUCCESS', response: 'No findings.\n' }))).toBe('No findings.');
    expect(() => parseReply(reply({ status: 'ERROR', error: QUOTA }))).toThrow(QUOTA);
    expect(() =>
      parseReply(
        reply({ status: 'SUCCESS', response: 'partial' }, '[agy] print timeout after 10m0s with turn in progress'),
      ),
    ).toThrow('the model ran out of time (10m0s) before finishing its answer');
  });

  // The reply agy gave on 2026-10-28 when a model ran a command: success, no answer, the refusal named.
  const REFUSED = {
    conversation_id: 'c-1',
    status: 'SUCCESS',
    response: '',
    denied_actions: [{ action: 'command', display_name: 'RunCommand' }],
  };
  const runs = (...replies: object[]) => {
    const asked: string[][] = [];
    const run = (args: string[]) => {
      asked.push(args);
      return { status: 0, stdout: JSON.stringify(replies[asked.length - 1]), stderr: '' };
    };
    return { run, asked };
  };

  it('resumes a run cut off for a refused command once, in the same conversation, and returns its answer', () => {
    const { run, asked } = runs(REFUSED, { status: 'SUCCESS', response: 'LOOSENS: no\n' });
    expect(askModel(run, 'Audit this.', OPUS, ['--add-dir', 'C:/tmp'])).toBe('LOOSENS: no');
    expect(asked[0]).toEqual(['-p', 'Audit this.', '--output-format', 'json', '--model', OPUS, '--print-timeout', '10m', '--add-dir', 'C:/tmp']);
    expect(asked[1].slice(-4)).toEqual(['--add-dir', 'C:/tmp', '--conversation', 'c-1']);
    expect(asked[1][1]).toMatch(/^Your command was refused/);
  });

  it('passes the refusal on when the resumed run tries a command again, and never resumes another failure', () => {
    const twice = runs(REFUSED, REFUSED, REFUSED);
    expect(() => askModel(twice.run, 'Audit this.', OPUS)).toThrow(/not allowed to do \(RunCommand\)/);
    expect(twice.asked).toHaveLength(2);
    const quota = runs({ status: 'ERROR', error: QUOTA });
    expect(() => askModel(quota.run, 'Audit this.', OPUS)).toThrow(QUOTA);
    expect(quota.asked).toHaveLength(1);
  });

  // The reply agy 1.5.1 gave on 2026-11-05 when --print-timeout cut a turn off (it also exits 3).
  const LATE = {
    conversation_id: 'c-2',
    status: 'ERROR',
    response: '',
    error: 'print timeout after 10m0s with the turn still in progress; the response is partial',
    finished_reason: 'print_timeout',
  };

  it('resumes a run that ran out of time once, told to answer from what it read, on the shorter limit', () => {
    const { run, asked } = runs(LATE, { status: 'SUCCESS', response: 'No findings.\n' });
    expect(askModel(run, 'Review this.', FLASH, ['--add-dir', 'C:/tmp'])).toBe('No findings.');
    expect(asked[1][1]).toMatch(/^Your time is up: read nothing more/);
    expect(asked[1].slice(-6)).toEqual(['--print-timeout', RESUME_TIMEOUT, '--add-dir', 'C:/tmp', '--conversation', 'c-2']);
  });

  it('passes the time-out on when the resumed run runs out of time too, so the next model is asked', () => {
    const twice = runs(LATE, { ...LATE, error: 'print timeout after 6m0s with the turn still in progress' });
    expect(() => askModel(twice.run, 'Review this.', FLASH)).toThrow('the model ran out of time (6m0s) before finishing its answer');
    expect(twice.asked).toHaveLength(2);
  });
});
