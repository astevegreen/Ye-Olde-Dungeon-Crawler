// Tests for hookspath-ask.mjs. Identical in every repo that carries the hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verdict } from './hookspath-ask.mjs';

const HOOK = fileURLToPath(new URL('./hookspath-ask.mjs', import.meta.url));

const ASKS = [
  // every spelling of the key, set from the command line or the config
  'git config core.hookspath /dev/null',
  'git config CORE.HOOKSPATH x',
  'git config core.HooksPath .nohooks',
  'git config --unset core.hookspath',
  'git config --global core.hookspath ~/none',
  'git config set core.hookspath x',
  'git -c core.hookspath=/dev/null commit -m wip',
  'git -ccore.HOOKSPATH=x push',
  'git -C ../other -c core.hookspath= commit',
  'git --config-env=core.hookspath=NOHOOKS commit',
  'git --config-env core.HooksPath=NOHOOKS push',
  'git -c core.hooksPath commit',
  // the key spelled through quotes or escapes
  'git -c core.hooks""path=x commit',
  "git -c 'core.hookspath=x' commit",
  'git -c core.hooks\\Path=x commit',
  'git -c core.hooks`Path=x commit',
  'git config --get core.hooks\\Path',
  // reads joined to something the hook can't read, or a read that's really a write
  'git config --get core.hooksPath; git config core.hookspath x',
  'git config --get core.hooksPath || git -c core.hookspath= commit',
  'git config --get "core.hooksPath"',
  'git config --get core.hooksPath $(echo x)',
  'git config core.hooksPath ""',
  'git config --type=path core.hooksPath',
  'git -c core.hooksPath=x config --get core.hooksPath',
  // git's config written by hand
  'echo "[core] hooksPath = x" >> .git/config',
  'Add-Content .git\\config "`thookspath = x"',
  'echo "[core] hooksPath = x" >> ~/.gitconfig',
  // a config git includes or takes from a variable
  'git config --global include.path ~/evil.gitconfig',
  'git -c include.path=/tmp/x commit',
  'git config includeIf.gitdir:~/x/.path /tmp/y',
  'GIT_CONFIG_GLOBAL=/tmp/x git commit -m wip',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=x git commit',
  'GIT_CONFIG_PARAMETERS="\'core.hookspath=x\'" git push',
  '$env:GIT_CONFIG_GLOBAL = "C:\\x"; git commit -m wip',
  'export GIT_CONFIG_SYSTEM=/tmp/x && git push',
];

const PASSES = [
  // reads, in any case
  'git config core.hooksPath',
  'git config --get core.hookspath',
  'git config --get-all CORE.HOOKSPATH',
  'git config --show-origin --get core.hooksPath',
  'git config --global --get core.hooksPath',
  'git config get core.hooksPath',
  'git -C C:\\Antigravity\\YODC config --get core.hooksPath',
  'git -C ../YODC config core.hooksPath',
  'git config --get core.hooksPath 2>/dev/null',
  'git config --get core.hooksPath 2>$null',
  'git config --get core.hooksPath || echo none',
  'git config --get core.hooksPath && git status',
  // lines that don't name git or the key
  'grep -n "core.hookspath" .claude/settings.json',
  'rg hooksPath docs',
  'git commit -m "fix: tidy hooks"',
  'git status --short',
  'git log --oneline -5 -- .github/workflows',
  'node --test tools/hooks/*.test.mjs',
  '',
];

for (const cmd of ASKS) test(`asks: ${cmd}`, () => assert.equal(verdict(cmd), 'ask'));
for (const cmd of PASSES) test(`passes: ${cmd}`, () => assert.equal(verdict(cmd), null));

const runHook = (stdin) => spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8' });

test('as the hook, it asks with a reason', () => {
  const r = runHook(
    JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git config core.hookspath x' } }),
  );
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /owner/);
});

test('as the hook, it says nothing for a command it leaves alone', () => {
  const r = runHook(
    JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: 'git status' } }),
  );
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('as the hook, input it cannot parse asks', () => {
  const r = runHook('not json');
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});
