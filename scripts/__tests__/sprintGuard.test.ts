import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * The sprint guard (docs/sprint.md, "What still stops a task"): each unattended session's hook
 * refuses what its role may not do. Exit 2 is a refusal, 0 lets the call through.
 */

const GUARD = path.resolve(__dirname, '../../.claude/hooks/sprint-guard.mjs');

function guard(mode: string, toolInput: Record<string, unknown>, cwd = process.cwd()): number {
  const run = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify({ tool_input: toolInput, cwd }),
    encoding: 'utf-8',
  });
  return run.status ?? -1;
}
const bash = (mode: string, command: string, cwd?: string): number => guard(mode, { command }, cwd);

describe('every unattended mode', () => {
  it.each([
    'git commit --no-verify -m x',
    'SKIP_HOOKS=1 git push',
    'git -C /w push --force origin HEAD:main',
    'git push origin --delete sprint/3',
    'git push origin +HEAD:main',
    'git reset --hard origin/main',
    'git branch -D sprint/3',
    'npm test && rm -rf node_modules',
    'gh auth switch --user someone',
    'gh api repos/x/y -X DELETE',
    'curl https://example.com',
  ])('refuses %s', (command) => {
    for (const mode of ['--lane', '--integrator']) expect(bash(mode, command)).toBe(2);
  });
});

describe('--lane', () => {
  it('lets build work through', () => {
    for (const command of [
      'cd /w && npm run gate-stamp -- run lint test tooling',
      'git -C /w switch --discard-changes -C sprint/12 origin/main',
      // The implementer's own steps (.claude/agents/implementer.md, "Build").
      'git -C /w stash --include-untracked -m "left by a stopped session"',
      'git -C /w switch -c sprint/12 origin/main',
      'cd /w && npm ls --depth=0',
      'gh issue edit 12 --add-label to-integrate --remove-label in-progress',
      'git worktree add --detach C:/Antigravity/YODC-lane-ux origin/main',
    ]) expect(bash('--lane', command)).toBe(0);
  });
  it('never pushes or merges', () => {
    expect(bash('--lane', 'npm test && git push')).toBe(2);
    expect(bash('--lane', 'git -C /w push origin HEAD:main')).toBe(2);
    expect(bash('--lane', 'gh pr merge 4 --squash')).toBe(2);
    expect(bash('--lane', 'git push --dry-run origin HEAD:main')).toBe(2);
  });
  it('installs only the locked dependencies', () => {
    expect(bash('--lane', 'cd /w && npm ci')).toBe(0);
    expect(bash('--lane', 'npm install left-pad')).toBe(2);
    expect(bash('--lane', 'cd /w && npm i -D left-pad')).toBe(2);
    expect(bash('--lane', 'npm update')).toBe(2);
  });
});

describe('the sprint queue (scripts/sprint/queue.mjs)', () => {
  const Q = 'node C:/Antigravity/YODC/scripts/sprint/queue.mjs';
  it('runs on its own, with quoted arguments', () => {
    for (const mode of ['--lane', '--integrator']) {
      for (const command of [
        'node scripts/sprint/queue.mjs next aids --taken 12,14',
        `${Q} has-work "YODC lane: aids"`,
        `${Q} move 12 to-integrate --note 'WHAT CHANGED: a; b | c && d\\nPLAYER-VISIBLE: nothing player-visible'`,
        `${Q} status --write --also 'stuck: YODC lane: ux (no event since 04:11Z)'`,
      ]) expect(bash(mode, command)).toBe(0);
    }
  });
  it('refuses it chained, piped, redirected or in the background', () => {
    for (const mode of ['--lane', '--integrator']) {
      for (const command of [
        `${Q} next aids > next.txt`,
        `${Q} next aids 2>&1`,
        `${Q} move 12 held < note.txt`,
        `${Q} next aids && echo done`,
        `${Q} next aids; ls`,
        `${Q} next aids | head -1`,
        `cd C:/Antigravity/YODC && node scripts/sprint/queue.mjs next aids`,
        `${Q} next aids &`,
        `${Q} move 12 held --note "$(git log -1)"`,
        `${Q} move 12 held --note "\`whoami\`"`,
        `${Q} next aids\nls`,
      ]) expect(bash(mode, command), command).toBe(2);
    }
  });
  it('still lets other commands read the script', () => {
    expect(bash('--lane', 'cat scripts/sprint/queue.mjs | head -20')).toBe(0);
  });
});

describe('--integrator', () => {
  it('pushes only HEAD to main', () => {
    expect(bash('--integrator', 'git -C C:/Antigravity/YODC-integrate push origin HEAD:main')).toBe(0);
    expect(bash('--integrator', 'git push origin HEAD:refs/heads/other')).toBe(2);
    expect(bash('--integrator', 'git push')).toBe(2);
  });
  it('reads a push that saves its output to a file as that push', () => {
    expect(bash('--integrator', 'git -C C:/Antigravity/YODC-integrate push origin HEAD:main > push.txt 2>&1')).toBe(0);
    expect(bash('--integrator', 'git -C C:/Antigravity/YODC-integrate push origin HEAD:main --force > x')).toBe(2);
    expect(bash('--integrator', 'git push origin HEAD:other > x')).toBe(2);
  });
});

describe('--read-only', () => {
  it('runs inspection commands only', () => {
    expect(bash('--read-only', 'git diff origin/main...sprint/3 | head -50')).toBe(0);
    expect(bash('--read-only', 'gh issue view 3 --comments')).toBe(0);
    expect(bash('--read-only', 'npm test')).toBe(2);
    expect(bash('--read-only', 'git diff > out.txt')).toBe(2);
    expect(bash('--read-only', 'git log && git commit -m x')).toBe(2);
  });
  it('reads quoted `>` as text and allows cd', () => {
    expect(bash('--read-only', 'cd /w && grep -n "a > b" src/x.ts')).toBe(0);
    expect(bash('--read-only', "git log --format='%h > %s'")).toBe(0);
    expect(bash('--read-only', 'cd /w && git diff >> out.txt')).toBe(2);
  });
  it('reads |, ; and & inside quotes as a search pattern, but still splits command substitutions', () => {
    expect(bash('--read-only', 'grep -n "wantsHeal\\|repayVoidDebt" src')).toBe(0);
    expect(bash('--read-only', 'grep -n "a\\|b;c" src')).toBe(0);
    expect(bash('--read-only', "grep -rn 'x|y' src")).toBe(0);
    expect(bash('--read-only', 'grep "a" src; git commit -m x')).toBe(2);
    expect(bash('--lane', 'echo "$(git push)"')).toBe(2);
    expect(bash('--lane', 'echo "`git push`"')).toBe(2);
    expect(bash('--lane', 'echo \\"x; git push; y\\"')).toBe(2);
    expect(bash('--lane', 'grep "a|b" src | git push')).toBe(2);
  });
  it('reads a backslash-escaped ; or | outside quotes as text, as bash does', () => {
    // The 22 Oct eval: this refusal hid the bug at prologue.ts:458 from the reviewer.
    expect(bash('--read-only', 'sed -n 190,210p\\;350,490p src/content/cotw/prologue.ts')).toBe(0);
    expect(bash('--read-only', 'grep -n wantsHeal\\|repayVoidDebt src')).toBe(0);
    // cat is handed the words `;`, `git` and `commit` to read: nothing runs git.
    expect(bash('--read-only', 'cat x \\; git commit -m y')).toBe(0);
  });
  it('still splits at an unescaped operator next to an escaped one', () => {
    expect(bash('--read-only', 'sed -n 1p\\; x; git commit -m y')).toBe(2);
    expect(bash('--read-only', 'sed -n 1p\\;2p x && git commit -m y')).toBe(2);
    expect(bash('--read-only', 'sed -n 1p\\;2p x | git commit -m y')).toBe(2);
    // `\\` is an escaped backslash, so the `;` after it ends the command.
    expect(bash('--lane', 'grep a x \\\\; git push')).toBe(2);
    expect(bash('--lane', 'echo \\$(git push)')).toBe(2);
    expect(bash('--lane', 'echo "$(git push)"')).toBe(2);
  });
  it('reads a backslash-newline as one command line', () => {
    expect(bash('--lane', 'git \\\npush origin HEAD:main')).toBe(2);
    expect(bash('--read-only', 'git log \\\n  --oneline -3')).toBe(0);
  });
  it('fetches origin and reads with --no-pager', () => {
    expect(bash('--read-only', 'git fetch -q origin')).toBe(0);
    expect(bash('--read-only', 'git --no-pager log -3')).toBe(0);
    expect(bash('--read-only', 'git fetch origin main:main')).toBe(2);
    expect(bash('--read-only', 'git push')).toBe(2);
  });
});

describe('--file-lock', () => {
  let tmp: string;
  let main: string;
  let lane: string;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-guard-'));
    main = path.join(tmp, 'YODC');
    lane = path.join(tmp, 'YODC-lane-ux');
    fs.mkdirSync(path.join(main, '.git'), { recursive: true });
    fs.mkdirSync(lane, { recursive: true });
    fs.writeFileSync(path.join(lane, '.git'), 'gitdir: elsewhere\n');
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const edit = (file: string): number => guard('--file-lock', { file_path: file }, lane);

  it('lets a lane edit its own worktree', () => {
    expect(edit(path.join(lane, 'src/ui/hud.ts'))).toBe(0);
    expect(edit(path.join(lane, 'src/content/cotw/new-file.ts'))).toBe(0);
  });
  it('keeps git writes out of the main checkout', () => {
    for (const mode of ['--lane', '--integrator']) {
      expect(bash(mode, 'git switch -C sprint/3 origin/main', main)).toBe(2);
      expect(bash(mode, `git -C ${main} cherry-pick abc..def`, lane)).toBe(2);
      expect(bash(mode, `cd ${main} && git commit -m x`, lane)).toBe(2);
      expect(bash(mode, 'git stash', main)).toBe(2);
      expect(bash(mode, 'git fetch origin --prune && git merge --ff-only origin/main', main)).toBe(0);
      expect(bash(mode, `git -C ${lane} switch --discard-changes -C sprint/3 origin/main`, main)).toBe(0);
      expect(bash(mode, 'git commit -m x', lane)).toBe(0);
      expect(bash(mode, `git -C ${lane} stash push -m left`, main)).toBe(0);
      expect(bash(mode, `git -C ${main} stash push -m x`, lane)).toBe(2);
    }
  });
  it('refuses the main checkout and the locked paths', () => {
    expect(edit(path.join(main, 'src/ui/hud.ts'))).toBe(2);
    for (const locked of ['.claude/agents/implementer.md', 'docs/sprint.md', 'package.json', 'CLAUDE.md',
      'src/engine/storage/migrator.ts', '.githooks/pre-push', 'scripts/sprint/queue-rules.mjs']) {
      expect(edit(path.join(lane, locked))).toBe(2);
    }
  });
});
