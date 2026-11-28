// The quota cuts of 28 Nov 2026 (owner: "I approve all your recommendations"): the ledger, the token meter, the
// skip rules and the carry-over of a pass across a small fix.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CARRY,
  SMALL,
  appendLedger,
  askFirstAvailable,
  askModel,
  carryOver,
  deltaPreamble,
  isDoc,
  isLockfile,
  isTest,
  readLedger,
  replyTokens,
  skipReason,
  type QuotaStore,
} from '../lib/agy.mjs';
import { blockerLines, priorReview, verdict } from '../lib/second-look.mjs';

const none: QuotaStore = { outUntil: () => null, markOut: () => {} };
const reply = (response: string, tokens?: number) => ({
  status: 0,
  stdout: JSON.stringify({ status: 'SUCCESS', response, ...(tokens === undefined ? {} : { usage: { total_tokens: tokens } }) }),
});

describe('the quota ledger', () => {
  it('appends one JSON line per call and reads them back, skipping a broken line', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agy-ledger-'));
    try {
      const file = path.join(dir, 'ledger.jsonl');
      expect(readLedger(file)).toEqual([]);
      appendLedger({ repo: 'yodc', verdict: 'ship' }, file, () => 0);
      writeFileSync(file, `${readFileSync(file, 'utf8')}not json\n`);
      appendLedger({ repo: 'yodc', verdict: 'fix' }, file, () => 0);
      expect(readLedger(file)).toEqual([
        { at: '1970-01-01T00:00:00.000Z', repo: 'yodc', verdict: 'ship' },
        { at: '1970-01-01T00:00:00.000Z', repo: 'yodc', verdict: 'fix' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never throws when the ledger cannot be written', () => {
    expect(() => appendLedger({ repo: 'yodc' }, path.join(os.tmpdir(), 'no-such-dir-agy', 'x', 'ledger.jsonl'))).not.toThrow();
  });

  it('counts the tokens agy reports, a resume included, and times the whole call', () => {
    expect(replyTokens(reply('ok', 21353))).toBe(21353);
    expect(replyTokens(reply('ok'))).toBeNull();
    expect(replyTokens({ status: 1, stdout: 'not json' })).toBeNull();
    const runs = [
      { status: 0, stdout: JSON.stringify({ status: 'ERROR', denied_actions: [{ action: 'RunCommand' }], conversation_id: 'c1', usage: { total_tokens: 100 } }) },
      reply('No findings.', 50),
    ];
    let t = 0;
    const answer = askFirstAvailable(
      ['m'],
      (model, meter) => askModel(() => runs.shift()!, 'p', model, [], null, meter),
      none,
      // The clock is read at the start, by the quota check and at the end: 1.5 s apart, 3 s in all.
      () => (t += 1500),
    );
    expect(answer).toMatchObject({ model: 'm', response: 'No findings.', tokens: 150, seconds: 3 });
  });

  it('puts the seconds spent on the error when no model answers', () => {
    let t = 0;
    const thrown = (() => {
      try {
        askFirstAvailable(['m'], () => { throw new Error('RESOURCE_EXHAUSTED (code 429)'); }, none, () => (t += 1000));
      } catch (err) {
        return err as Error & { seconds: number; tokens: number | null };
      }
    })();
    expect(thrown?.message).toMatch(/^no model answered/);
    expect(thrown).toMatchObject({ seconds: 2, tokens: null });
  });
});

describe('what agy skips', () => {
  it('sorts files into docs, tests and lockfiles, never counting instruction files as docs', () => {
    expect(['docs/follow-ups.md', 'README.md', 'src/content/cotw/LORE.MD'].every(isDoc)).toBe(true);
    for (const f of ['notes.txt', 'docs/balance.json', 'docs/architecture/diagram.svg']) expect(isDoc(f), f).toBe(false);
    for (const f of ['CLAUDE.md', 'src/AGENTS.md', 'GEMINI.md', '.claude/skills/x/SKILL.md', '.claude/agents/reviewer.md', '.agents/rules/project-rules.md'])
      expect(isDoc(f), f).toBe(false);
    expect(['scripts/__tests__/a.test.ts', 'e2e/run.spec.ts', 'tests/setup/x.ts', 'tools/tests/test_check.py'].every(isTest)).toBe(true);
    expect(isTest('src/engine/engine.ts')).toBe(false);
    expect(['package-lock.json', 'relay/pnpm-lock.yaml'].every(isLockfile)).toBe(true);
  });

  it('skips docs, tests, lockfiles, Dependabot and small changes off the high-risk paths and rails', () => {
    expect(skipReason({ files: ['docs/a.md'], lines: 500 })).toBe('it changes only docs');
    expect(skipReason({ files: ['src/a.test.ts'], lines: 500 })).toBe('it changes only tests');
    expect(skipReason({ files: ['package-lock.json'], lines: 5000 })).toBe('it changes only lockfiles');
    expect(skipReason({ files: ['src/ui/hud.ts'], lines: SMALL - 1 })).toBe(`it changes ${SMALL - 1} lines, none on a high-risk path or a rail`);
    expect(skipReason({ files: ['package.json'], lines: 2 }, { rails: true, author: 'dependabot[bot]' })).toBe('it is a Dependabot update');
  });

  it('reviews a rail, a high-risk path, an instruction file or a change of SMALL lines or more', () => {
    expect(skipReason({ files: ['docs/a.md'], lines: 1 }, { rails: true })).toBeNull();
    expect(skipReason({ files: ['src/engine/a.ts'], lines: 1 }, { deep: true })).toBeNull();
    expect(skipReason({ files: ['CLAUDE.md', 'src/ui/hud.ts'], lines: SMALL })).toBeNull();
    expect(skipReason({ files: ['docs/a.md', 'src/ui/hud.ts'], lines: SMALL })).toBeNull();
  });
});

describe('a pass carried across a small fix', () => {
  const ship = { sha: 'abcdef1234567890', verdict: 'ship' };
  it('carries a pass over a delta under CARRY lines that touches no high-risk path or rail', () => {
    expect(carryOver(ship, { lines: CARRY - 1 })).toEqual({
      mode: 'carry',
      why: `carried over from abcdef12: the ${CARRY - 1} lines since touch no high-risk path or rail`,
    });
    expect(carryOver({ ...ship, verdict: 'merge' }, { lines: 1 }).mode).toBe('carry');
  });

  it('reviews the delta alone after a bigger fix, a rail, a high-risk path or a fix verdict', () => {
    expect(carryOver(ship, { lines: CARRY }).mode).toBe('delta');
    expect(carryOver(ship, { lines: 1 }, { rails: true }).mode).toBe('delta');
    expect(carryOver(ship, { lines: 1 }, { deep: true }).mode).toBe('delta');
    expect(carryOver({ ...ship, verdict: 'fix' }, { lines: 1 }).mode).toBe('delta');
  });

  it('reviews the whole change with no earlier review or one that held or did not run', () => {
    expect(carryOver(null, { lines: 1 }).mode).toBe('full');
    for (const v of ['owner', 'hold', 'retry']) expect(carryOver({ ...ship, verdict: v }, { lines: 1 }).mode, v).toBe('full');
  });

  it('tells the delta review what was found before and to read only the delta', () => {
    const text = deltaPreamble({ sha: 'abcdef1234567890', verdict: 'fix', blockers: ['[blocker] a.ts:1 wrong'] });
    expect(text).toContain('commit abcdef12');
    expect(text).toContain('- [blocker] a.ts:1 wrong');
    expect(text).toMatch(/Review only the changes since abcdef12/);
  });

  it('builds only on this repo and request, a full or delta review that shipped or asked a fix, on this branch', () => {
    const line = (sha: string, more = {}) => ({ repo: 'yodc', request: 'r', verdict: 'ship', mode: 'full', sha, ...more });
    const ledger = [
      line('a'),
      line('b', { mode: 'carry' }),
      line('c', { mode: 'skip' }),
      line('d', { request: 'other' }),
      line('e', { repo: 'td' }),
      line('f', { verdict: 'owner' }),
      line('g', { mode: 'delta', verdict: 'fix' }),
      line('h'),
    ];
    expect(priorReview(ledger, 'r', (sha) => sha !== 'h')?.sha).toBe('g');
    expect(priorReview(ledger, 'r', (sha) => sha === 'a')?.sha).toBe('a');
    expect(priorReview(ledger, 'r', () => false)).toBeNull();
  });
});

describe('one call for a rail change', () => {
  it('reads the rail answer and the findings from the same reply', () => {
    const answer = { answer: 'LOOSENS: no\nIt adds a check.\nFindings:\n[blocker] scripts/x.mjs:3 no test', model: 'gemini-4-hydrogen-high' };
    expect(verdict({ rails: ['scripts/second-look.mjs'], rail: answer, look: answer }).verdict).toBe('fix');
    expect(blockerLines(answer.answer)).toEqual(['[blocker] scripts/x.mjs:3 no test']);
    const loose = { ...answer, answer: 'LOOSENS: yes\nscripts/x.mjs:3 skips the gate\nFindings:\nNo findings.' };
    expect(verdict({ rails: ['scripts/second-look.mjs'], rail: loose, look: loose }).verdict).toBe('owner');
  });
});
