// PreToolUse guard for the unattended sprint (docs/sprint.md). Permission rules match only a
// command's prefix; this reads every part of a chained command line.
//   --lane        Bash: no push, no merge (lane, plan, research, supervisor and implementer)
//   --integrator  Bash: pushes only `git push origin HEAD:main`
// Both refuse dependency changes and git writes to the main checkout (only fetch, worktree and
// `merge --ff-only` touch it), and run the sprint queue (scripts/sprint/queue.mjs) only on its own.
// Both read the command a wrapper runs (env, nice, timeout, xargs, find -exec, ...) and refuse a command
// string they can't read (sh -c, pwsh -Command, cmd, eval) and git aliases.
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
  /^scripts\/sprint\//,
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

// A backslash before a newline joins the two lines into one command, as bash does: `git \⏎push` pushes.
const command = String(input.tool_input?.command ?? '').replace(/\\\r?\n/g, ' ');
// Simple commands: split on control operators, keeping the words of each. A literal in quotes is text:
// single quotes, or double quotes holding no $ or backtick (which can run a command there). Inside one,
// |, ;, &, ), a backtick, $ and a newline are masked, so a search pattern ("a\|b") or a multi-line note
// isn't split. So is an operator escaped with a backslash outside quotes (`sed -n 1p\;9p`, find's `\;`).
const MASK = { '|': '\u0001', ';': '\u0002', '&': '\u0003', ')': '\u0004', '`': '\u0005', $: '\u0006', '\n': '\u0007' };
const UNMASK = Object.fromEntries(Object.entries(MASK).map(([k, v]) => [v, k]));
// A message flag's literal value is text the command stores and never runs (a commit message, an issue
// body, a queue note): it is blanked before every check, so a note that mentions `git push`, curl or
// --no-verify isn't read as one. A value holding $ or a backtick is read like any other word.
const TEXT_FLAG = /(^|\s)(--note|--body|--comment|--title|--message|-m)(=|\s+)$/;
function maskQuoted(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { out += `\\${/[|;&)]/.test(s[i + 1] ?? '') ? MASK[s[i + 1]] : s[i + 1] ?? ''}`; i++; continue; }
    if (c !== '"' && c !== "'") { out += c; continue; }
    let j = i + 1;
    while (j < s.length && s[j] !== c) j += c === '"' && s[j] === '\\' ? 2 : 1;
    const q = s.slice(i, j + 1);
    const literal = c === "'" || !/[$`]/.test(q);
    if (literal && TEXT_FLAG.test(out)) out += "''";
    else out += literal ? q.replace(/[|;&)`$\n]/g, (x) => MASK[x]) : q;
    i = j;
  }
  return out;
}
const masked = maskQuoted(command);
// The command as the checks read it: message values blanked, everything else as written.
const text = masked.replace(/[\u0001-\u0007]/g, (c) => UNMASK[c]);
// PowerShell's call operator and dot-source run the command a variable or an expression names (`& $g push`,
// `. (gcm git)`); in bash, `& $g` backgrounds and then runs one. `2>&1` and `&&` are not that &.
const RUNS_VALUE = /(?<![>&])&(?![&>])\s*([$(]|"[^"]*\$)|(^|[;|\n{(&])\s*\.\s+([$(]|"[^"]*\$)/;
if (RUNS_VALUE.test(masked)) deny('`& $x`, `& (…)` and `. $x` run a command the guard can\'t read; run it by name');
// A lone & ends a command (bash's background) or starts one (PowerShell's call operator); `2>&1` and `&>`
// are redirects.
const parts = masked
  .split(/&&|\|\||(?<!>)&(?!>)|[;|\n`]|\$\(|\)/)
  .map((p) => p.replace(/[\u0001-\u0007]/g, (c) => UNMASK[c]).trim())
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
for (const [re, why] of ALWAYS) if (re.test(text)) deny(why);

const isPush = (w) => w[0] === 'git' && w.includes('push') && !w.includes('stash');
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

// A command's name as the shell runs it: `/usr/bin/git`, `git.exe` and `Git` are all git.
const cmdName = (x) => path.posix.basename(String(x ?? '').replace(/\\/g, '/')).toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
// Words before the command itself: shell keywords, grouping and the prefixes PowerShell adds (`then git push`,
// `(git push`, `{ git push`, `@(git push`, `[void](git push`, `. { git push }`), and assignments (`x=1 git push`).
const LEAD = new Set(['!', '{', '(', '.', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);
const ASSIGN = /^[A-Za-z_]\w*=/;
// Wrappers that run the rest of their words as a command, and their options that take a value.
const PREFIX = {
  env: ['-u', '--unset', '-C', '--chdir'], command: [], nice: ['-n', '--adjustment'],
  timeout: ['-s', '--signal', '-k', '--kill-after'], nohup: [], exec: ['-a'], time: [], stdbuf: ['-i', '-o', '-e'],
  setsid: [], xargs: ['-I', '-L', '-n', '-P', '-d', '-E', '-s', '-a', '--arg-file', '--delimiter', '--max-args',
    '--max-procs', '--max-chars', '--process-slot-var'],
};
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const STRING_RUNNERS = new Set(['cmd', 'eval', 'invoke-expression', 'iex', 'invoke-command', 'icm']);
const GIT_VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const gitSub = (w) => {
  for (let i = 1; i < w.length; i++) {
    if (GIT_VALUED.has(w[i])) i++;
    else if (!w[i].startsWith('-')) return w[i];
  }
  return undefined;
};

// The commands one simple command runs: itself, and what a wrapper (env, nice, xargs, find -exec, ...)
// runs from its words. Lane and integrator rules apply to each. A wrapper that runs a string (sh -c, cmd,
// eval) can't be read word by word, so it is refused. `fromArgs`: find or xargs adds words to it.
function commandsIn(raw, fromArgs = false, repl = null, depth = 0) {
  if (depth > 4) deny('too many nested wrappers to read');
  const w = [...raw];
  // PowerShell runs the command an assignment stores: `$x = git push`, `$x=git push`, `$env:X += …`.
  for (let lead = true; lead && w.length;) {
    const bare = w[0].replace(/^(\[[\w.]+\])*@?[({]+/, '');
    const glued = /^(\[[\w.]+\])*\$[^\s=]+?[-+*/%]?=(.*)$/.exec(w[0]);
    if (LEAD.has(w[0]) || ASSIGN.test(w[0]) || !bare) w.shift();
    else if (bare !== w[0]) w[0] = bare;
    else if (glued && glued[2]) w[0] = glued[2];
    else if (glued) w.shift();
    else if (/^(\[[\w.]+\])*\$\S+$/.test(w[0]) && /^[-+*/%]?=$/.test(w[1] ?? '')) w.splice(0, 2);
    else lead = false;
  }
  if (!w.length) return [];
  if (w[0].startsWith('$')) {
    // PowerShell shows a value here (`$x`, `$x.Count`, `$x | …`) and runs one only through & or ., refused
    // above; bash runs the command the variable holds.
    if (input.tool_name === 'PowerShell') return [];
    deny(`\`${w[0]}\` runs a command held in a variable, which the guard can't read; run it by name`);
  }
  const name = cmdName(w[0]);
  const self = { w: [name, ...w.slice(1)], fromArgs, repl };
  const inner = (rest, args = fromArgs, r = repl) => commandsIn(rest, args, r, depth + 1);

  if (name in PREFIX) {
    const valued = new Set(PREFIX[name]);
    let i = 1;
    let xrepl = null;
    for (; i < w.length; i++) {
      const t = w[i];
      if (t === '--') { i++; break; }
      if (name === 'env' && (t === '-' || ASSIGN.test(t))) continue;
      if (name === 'env' && /^(-S|--split-string)/.test(t)) deny('`env -S` runs a string the guard can\'t read');
      if (!t.startsWith('-') || t === '-') break;
      if (name === 'xargs' && /^(-I|-i|--replace)/.test(t)) xrepl = t === '-I' ? w[i + 1] : t.replace(/^(-I|-i|--replace=?)/, '') || '{}';
      if (valued.has(t)) i++;
    }
    if (name === 'timeout') i++; // the duration
    const rest = w.slice(i);
    if (name === 'xargs') return [self, ...(rest.length ? inner(rest, true, xrepl) : [])];
    return [self, ...inner(rest)];
  }
  if (name === 'find') {
    const out = [self];
    for (let i = 1; i < w.length; i++) {
      if (!/^-(exec|execdir|ok|okdir)$/.test(w[i])) continue;
      let j = i + 1;
      while (j < w.length && !/^(\\?;|\+)$/.test(w[j])) j++;
      out.push(...inner(w.slice(i + 1, j), true, '{}'));
      i = j;
    }
    return out;
  }
  if (SHELLS.has(name)) {
    let script = false;
    for (let i = 1; i < w.length; i++) {
      const t = w[i];
      if (/^\d*<+$/.test(t)) { i++; continue; }
      if (/^\d*</.test(t)) continue;
      if (t === '--') { script = i + 1 < w.length; break; }
      if (/^-[A-Za-z]*[cs][A-Za-z]*$/.test(t) || t === '--command') deny(`\`${name} -c\` runs a string the guard can't read; run the command itself`);
      if (/^[-+][oO]$|^--(rcfile|init-file)$/.test(t)) { i++; continue; }
      if (/^[-+]/.test(t)) continue;
      script = true;
      break;
    }
    if (!script) deny(`\`${name}\` with no script reads its commands from input, which the guard can't read`);
    return [self];
  }
  if (name === 'pwsh' || name === 'powershell') {
    // Parameters may be shortened (-c, -com, -e, -f) and start with -, -- or /.
    const params = [];
    for (let i = 1; i < w.length; i++) if (/^(--?|\/)[A-Za-z]+$/.test(w[i])) params.push([w[i].replace(/^(--?|\/)/, '').toLowerCase(), i]);
    const file = params.find(([p]) => 'file'.startsWith(p));
    if (params.some(([p]) => p.startsWith('c') || p === 'ec' || 'encodedcommand'.startsWith(p)) || !file || w[file[1] + 1] === '-') {
      deny(`\`${name}\` runs only with -File here: a -Command string can't be read by the guard`);
    }
    return [self];
  }
  if (STRING_RUNNERS.has(name)) deny(`\`${name}\` runs a string the guard can't read; run the command itself`);
  if (['start-process', 'start', 'saps'].includes(name)) {
    const runs = w.slice(1).flatMap((t) => t.split(',')).map((t) => cmdName(t.replace(/^['"]|['"]$/g, '')));
    if (runs.some((r) => r === 'git' || SHELLS.has(r) || STRING_RUNNERS.has(r) || r === 'pwsh' || r === 'powershell')) {
      deny(`\`${name}\` may not start git or a shell; run the command itself`);
    }
  }
  return [self];
}

// The queue writes labels and comments, and a settings rule may allow it by prefix: a call chained,
// piped, redirected or backgrounded could carry another command through, so it runs alone.
const isQueue = (w) => w[0] === 'node' && /(^|[\\/])scripts[\\/]sprint[\\/]queue\.mjs$/.test(w[1] ?? '');
if ((MODE === '--lane' || MODE === '--integrator') && parts.some((p) => isQueue(words(p)))) {
  const unquoted = text.replace(/"[^"]*"|'[^']*'/g, '""');
  if (parts.length !== 1 || /[<>&]/.test(unquoted)) {
    deny('run `node <checkout>/scripts/sprint/queue.mjs …` on its own: no chaining, pipe, redirect or `&`');
  }
}

if (MODE === '--lane' || MODE === '--integrator') {
  let cwd = String(input.cwd ?? process.cwd());
  // Git config set from the environment can define an alias that runs any command.
  if (/\bGIT_CONFIG_(PARAMETERS|COUNT|KEY_\d+)\b/.test(text)) deny('no git config from the environment');
  for (const p of parts) {
    const top = words(p);
    if (top[0] === 'cd' && top[1]) cwd = path.resolve(cwd, native(top[1]));
    for (const { w, fromArgs, repl } of commandsIn(top)) {
      if (MODE === '--lane' && isPush(w)) deny('only the integrator pushes');
      if (w[0] === 'gh' && w[1] === 'pr' && w[2] === 'merge') deny('only the integrator lands work');
      if (w[0] === 'npm' && /^(i|in|install|add|un|uninstall|rm|remove|r|up|update|upgrade)$/.test(w[1] ?? '')) {
        deny('no new or changed dependencies; `npm ci` installs the locked ones');
      }
      if (w[0] !== 'git') continue;
      const sub = gitSub(w);
      // find and xargs add words: `xargs git` or `-exec git {}` takes its subcommand from them, and
      // `-exec git -C {}` its checkout.
      const filled = (x) => x === undefined || x.includes('{}') || (repl && x.includes(repl));
      const at = w.indexOf('-C');
      if (fromArgs && (filled(sub) || (at >= 0 && filled(w[at + 1])))) {
        deny('git run by find or xargs must name its subcommand and checkout');
      }
      // An alias (`-c alias.x='!git push'`, `git config alias.x`) runs any command under a new name.
      if (w.some((x) => /^(--config-env=)?alias\./i.test(x))) deny('no git aliases: run the git command itself');
      // Git config is shared by the main checkout and every worktree, and --global is the computer's:
      // the sprint reads it and never writes it.
      if (sub === 'config') {
        const args = w.slice(w.indexOf('config') + 1);
        const named = args.filter((x) => !x.startsWith('-'));
        if (args.some((x) => /^(--(global|system|add|unset|unset-all|replace-all|rename-section|remove-section|edit)|-e)$/.test(x))
          || /^(set|unset|edit|rename-section|remove-section)$/.test(named[0] ?? '')
          || (named.length >= 2 && !/^(get|list)$/.test(named[0]))) {
          deny('git config is read-only in the sprint: it is shared with the main checkout, and --global is the computer\'s');
        }
      }
      if ((sub === 'rebase' && w.some((x) => /^(-x|--exec)(=|$)/.test(x)))
        || (sub === 'submodule' && w.includes('foreach')) || (sub === 'bisect' && w.includes('run'))) {
        deny(`\`git ${sub}\` would run a command string the guard can't read`);
      }
      const dir = at >= 0 && w[at + 1] ? path.resolve(cwd, native(w[at + 1])) : cwd;
      const ffOnly = sub === 'merge' && w.includes('--ff-only');
      if (GIT_WRITES.has(sub) && !ffOnly && isMainCheckout(dir)) {
        deny(`\`git ${sub}\` would change the main checkout; work in your worktree with \`git -C <worktree>\``);
      }
    }
  }
}

if (MODE === '--integrator') {
  for (const p of parts) {
    for (const cmd of commandsIn(words(p))) {
      const all = cmd.w.filter((x, i, ws) => !(ws[i - 1] === '-C' || x === '-C'));
      // `> push.txt 2>&1` saves the output; it is not part of the push.
      const cut = all.findIndex((x) => /^(\d?>>?|&>)/.test(x));
      const w = cut >= 0 ? all.slice(0, cut) : all;
      if (isPush(w) && w.slice(w.indexOf('push')).join(' ') !== 'push origin HEAD:main') {
        deny('the integrator pushes only with `git push origin HEAD:main`');
      }
    }
  }
}

if (MODE === '--read-only') {
  // A `>` inside quotes is text (a grep pattern), not a redirect.
  const unquoted = text.replace(/"[^"]*"|'[^']*'/g, '""');
  if (/(^|[^0-9&])>{1,2}(?!\s*(&1|\/dev\/null))/.test(unquoted)) deny('the reviewer writes no files');
  const ALLOWED = [
    ['git', 'diff'], ['git', 'log'], ['git', 'show'], ['git', 'status'], ['git', 'merge-base'],
    ['git', 'rev-parse'], ['git', 'branch', '--list'], ['git', 'ls-files'], ['git', 'grep'], ['git', 'fetch'],
    ['gh', 'issue', 'view'], ['gh', 'pr', 'view'], ['cd'],
    ['cat'], ['head'], ['tail'], ['grep'], ['rg'], ['ls'], ['wc'], ['sort'], ['uniq'], ['date'], ['echo'], ['pwd'],
  ];
  for (const p of parts) {
    const w = words(p).filter((x, i, all) => !(x === '-C' || all[i - 1] === '-C' || x === '--no-pager'));
    // A refspec with `:` (main:main) writes a local branch; a plain fetch updates only origin's.
    if (w[0] === 'git' && w[1] === 'fetch' && w.some((x) => x.includes(':'))) deny('the reviewer fetches only origin\'s branches');
    const ok = ALLOWED.some((a) => a.every((x, i) => w[i] === x)) || (w[0] === 'sed' && w[1] === '-n');
    if (!ok) deny(`the reviewer runs inspection commands only, not \`${w.slice(0, 3).join(' ')}\``);
  }
}

process.exit(0);
