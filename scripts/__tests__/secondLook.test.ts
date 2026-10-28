import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RAILS, blockers, loosens, railFiles, verdict } from '../lib/second-look.mjs';

const ROOT = path.resolve(__dirname, '../..');

describe('the rails a change can loosen', () => {
  it('names hooks, guards, gates, git hooks, CI, settings, the push lock and the review itself', () => {
    const touched = [
      '.claude/settings.json',
      '.claude/settings.local.json',
      '.claude/hooks/sprint-guard.mjs',
      '.claude/skills/sprint-lane/SKILL.md',
      '.claude/agents/reviewer.md',
      '.githooks/commit-msg',
      '.github/workflows/deploy.yml',
      'scripts/sprint/push-lock.mjs',
      'scripts/check-engine-purity.ts',
      'scripts/engine-encapsulation-allowlist.json',
      'scripts/second-look.mjs',
      'scripts/rail-audit.md',
      'package.json',
      'vite.config.ts',
    ];
    expect(railFiles(touched)).toEqual(touched);
  });
  it('leaves game code, docs, content skills and the lockfile to the ordinary second look', () => {
    expect(
      railFiles(['src/engine/engine.ts', 'CLAUDE.md', 'docs/sprint.md', '.claude/skills/add-content/SKILL.md', 'package-lock.json', 'e2e/gameplay.spec.ts']),
    ).toEqual([]);
  });
  it('names only files that exist, so a rename never drops one silently', () => {
    for (const rail of RAILS) {
      const dir = path.join(ROOT, path.dirname(rail));
      const exists = rail.endsWith('/') ? fs.existsSync(path.join(ROOT, rail)) : fs.readdirSync(dir).some((f) => f.startsWith(path.basename(rail)));
      expect(exists, rail).toBe(true);
    }
  });
});

describe('reading the answers', () => {
  it('counts the second look\'s blockers, never its notes', () => {
    expect(blockers('- [blocker] `a.ts:3` drops the flag\n- [note] `b.ts:9` an edge\n2. **[blocker]** c.ts:1 untested')).toBe(2);
    expect(blockers('No findings.')).toBe(0);
    expect(blockers('- [note] a [blocker] mentioned mid-line is not one')).toBe(0);
  });
  it('reads the rail audit\'s first line, and nothing else, as its answer', () => {
    expect(loosens('LOOSENS: yes\n.githooks/pre-push:40 skips Playwright')).toBe(true);
    expect(loosens('**LOOSENS: no**\nIt only adds a check.')).toBe(false);
    expect(loosens('The change looks fine.')).toBeNull();
  });
});

describe('the verdict', () => {
  const rails = ['.githooks/pre-push'];
  it('ships a change with no blocker; notes and a skipped second look never hold it', () => {
    expect(verdict({ look: { answer: '- [note] a.ts:1 an edge case' } })).toMatchObject({ verdict: 'ship' });
    expect(verdict({ look: { error: 'no model answered' } })).toEqual({ verdict: 'ship', why: 'second look skipped: no model answered' });
  });
  it('holds a second-look blocker like a reviewer blocker', () => {
    expect(verdict({ look: { answer: '- [blocker] a.ts:1 wrong\n- [blocker] b.ts:2 untested' } })).toEqual({
      verdict: 'fix',
      why: 'the second look found 2 [blocker]s',
    });
  });
  it('holds a rail change for the owner only when the audit says it loosens', () => {
    expect(verdict({ rails, rail: { answer: 'LOOSENS: no\nIt adds a step.' }, look: { answer: 'No findings.' } })).toEqual({
      verdict: 'ship',
      why: 'the rail audit says it loosens nothing',
    });
    expect(verdict({ rails, rail: { answer: 'LOOSENS: yes\n.githooks/pre-push:12 skips the sim' }, look: { answer: '- [blocker] x' } })).toEqual({
      verdict: 'owner',
      why: 'the rail audit says it loosens a rail; it waits for the owner; also the second look found 1 [blocker]',
    });
  });
  it('never ships a rail change no audit answered: it is run again, never left for the owner', () => {
    expect(verdict({ rails, rail: { error: 'no model answered: Gemini 4 Argon (high) was too busy' } })).toEqual({
      verdict: 'retry',
      why: 'no model answered: Gemini 4 Argon (high) was too busy; a change to .githooks/pre-push is never pushed unaudited',
    });
    expect(verdict({ rails, rail: { answer: 'Looks fine to me.' } }).verdict).toBe('retry');
    expect(verdict({ rails }).verdict).toBe('retry');
  });
});
