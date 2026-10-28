import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ARGON,
  FLASH,
  OPUS,
  ORDER,
  SONNET,
  askFirstAvailable,
  askModel,
  buildPrompt,
  byLine,
  diffStats,
  modelName,
  parseReply,
  pickDepth,
  quotaFile,
  resetsAt,
  type QuotaStore,
} from '../lib/agy.mjs';

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

describe('which model reviews what', () => {
  it('runs every model at high effort', () => {
    for (const model of [ARGON, OPUS, FLASH, SONNET]) expect(model).toMatch(/-high$/);
    expect(modelName(OPUS)).toBe('Claude Opus 5.5 (high)');
  });

  it('spends Argon only on a deep review; a standard review starts on Flash', () => {
    expect(ORDER.deep).toEqual([ARGON, OPUS, FLASH, SONNET]);
    expect(ORDER.standard).toEqual([FLASH, SONNET, OPUS]);
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
});
