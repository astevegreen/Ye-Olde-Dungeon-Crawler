import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { KEEP_STAMPS, readStamps, runStamped, treeKey, writeStamps, type GateCommand } from '../lib/gate-stamp';

/**
 * Gate stamps (docs/architecture/quality-gates.md, "Local pre-commit hook"): a stamp may skip a
 * gate only for the exact tree it passed on, and any doubt must run the gate. Each test builds a
 * throwaway git repository in the temp directory, never touching this one. Spawning git is slow
 * on Windows, hence the generous timeout.
 */

const SLOW = { timeout: 30_000 };

let repo: string;
let helpers: string;

const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf-8', stdio: 'pipe' });
const write = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
};
const tempDir = (prefix: string): string => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/**
 * A gate that appends its name to the helper log, runs `alsoDo` (JavaScript), then exits with
 * `exitCode`. No shell, so a temp path holding a space survives.
 */
function fakeGate(name: string, exitCode = 0, alsoDo = ''): GateCommand {
  const script = path.join(helpers, `${name}-${exitCode}.cjs`);
  const log = JSON.stringify(path.join(helpers, 'ran.log'));
  fs.writeFileSync(script, `require('node:fs').appendFileSync(${log}, ${JSON.stringify(`${name}\n`)});\n${alsoDo}\nprocess.exit(${exitCode});\n`);
  return { file: process.execPath, args: [script], shell: false };
}
const readRan = (): string[] => {
  const log = path.join(helpers, 'ran.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf-8').split('\n').filter(Boolean) : [];
};

beforeEach(() => {
  repo = tempDir('gate-stamp-repo-');
  helpers = tempDir('gate-stamp-helpers-');
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  write('.gitignore', 'ignored.txt\n');
  write('src/a.ts', 'export const a = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(helpers, { recursive: true, force: true });
});

describe('treeKey', SLOW, () => {
  it('is stable for an unchanged tree and equal for identical content elsewhere', () => {
    expect(treeKey(repo)).toBe(treeKey(repo));
    const twin = tempDir('gate-stamp-twin-');
    try {
      execFileSync('git', ['init', '-q'], { cwd: twin });
      fs.writeFileSync(path.join(twin, '.gitignore'), 'ignored.txt\n');
      fs.mkdirSync(path.join(twin, 'src'));
      fs.writeFileSync(path.join(twin, 'src/a.ts'), 'export const a = 1;\n');
      expect(treeKey(twin)).toBe(treeKey(repo));
    } finally {
      fs.rmSync(twin, { recursive: true, force: true });
    }
  });

  it('changes when a tracked file is edited, even unstaged', () => {
    const before = treeKey(repo);
    write('src/a.ts', 'export const a = 2;\n');
    expect(treeKey(repo)).not.toBe(before);
  });

  it('changes when an untracked file appears, is edited, or is removed', () => {
    const before = treeKey(repo);
    write('src/new.ts', 'one\n');
    const added = treeKey(repo);
    expect(added).not.toBe(before);
    write('src/new.ts', 'two\n');
    expect(treeKey(repo)).not.toBe(added);
    fs.rmSync(path.join(repo, 'src/new.ts'));
    expect(treeKey(repo)).toBe(before);
  });

  it('changes when a tracked file is deleted from disk', () => {
    const before = treeKey(repo);
    fs.rmSync(path.join(repo, 'src/a.ts'));
    expect(treeKey(repo)).not.toBe(before);
  });

  it('ignores gitignored files, and stamps stored under .git', () => {
    const before = treeKey(repo);
    write('ignored.txt', 'noise\n');
    writeStamps(repo, before, ['lint']);
    expect(treeKey(repo)).toBe(before);
  });

  it('throws outside a git repository rather than guessing', () => {
    const bare = tempDir('gate-stamp-nogit-');
    try {
      expect(() => treeKey(bare)).toThrow();
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe('stamps', SLOW, () => {
  it('round-trips and merges gates for one tree', () => {
    const key = treeKey(repo);
    expect(readStamps(repo, key)).toEqual({});
    writeStamps(repo, key, ['lint'], new Date('2026-10-07T10:00:00Z'));
    writeStamps(repo, key, ['test'], new Date('2026-10-07T10:05:00Z'));
    expect(readStamps(repo, key)).toEqual({ lint: '2026-10-07T10:00:00.000Z', test: '2026-10-07T10:05:00.000Z' });
  });

  it('reads a corrupt or foreign stamp file as empty', () => {
    const key = treeKey(repo);
    writeStamps(repo, key, ['lint']);
    const file = path.join(repo, '.git', 'gate-stamps', `${key}.json`);
    fs.writeFileSync(file, '{ not json');
    expect(readStamps(repo, key)).toEqual({});
    fs.writeFileSync(file, JSON.stringify({ version: 99, gates: { lint: 'x' } }));
    expect(readStamps(repo, key)).toEqual({});
  });

  it('prunes to the newest few, dropping the oldest', () => {
    const dir = path.join(repo, '.git', 'gate-stamps');
    fs.mkdirSync(dir, { recursive: true });
    const total = KEEP_STAMPS + 5;
    for (let i = 0; i < total; i++) {
      const file = path.join(dir, `old${String(i).padStart(2, '0')}.json`);
      fs.writeFileSync(file, '{}');
      const when = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
      fs.utimesSync(file, when, when);
    }
    writeStamps(repo, treeKey(repo), ['lint']);
    const left = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
    expect(left.length).toBe(KEEP_STAMPS);
    expect(left).toContain(`old${total - 1}.json`);
    expect(left).not.toContain('old00.json');
  });
});

describe('runStamped', SLOW, () => {
  const quiet = { log: () => {} };

  it('runs the gates, stamps them, and skips them on the same tree', () => {
    const commands = { lint: fakeGate('lint'), test: fakeGate('test') };
    const first = runStamped({ root: repo, gates: ['lint', 'test'], commands, ...quiet });
    expect(first).toMatchObject({ status: 0, skipped: [], stamped: ['lint', 'test'] });
    expect(readRan()).toEqual(['lint', 'test']);

    const second = runStamped({ root: repo, gates: ['lint', 'test'], commands, ...quiet });
    expect(second).toMatchObject({ status: 0, skipped: ['lint', 'test'], stamped: [] });
    expect(readRan()).toEqual(['lint', 'test']);
  });

  it('runs again after any edit', () => {
    const commands = { lint: fakeGate('lint') };
    runStamped({ root: repo, gates: ['lint'], commands, ...quiet });
    write('src/a.ts', 'export const a = 3;\n');
    runStamped({ root: repo, gates: ['lint'], commands, ...quiet });
    expect(readRan()).toEqual(['lint', 'lint']);
  });

  it('runs only the gates not yet stamped', () => {
    const commands = { lint: fakeGate('lint'), test: fakeGate('test') };
    writeStamps(repo, treeKey(repo), ['lint']);
    const result = runStamped({ root: repo, gates: ['lint', 'test'], commands, ...quiet });
    expect(result).toMatchObject({ skipped: ['lint'], stamped: ['test'] });
    expect(readRan()).toEqual(['test']);
  });

  it('--force runs a stamped gate and refreshes its stamp', () => {
    const commands = { lint: fakeGate('lint') };
    runStamped({ root: repo, gates: ['lint'], commands, ...quiet });
    const forced = runStamped({ root: repo, gates: ['lint'], commands, force: true, ...quiet });
    expect(forced).toMatchObject({ skipped: [], stamped: ['lint'] });
    expect(readRan()).toEqual(['lint', 'lint']);
  });

  it('useStamps: false neither reads nor writes a stamp', () => {
    const commands = { lint: fakeGate('lint') };
    writeStamps(repo, treeKey(repo), ['lint']);
    const result = runStamped({ root: repo, gates: ['lint'], commands, useStamps: false, ...quiet });
    expect(result).toMatchObject({ skipped: [], stamped: [] });
    expect(readRan()).toEqual(['lint']);
  });

  it('stops at the first failing gate, returns its status, and stamps nothing', () => {
    const commands = { lint: fakeGate('lint', 3), test: fakeGate('test') };
    const result = runStamped({ root: repo, gates: ['lint', 'test'], commands, ...quiet });
    expect(result).toMatchObject({ status: 3, stamped: [] });
    expect(readRan()).toEqual(['lint']);
    expect(readStamps(repo, treeKey(repo))).toEqual({});
  });

  it('does not stamp a tree that changed while the gates ran', () => {
    const touch = `require('node:fs').writeFileSync(${JSON.stringify(path.join(repo, 'src/a.ts'))}, 'export const a = 9;\\n');`;
    const commands = { lint: fakeGate('lint', 0, touch) };
    const lines: string[] = [];
    const result = runStamped({ root: repo, gates: ['lint'], commands, log: (line) => lines.push(line) });
    expect(result).toMatchObject({ status: 0, stamped: [] });
    expect(lines.join('\n')).toContain('tree changed while the gates ran');
    expect(readStamps(repo, treeKey(repo))).toEqual({});
  });

  it('runs every gate, unstamped, when the tree cannot be fingerprinted', () => {
    const bare = tempDir('gate-stamp-nogit-');
    try {
      const commands = { lint: fakeGate('lint') };
      const lines: string[] = [];
      const result = runStamped({ root: bare, gates: ['lint'], commands, log: (line) => lines.push(line) });
      expect(result).toMatchObject({ status: 0, skipped: [], stamped: [] });
      expect(readRan()).toEqual(['lint']);
      expect(lines.join('\n')).toContain('cannot fingerprint');
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it('rejects an unknown gate before running anything', () => {
    expect(() => runStamped({ root: repo, gates: ['nope'], commands: { lint: fakeGate('lint') }, ...quiet })).toThrow(/unknown gate/);
    expect(readRan()).toEqual([]);
  });
});
