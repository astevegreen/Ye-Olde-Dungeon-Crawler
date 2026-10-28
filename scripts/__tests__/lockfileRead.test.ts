import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const HOOK = path.join(ROOT, '.claude/hooks/lockfile-read.mjs');

function hook(tool: string, toolInput: Record<string, unknown>): number {
  const run = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: tool, tool_input: toolInput }), encoding: 'utf8' });
  return run.status ?? -1;
}

describe('package-lock.json stays out of reads, not out of Bash', () => {
  it('refuses Read, Grep and Glob on the lockfile, wherever it sits', () => {
    expect(hook('Read', { file_path: path.join(ROOT, 'package-lock.json') })).toBe(2);
    expect(hook('Read', { file_path: 'C:\\Antigravity\\YODC-lane-ux\\package-lock.json' })).toBe(2);
    expect(hook('Grep', { pattern: 'vite', path: 'package-lock.json' })).toBe(2);
  });
  it('lets every other file through', () => {
    expect(hook('Read', { file_path: path.join(ROOT, 'package.json') })).toBe(0);
    expect(hook('Grep', { pattern: 'x', path: 'src' })).toBe(0);
    expect(hook('Glob', { pattern: '**/*.ts' })).toBe(0);
  });
  it('is wired for the file tools only, with no Read deny rule left to refuse a Bash command that names the file', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'));
    expect(settings.permissions.deny).not.toContain('Read(package-lock.json)');
    const wired = settings.hooks.PreToolUse.filter((h: { hooks: { command: string }[] }) => h.hooks.some((c) => c.command.includes('lockfile-read.mjs')));
    expect(wired.map((h: { matcher: string }) => h.matcher)).toEqual(['Read|Grep|Glob']);
  });
});
