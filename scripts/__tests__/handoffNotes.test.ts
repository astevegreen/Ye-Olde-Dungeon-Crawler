// The handoff skill's tooling: .claude/skills/handoff/notes.mjs (notes on origin's `handoffs`
// branch) and the SessionStart and Stop paths of .claude/hooks/handoff-nudge.mjs. Both run as
// child processes against throwaway repositories with a bare repository as their origin. Every
// test builds its own repositories, so they run concurrently: git is slow to spawn on Windows.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const NOTES = fileURLToPath(new URL('../../.claude/skills/handoff/notes.mjs', import.meta.url));
const NUDGE = fileURLToPath(new URL('../../.claude/hooks/handoff-nudge.mjs', import.meta.url));

// The pre-commit hook runs this suite with git's GIT_* variables set (GIT_INDEX_FILE among them),
// and a cloud session sets CLAUDE_CODE_REMOTE: the children get neither.
const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && k !== 'CLAUDE_CODE_REMOTE')),
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], cwd: string, input = ''): Promise<Run> {
  return new Promise((resolve, reject) => {
    // A child that exits before reading its stdin breaks the pipe. On Linux that is an EPIPE
    // on the write, uncaught unless handled (it failed the deploy at f36f4b7c); Windows never
    // raises it. Only a child given input gets a pipe, and its exit code is what counts.
    const child = spawn(command, args, { cwd, env, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout!.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr!.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    if (child.stdin) {
      child.stdin.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EPIPE') reject(err);
      });
      child.stdin.end(input);
    }
  });
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await run('git', args, cwd);
  if (r.code !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

async function notes(cwd: string, ...args: string[]): Promise<{ code: number | null; out: string }> {
  const r = await run(process.execPath, [NOTES, ...args], cwd);
  return { code: r.code, out: `${r.stdout}${r.stderr}` };
}

async function configure(dir: string): Promise<void> {
  await git(dir, 'config', 'commit.gpgsign', 'false');
  await git(dir, 'config', 'core.hooksPath', '.no-hooks');
}

// A bare origin and a clone of it on main, with .prompts/ ignored as in this repository.
async function repos(): Promise<{ root: string; origin: string; work: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-notes-'));
  roots.push(root);
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  await Promise.all([git(root, 'init', '-q', '--bare', '-b', 'main', origin), git(root, 'init', '-q', '-b', 'main', work)]);
  await configure(work);
  await git(work, 'remote', 'add', 'origin', origin);
  fs.writeFileSync(path.join(work, '.gitignore'), '.prompts/\n');
  await git(work, 'add', '.');
  await git(work, 'commit', '-q', '-m', 'start');
  await git(work, 'push', '-q', 'origin', 'main');
  return { root, origin, work };
}

async function clone(root: string, origin: string, name: string): Promise<string> {
  const dir = path.join(root, name);
  await git(root, 'clone', '-q', origin, dir);
  await configure(dir);
  return dir;
}

async function commit(dir: string, file: string): Promise<string> {
  fs.writeFileSync(path.join(dir, file), `${file}\n`);
  await git(dir, 'add', file);
  await git(dir, 'commit', '-q', '-m', `add ${file}`);
  return git(dir, 'rev-parse', '--short', 'HEAD');
}

const VALID = ['# Handoff: test task', '', '## Goal', 'Test the notes.', '', '## Next', '1. Run the test.'];

function draft(cwd: string, slug: string, lines: string[] = VALID): string {
  const file = path.join(cwd, '.prompts', 'handoffs', `${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  return path.relative(cwd, file);
}

// Publishes a draft and returns the name publish gave it.
async function published(cwd: string, slug: string): Promise<string> {
  const r = await notes(cwd, 'publish', draft(cwd, slug));
  expect(r.code, r.out).toBe(0);
  return /^pushed (\S+\.md) to origin\/handoffs/.exec(r.out)![1];
}

const onOrigin = async (origin: string, name: string): Promise<string | null> => {
  const r = await run('git', ['--git-dir', origin, 'show', `handoffs:${name}`], os.tmpdir());
  return r.code === 0 ? r.stdout : null;
};

const listed = async (cwd: string): Promise<string[]> => (await notes(cwd, 'list')).out.trimEnd().split('\n');

describe.concurrent('notes.mjs', { timeout: 60_000 }, () => {
  it('publish stamps line 2, files the draft under a UTC time and pushes it', async () => {
    const { origin, work } = await repos();
    fs.writeFileSync(path.join(work, 'scratch.txt'), 'wip\n');
    const source = draft(work, 'My Task');
    const r = await notes(work, 'publish', source);
    expect(r.code, r.out).toBe(0);
    const name = /^pushed (\d{4}-\d{2}-\d{2}-\d{4}-my-task\.md) to origin\/handoffs/.exec(r.out)?.[1];
    expect(name, r.out).toBeDefined();

    const filed = fs.readFileSync(path.join(work, '.prompts', 'handoffs', name!), 'utf8');
    const line2 = filed.split('\n')[1];
    const head = await git(work, 'rev-parse', '--short', 'HEAD');
    expect(line2).toMatch(new RegExp(`^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2} UTC · branch main · HEAD ${head} · tree 1 uncommitted file · folder `));
    expect(line2.endsWith(`folder ${await git(work, 'rev-parse', '--show-toplevel')}`)).toBe(true);
    expect(filed.split('\n').slice(2, 4)).toEqual(['', '## Goal']);
    expect(fs.existsSync(path.join(work, source))).toBe(false);
    expect(await onOrigin(origin, name!)).toBe(filed);
    expect(await listed(work)).toEqual([`${name}  ${line2}`]);
  });

  it('publish refuses a note that breaks the template, and pushes nothing', async () => {
    const { work } = await repos();
    const cases: [string, string[], string][] = [
      ['title', ['# Notes', ...VALID.slice(1)], 'line 1 must be'],
      ['next', VALID.slice(0, 4), 'no "## Next" section'],
      ['claimed', [...VALID, 'Resumed: 2026-10-17 10:00 UTC'], 'it was claimed'],
      ['long', [...VALID, ...Array.from({ length: 34 }, (_, i) => `- line ${i}`)], 'it is 42 lines; keep it to 40'],
    ];
    const results = await Promise.all(cases.map(([slug, lines]) => notes(work, 'publish', draft(work, slug, lines))));
    results.forEach((r, i) => {
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('not published');
      expect(r.out).toContain(cases[i][2]);
    });
    expect((await notes(work, 'list')).out).toContain('no notes on origin/handoffs');
  });

  it('publishing a filed note again updates it under the same name', async () => {
    const { work } = await repos();
    const name = await published(work, 'update-me');
    const filed = path.join(work, '.prompts', 'handoffs', name);
    fs.appendFileSync(filed, '\n## Verification\n- tests: green\n');
    const r = await notes(work, 'publish', path.relative(work, filed));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain(`pushed ${name}`);
    expect(await listed(work)).toHaveLength(1);
  });

  it('claim takes the only open note, prints what changed since, and list stops offering it', async () => {
    const { root, origin, work } = await repos();
    const name = await published(work, 'only-note');
    await commit(work, 'later.txt');
    await git(work, 'push', '-q', 'origin', 'main');
    const other = await clone(root, origin, 'other');

    const r = await notes(other, 'claim');
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/^# Handoff: test task\n/);
    expect(r.out).toMatch(/\nResumed: \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\n/);
    expect(r.out).toContain('## Since the note');
    expect(r.out).toContain('add later.txt');
    expect(r.out).toContain(`Claimed copy: .prompts/handoffs/${name}`);
    expect(await onOrigin(origin, name)).toMatch(/^Resumed:/m);
    expect((await notes(work, 'list')).out).toContain('no unresumed notes');

    const again = await notes(work, 'claim', name);
    expect(again.code).toBe(3);
    expect(again.out).toContain('already claimed');
  });

  it('claim with several open notes claims nothing and lists them', async () => {
    const { work } = await repos();
    const first = await published(work, 'first-note');
    const second = await published(work, 'second-note');
    const r = await notes(work, 'claim');
    expect(r.code).toBe(4);
    expect(r.out).toContain('2 open notes');
    expect(r.out).toContain(first);
    expect(r.out).toContain(second);
    expect(await listed(work)).toHaveLength(2);
  });

  it('Since the note names the merge that brings the work in, and work that never left its folder', async () => {
    const { root, origin, work } = await repos();
    const other = await clone(root, origin, 'other');
    await git(other, 'switch', '-q', '-c', 'side');
    await commit(other, 'side.txt');
    await git(other, 'push', '-q', 'origin', 'side');
    const pushed = await published(other, 'side-work');

    const merge = await notes(work, 'claim', pushed);
    expect(merge.code, merge.out).toBe(0);
    expect(merge.out).toContain('Branch: the note was on side; this folder is on main.');
    expect(merge.out).toContain('`git merge --no-edit origin/side`');

    const sha = await commit(other, 'local-only.txt');
    fs.writeFileSync(path.join(other, 'wip.txt'), 'wip\n');
    const stranded = await published(other, 'local-work');
    const r = await notes(work, 'claim', stranded);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain(`the note's HEAD ${sha} is in no branch here or on origin`);
    expect(r.out).toContain('which has 1 uncommitted file now');
    expect(r.out).toContain('They are not in this folder');
  });

  it('record pushes the answers into a claimed note; a new note takes a new name', async () => {
    const { origin, work } = await repos();
    const name = await published(work, 'answers');
    expect((await notes(work, 'claim')).code).toBe(0);
    const copy = path.join(work, '.prompts', 'handoffs', name);
    fs.appendFileSync(copy, '\n## Decisions\n- keep it — owner: "yes"\n');

    const r = await notes(work, 'record', path.relative(work, copy));
    expect(r.code, r.out).toBe(0);
    expect(await onOrigin(origin, name)).toContain('owner: "yes"');

    const unclaimed = await notes(work, 'record', draft(work, 'not-claimed'));
    expect(unclaimed.code).toBe(1);
    expect(unclaimed.out).toContain('no Resumed: line');

    fs.writeFileSync(copy, `${VALID.join('\n')}\n`);
    const reuse = await notes(work, 'publish', path.relative(work, copy));
    expect(reuse.code).toBe(3);
    expect(reuse.out).toContain('write the new note to a new file');
  });
});

type Entry = Record<string, unknown>;
const owner = (text: string): Entry => ({ type: 'user', message: { role: 'user', content: text } });
const call = (id: string, command: string): Entry => ({
  type: 'assistant',
  timestamp: new Date().toISOString(),
  message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }], usage: { input_tokens: 1000 } },
});
const result = (id: string, text: string): Entry => ({
  type: 'user',
  message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] },
});
const reply = (text: string, tokens = 1000): Entry => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }], usage: { input_tokens: tokens } },
});

let sessions = 0;
async function stop(cwd: string, entries: Entry[]): Promise<Run> {
  const session = `handoff-test-${process.pid}-${++sessions}`;
  const transcript = path.join(cwd, '.prompts', `${session}.jsonl`);
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join('\n'));
  const input = { hook_event_name: 'Stop', session_id: session, transcript_path: transcript, cwd };
  const r = await run(process.execPath, [NUDGE], cwd, JSON.stringify(input));
  fs.rmSync(path.join(os.tmpdir(), 'yodc-handoff-nudge', session), { force: true });
  return r;
}

const CLEAR = 'Note published.\n\nAfter `/clear`, type `/handoff resume`.';

describe.concurrent('handoff-nudge.mjs', { timeout: 60_000 }, () => {
  it('at session start, tells the owner about open notes only', async () => {
    const { work } = await repos();
    const start = () => run(process.execPath, [NUDGE], work, JSON.stringify({ hook_event_name: 'SessionStart', source: 'clear', cwd: work }));
    expect((await start()).stdout).toBe('');

    const name = await published(work, 'waiting');
    const r = await start();
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).systemMessage).toBe(`Open handoff note: ${name}. Type /handoff resume to continue it.`);

    expect((await notes(work, 'claim')).code).toBe(0);
    expect((await start()).stdout).toBe('');
  });

  it('at session start, tells Claude the sprint file overrides CLAUDE.md only inside its window', async () => {
    const { work } = await repos();
    const SPRINT = 'Sprint window open: `docs/sprint.md` overrides CLAUDE.md where they conflict.';
    const start = async (cwd = work): Promise<string | undefined> => {
      const r = await run(process.execPath, [NUDGE], cwd, JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd }));
      expect(r.code, r.stderr).toBe(0);
      return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput?.additionalContext : undefined;
    };
    const HOUR = 3_600_000;
    const at = (offset: number) => new Date(Date.now() + offset).toISOString().slice(0, 16).replace(/[-:]/g, '');
    const sprint = (text: string) => {
      fs.mkdirSync(path.join(work, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(work, 'docs', 'sprint.md'), `# Sprint\n\n${text}\n`);
    };
    const window = (from: number, to: number) => `**Window (UTC):** \`${at(from)}\` to \`${at(to)}\` (Eastern times).`;

    expect(await start()).toBeUndefined(); // no docs/sprint.md
    sprint('No window line here.');
    expect(await start()).toBeUndefined();

    sprint(window(-HOUR, HOUR));
    expect(await start()).toBe(SPRINT);
    fs.mkdirSync(path.join(work, 'src'), { recursive: true });
    expect(await start(path.join(work, 'src'))).toBe(SPRINT);

    sprint(window(-2 * HOUR, -HOUR));
    expect(await start()).toBeUndefined();
    sprint(window(HOUR, 2 * HOUR));
    expect(await start()).toBeUndefined();
  });

  it('sends a reply that points the owner at /clear back until an open note is published', async () => {
    const { work } = await repos();
    const blocked = await stop(work, [owner('wrap up'), reply(CLEAR)]);
    expect(blocked.code).toBe(2);
    expect(blocked.stderr).toContain('has published no unclaimed note');

    const name = await published(work, 'wrapped');
    const command = 'node .claude/skills/handoff/notes.mjs publish .prompts/handoffs/wrapped.md';
    const ok = await stop(work, [owner('wrap up'), call('toolu_1', command), result('toolu_1', `pushed ${name} to origin/handoffs (abc1234)`), reply(CLEAR)]);
    expect(ok.code, ok.stderr).toBe(0);
  });

  it('asks for a handoff once the conversation passes the line', async () => {
    const { work } = await repos();
    const r = await stop(work, [owner('keep going'), reply('Done with that step.', 250_000)]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('past the 200k handoff line');
    expect((await stop(work, [owner('keep going'), reply('Done with that step.', 150_000)])).code).toBe(0);
  });
});
