import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// .claude/hooks/hookspath-ask.mjs is one copy of a hook the root keeps identical in YODC, the course and flashcards,
// with its node:test suite beside it; this runs that suite in vitest.
describe('hookspath-ask', () => {
  it('passes its own suite', () => {
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '.claude/hooks/hookspath-ask.test.mjs'], { cwd: ROOT, encoding: 'utf8' });
    expect(run.stdout.split('\n').filter((l) => l.startsWith('not ok'))).toEqual([]);
    expect(run.status).toBe(0);
  });
  it('is wired for Bash and PowerShell', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'));
    const wired = settings.hooks.PreToolUse.filter((h: { hooks: { command: string }[] }) => h.hooks.some((c) => c.command.includes('hookspath-ask.mjs')));
    expect(wired.map((h: { matcher: string }) => h.matcher)).toEqual(['Bash|PowerShell']);
  });
});
