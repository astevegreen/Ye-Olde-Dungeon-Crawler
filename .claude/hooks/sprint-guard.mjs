// PreToolUse guard for the unattended sprint (docs/sprint.md). Permission rules match only a
// command's prefix; this reads every part of a chained command line.
//   --lane        Bash: no push, no merge (lane, plan, research, supervisor and implementer)
//   --integrator  Bash: pushes only `git push origin HEAD:main`
// Both refuse dependency changes and git writes to the main checkout (only fetch, worktree and
// `merge --ff-only` touch it).
//   --read-only   Bash: inspection commands only (the reviewer)
//   --file-lock   Edit|Write: the sprint never edits its own machinery or the owner's files
// Every Bash mode also refuses what no unattended session may do: skip hooks, force or delete
// on the remote, discard work, change gh auth, or fetch from the web.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MODE = ['--lane', '--integrator', '--read-only', '--file-lock'].find((m) => process.argv.includes(m));
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');

function deny(reason) {
  process.stderr.write(`sprint-guard: ${reason} (docs/sprint.md, "What still stops a task")\n`);
  process.exit(2);
}

// Paths the sprint never edits, relative to the repo or worktree root.
const LOCKED = [
  /^\.claude\//, /^\.githooks\//, /^\.github\//, /^docs\/sprint\.md$/, /^CLAUDE\.md$/, /^ARCHITECTURE\.md$/,
  /^package(-lock)?\.json$/, /^src\/engine\/storage\/migrator\.ts$/, /^scripts\/__tests__\/sprintGuard\.test\.ts$/,
];

if (MODE === '--file-lock') {
  const file = path.resolve(String(input.cwd ?? process.cwd()), String(input.tool_input?.file_path ?? ''));
  // The checkout holding the file: a linked worktree has a `.git` file, the main checkout a `.git` folder.
  let root = path.dirname(file);
  while (!existsSync(path.join(root, '.git')) && path.dirname(root) !== root) root = path.dirname(root);
  const dotGit = path.join(root, '.git');
  if (!existsSync(dotGit)) deny(`${file} is outside every checkout`);
  if (statSync(dotGit).isDirectory()) deny(`${file} is in the main checkout; edit in your lane's worktree`);
  const rel = path.relative(root, file).split(path.sep).join('/');
  if (LOCKED.some((re) => re.test(rel))) deny(`${rel} is locked during the sprint`);
  process.exit(0);
}

const command = String(input.tool_input?.command ?? '');
// Simple commands: split on control operators, keeping the words of each.
const parts = command
  .split(/&&|\|\||[;|\n`]|\$\(|\)/)
  .map((s) => s.trim())
  .filter(Boolean);
const words = (s) => s.match(/"[^"]*"|'[^']*'|\S+/g)?.map((w) => w.replace(/^(["'])(.*)\1$/, '$2')) ?? [];

const ALWAYS = [
  [/--no-verify\b|\bSKIP_HOOKS\b|core\.hooksPath/, 'hooks are never skipped'],
  [/\bgh\s+(auth|secret|api|workflow|release|repo|label\s+delete|issue\s+delete)\b/, 'that gh command is the owner\'s'],
  [/\bgit\b[^\n]*\bpush\b[^\n]*(\s-f\b|--force|--delete|\s-d\b|\s\+\S|\s:\S)/, 'no force-push or remote delete'],
  [/\bgit\b[^\n]*\b(reset\s+--hard|clean\s+-\S*f|branch\s+-D|tag\s+-[df]|update-ref\s+-d|filter-branch|filter-repo)\b/, 'that discards work'],
  [/\brm\s+-\S*r|\bremove-item\b[^\n]*-recurse|\brmdir\b|\brd\s+\/s/i, 'no recursive delete'],
  [/\b(curl|wget|invoke-webrequest|iwr|invoke-restmethod|irm)\b/i, 'no web fetches'],
];
for (const [re, why] of ALWAYS) if (re.test(command)) deny(why);

const isPush = (w) => w[0] === 'git' && w.includes('push');
// Git Bash on Windows writes C:/x as /c/x; elsewhere /c/x is a real path.
const native = (p) => (process.platform === 'win32' ? p.replace(/^\/([a-z])(\/|$)/i, '$1:/') : p);
// The main checkout has a `.git` folder; a linked worktree has a `.git` file.
function isMainCheckout(dir) {
  let root = path.resolve(dir);
  while (!existsSync(path.join(root, '.git')) && path.dirname(root) !== root) root = path.dirname(root);
  const dotGit = path.join(root, '.git');
  return existsSync(dotGit) && statSync(dotGit).isDirectory();
}
// Git subcommands that change a checkout's branch, index or files. Run against the main checkout they
// would move the owner's working copy; only fetch, worktree and `merge --ff-only` go there.
const GIT_WRITES = new Set(['switch', 'checkout', 'commit', 'rebase', 'reset', 'restore', 'stash', 'cherry-pick',
  'revert', 'merge', 'pull', 'add', 'rm', 'mv', 'am', 'apply']);

if (MODE === '--lane' || MODE === '--integrator') {
  let cwd = String(input.cwd ?? process.cwd());
  for (const p of parts) {
    const w = words(p);
    if (w[0] === 'cd' && w[1]) cwd = path.resolve(cwd, native(w[1]));
    if (MODE === '--lane' && isPush(w)) deny('only the integrator pushes');
    if (w[0] === 'gh' && w[1] === 'pr' && w[2] === 'merge') deny('only the integrator lands work');
    if (w[0] === 'npm' && /^(i|in|install|add|un|uninstall|rm|remove|r|up|update|upgrade)$/.test(w[1] ?? '')) {
      deny('no new or changed dependencies; `npm ci` installs the locked ones');
    }
    if (w[0] === 'git') {
      const at = w.indexOf('-C');
      const dir = at >= 0 && w[at + 1] ? path.resolve(cwd, native(w[at + 1])) : cwd;
      const sub = w.find((x, i) => i > 0 && !x.startsWith('-') && w[i - 1] !== '-C');
      const ffOnly = sub === 'merge' && w.includes('--ff-only');
      if (GIT_WRITES.has(sub) && !ffOnly && isMainCheckout(dir)) {
        deny(`\`git ${sub}\` would change the main checkout; work in your worktree with \`git -C <worktree>\``);
      }
    }
  }
}

if (MODE === '--integrator') {
  for (const p of parts) {
    const w = words(p).filter((x, i, all) => !(all[i - 1] === '-C' || x === '-C'));
    if (isPush(w) && w.slice(w.indexOf('push')).join(' ') !== 'push origin HEAD:main') {
      deny('the integrator pushes only with `git push origin HEAD:main`');
    }
  }
}

if (MODE === '--read-only') {
  // A `>` inside quotes is text (a grep pattern), not a redirect.
  const unquoted = command.replace(/"[^"]*"|'[^']*'/g, '""');
  if (/(^|[^0-9&])>{1,2}(?!\s*(&1|\/dev\/null))/.test(unquoted)) deny('the reviewer writes no files');
  const ALLOWED = [
    ['git', 'diff'], ['git', 'log'], ['git', 'show'], ['git', 'status'], ['git', 'merge-base'],
    ['git', 'rev-parse'], ['git', 'branch', '--list'], ['git', 'ls-files'], ['git', 'grep'],
    ['gh', 'issue', 'view'], ['gh', 'pr', 'view'], ['cd'],
    ['cat'], ['head'], ['tail'], ['grep'], ['rg'], ['ls'], ['wc'], ['sort'], ['uniq'], ['date'], ['echo'], ['pwd'],
  ];
  for (const p of parts) {
    const w = words(p).filter((x, i, all) => !(x === '-C' || all[i - 1] === '-C'));
    const ok = ALLOWED.some((a) => a.every((x, i) => w[i] === x)) || (w[0] === 'sed' && w[1] === '-n');
    if (!ok) deny(`the reviewer runs inspection commands only, not \`${w.slice(0, 3).join(' ')}\``);
  }
}

process.exit(0);
