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
  'git config --replace-all core.hooksPath x',
  'git config set core.hookspath x',
  'git config --file .git/config core.hookspath x',
  'git -c core.hookspath=/dev/null commit -m wip',
  'git -ccore.HOOKSPATH=x push',
  'git -C ../other -c core.hookspath= commit',
  'git --config-env=core.hookspath=NOHOOKS commit',
  'git --config-env core.HooksPath=NOHOOKS push',
  'git -c core.hooksPath commit',
  'GIT -c core.hookspath=x commit',
  'git.exe config core.hookspath x',
  '& git config core.hookspath x',
  '& "C:\\Program Files\\Git\\cmd\\git.exe" config core.hookspath x',
  // the key built from pieces: quotes, escapes, expansions, substitutions, globs, line continuations
  'git -c core.hooks""path=x commit',
  "git -c 'core.hookspath=x' commit",
  'git -c core.hooks\\Path=x commit',
  'git -c core.hooks`Path=x commit',
  'git config --get core.hooks\\Path',
  "git config core.hooks$''Path /dev/null",
  "git config core.hooks$'\\x50'ath /dev/null",
  'git config core.hooks$()Path /dev/null',
  'git config core.hooks{P,}ath',
  'git config core.hooks[P]ath x',
  'git config core.hooks?ath x',
  "git config ('core.hooks'+'Path') x",
  'git config core.hooks$([char]80)ath x',
  'git -c core.hooks\\\npath=/dev/null commit',
  'git config core.hooks\\\nPath /dev/null',
  'git -c core.hooks`\npath=x commit',
  'g""it config core.hooks$\'\'Path x',
  'git${IFS}-ccore.hookspath=x${IFS}commit',
  'git${IFS}config${IFS}core.hooks$Path${IFS}x',
  'git co""nfig core.hooks$\'\'Path x',
  'git $(echo config) core.hooksPath x',
  "if (1) { git config core.hooks$''Path x }",
  // reads joined to something the hook can't read, or a read that's really a write
  'git config --get core.hooksPath; git config core.hookspath x',
  'git config --get core.hooksPath || git -c core.hookspath= commit',
  'git config --get "core.hooksPath"',
  'git config --get core.hooksPath $(echo x)',
  'git config --get core.hooksPath >$(git${IFS}-ccore.hookspath=x${IFS}commit)',
  'git config core.hooksPath > $(git${IFS}config${IFS}core.hookspath${IFS}x)',
  'git config core.hooksPath ""',
  'git config --type=path core.hooksPath',
  'git -c core.hooksPath=x config --get core.hooksPath',
  'git config --global --edit',
  'GIT_EDITOR=x git config -e',
  // git's config files written by hand
  'echo "[core] hooksPath = x" >> .git/config',
  'Add-Content .git\\config "`thookspath = x"',
  'echo "[core] hooksPath = x" >> ~/.gitconfig',
  "printf '[core]\\n\\thooks\\x50ath = /dev/null\\n' >> .git/config",
  "echo '[core] hooksPath = /dev/null' >> .gi?/config",
  'cat /tmp/h >> .git/config',
  'cp /tmp/h .git/config',
  'Set-Content -Path .git/config -Value x',
  'Copy-Item C:\\tmp\\h C:\\Antigravity\\Korean\\.git\\config',
  'cd .git && echo x >> config',
  'tee -a ~/.config/git/config < /tmp/h',
  // a config git includes, or takes from the environment
  'git config --global include.path ~/evil.gitconfig',
  'git -c include.path=/tmp/x commit',
  'git config includeIf.gitdir:~/x/.path /tmp/y',
  'git config --global "includeIf.gitdir:C:/a b/.path" /tmp/h',
  "git -c 'includeIf.gitdir:a b/.path=/tmp/evil' commit",
  "printf '[include]\\n\\tpath = /tmp/h.cfg\\n' >> .git/config",
  "printf '[include]\\n\\tpath = /tmp/h.cfg\\n' > /tmp/x",
  'GIT_CONFIG_GLOBAL=/tmp/x git commit -m wip',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=x git commit',
  'GIT_CONFIG_PARAMETERS="\'core.hookspath=x\'" git push',
  '$env:GIT_CONFIG_GLOBAL = "C:\\x"; git commit -m wip',
  'export GIT_CONFIG_SYSTEM=/tmp/x && git push',
  'export GIT_CONFIG_GLOBAL=/tmp/evil',
  'setx GIT_CONFIG_GLOBAL C:\\x',
  'HOME=/tmp/x git commit -m wip',
  'XDG_CONFIG_HOME=/tmp/x git commit',
  '$env:HOME="C:\\x"; git commit',
  "[Environment]::SetEnvironmentVariable('HOME', 'C:\\x', 'User')",
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
  'cat .git/config',
  'Get-Content .git/config | Select-String hooks',
  'cat ~/.gitconfig 2>/dev/null',
  // other git config, and everyday git
  'git config --get remote.origin.url',
  'git config user.email',
  'git -c core.quotepath=off status',
  'git -C ../x log --oneline -5',
  'git status --short',
  'git commit -m "fix: tidy hooks (and config)"',
  'git log --format="%h %s" -5 -- .github/workflows',
  'git add tools/hooks/hookspath-ask.mjs tools/hooks/hookspath-ask.test.mjs',
  'git log -- tools/hooks/hookspath-ask.mjs',
  'git push -u origin claude/hookspath-any-case',
  'git diff origin/main..HEAD 2>&1 | head -50',
  // lines that name no git config
  'grep -n "core.hookspath" .claude/settings.json',
  'rg hooksPath docs',
  'node --test tools/hooks/*.test.mjs',
  'npx vitest run src/config/deck.test.ts',
  'cat vite.config.ts',
  'echo $HOME',
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
  for (const input of ['not json', 'null']) {
    const r = runHook(input);
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask', input);
  }
});
