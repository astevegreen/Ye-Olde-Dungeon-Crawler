// PreToolUse (Bash|PowerShell): asks the owner before a command that could point git's hooks elsewhere.
// The ask rules in .claude/settings.json match `core.hooksPath` as spelled. But git reads config keys in any case
// (`core.hookspath`), the shells can build a key out of pieces (`core.hooks""Path`, `core.hooks$''Path`,
// `('core.hooks'+'Path')`, PowerShell's curly quotes and `@` splatting), and git also takes config from aliases,
// included files, hand-edited config files and the environment. So this hook asks for:
// - git config, -c or --config-env that names core.hooksPath, include.path, includeIf.<cond>.path, alias.* or
//   help.autocorrect in any spelling, or that holds anything it can't read (quotes, escapes, `$`, `@`, brackets,
//   globs), including a git call that a substitution or a block starts later in the line;
// - a line naming git and holding the key that it can't read in full, or a control character or an odd space;
// - a git config file (.git/config, ~/.gitconfig, any path ending in /config) touched by anything but a reader, and
//   any write (a redirect, tee, cp, mv, xargs, Set-Content, …) on a line naming .git, gitconfig, git's own paths
//   (`rev-parse --git-path`), or into a target with a glob;
// - include.path, includeIf, an [include] section, GIT_CONFIG_*, XDG_CONFIG_HOME, or setting HOME.
// A plain read, `git [-C dir] config [--get] core.hooksPath` in any case, runs as before. So does every other line.
// Input it can't parse asks.
// Out of its reach: a line where neither git nor the key is written out (`G=gi; ${G}t config …`), an alias already
// in a config file, a git option it doesn't know that takes the next word, a script file that runs git, and a config
// file reached in another call (`cd .git` in one call, `echo … >> config` in the next). There, the checks the hooks
// would have run are still waiting in CI.
// One copy per repo, identical in all of them: the root keeps them in step (YODC, the course, flashcards).
import path from 'node:path';

const KEY = /hookspath(?![\w-])/i; // not this hook's own file or branch name
const RISKY_KEY = /^(?:core\.hookspath|include\.path|includeif\..*|alias\..*|help\.autocorrect)$/i;
const INDIRECT =
  /\binclude\.path\b|\bincludeif\.|\[\s*include|\bGIT_CONFIG\w*|\bXDG_CONFIG_HOME\b|(?:^|[\s;&|(])(?:\$env:)?HOME\s*=|\bsetx\s+HOME\b|SetEnvironmentVariable\W+HOME\b/i;
// Characters a shell keeps inside a word but a reader takes for a space or skips: control characters, a lone
// carriage return, and Unicode spaces and marks such as U+00A0 and U+FEFF.
const span = (a, b = a) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`;
const ODD_CHAR = new RegExp(
  `[\x00-\x08\x0b\x0c\x0e-\x1f\x7f${[
    span(0xa0),
    span(0x1680),
    span(0x2000, 0x200f),
    span(0x2028, 0x202f),
    span(0x205f, 0x2060),
    span(0x3000),
    span(0xfeff),
  ].join('')}]|\r(?!\n)`,
);
// .git/config, ~/.gitconfig, /etc/gitconfig, or any path whose last part is config (`.gi?/config`, XDG's git/config).
const CONFIG_FILE =
  /\.git[\\/]+config\b|gitconfig\b|[\\/]config(?![\w.\\/-])|>>?\s*config(?![\w.\\/-])/i;
// Where git keeps its config: .git (not .github or .gitignore), gitconfig, git's own path queries, or a glob next to
// `.g` (`.g*/c*`).
const GIT_PLACE =
  /\.git(?![\w-])|gitconf|--(?:git-path|git-dir|git-common-dir|absolute-git-dir)\b|\.g[^\s\\/]*[?*[]/i;
// A write whose target holds a glob: `>> .g*/c*`, `tee -a x/conf?g`, `cp h .gi?/config`.
const GLOB_TARGET =
  />>?\s*\S*[?*[]|\b(?:tee|cp|copy|mv|move|ln|install|ac|sc|add-content|set-content|out-file|copy-item|move-item)\b[^|;&\n]*[?*[]/i;
const WRITES =
  />|\b(?:tee|cp|copy|mv|move|xargs|dd|install|ln|ac|sc|ni|add-content|set-content|out-file|copy-item|move-item|new-item|rename-item)\b|\bsed\s+(?:-\S+\s+)*-\S*i|\[(?:system\.)?io\.file\]/i;
// Redirects that write nothing: 2>&1, >/dev/null, 2>$null, >nul.
const NULL_REDIRECT = /\d*>>?\s*(?:&\d+|\/dev\/null|\$null|nul)(?![\w./\\-])/gi;
const READERS = new Set(
  'cat type get-content gc head tail less more grep rg select-string sls ls dir get-childitem gci cd set-location sl test-path stat wc file get-item gi'.split(
    ' ',
  ),
);
const NAMES_GIT = /\bgit(?:config)?\b/i; // git, .git/config, ~/.gitconfig
// The git command as one word: git, git.exe, a path to it, or the start of `$(git`, `(git` or `{git`.
const GIT = /(?:^|[\\/({])git(?:\.exe)?$/i;
// git glued to a variable or a substitution, such as `git${IFS}config`: nobody can read what it runs.
const GIT_GLUED = /(?:^|[\\/({])git(?:\.exe)?[$`{@]/i;
// git's options that take the next word: -C dir, -c key=value, --git-dir dir, and so on.
const GIT_OPTION_ARG =
  /^(?:-C|-c|--git-dir|--work-tree|--namespace|--super-prefix|--config-env|--attr-source)$/;
// After every spelling of the key becomes `core.hooksPath`, a read is git, optional `-C dir`, config, read-only
// options or the `get` subcommand, then the key last. Case matters here: `-c core.hooksPath=x` sets it.
const READ =
  /^git(?:\s+-C\s+[^\s-]\S*)*\s+config(?:\s+(?:get|--get|--get-all|--show-origin|--show-scope|--local|--global|--system|--worktree|--includes|--no-includes|--null|-z))*\s+core\.hooksPath$/;
// Redirects whose target can't hide a command: 2>&1, 2>/dev/null, 2>$null, > out.txt.
const SAFE_REDIRECT = /\s\d*>>?\s*(?:&\d+|\$null|[\w./\\:~-]+)(?=$|[\s;|&])/gi;
const UNREADABLE = /["'`$@(){}[\]<>^?*‘-‟]/;
const PARTS = /&&|\|\||[;|&\n\r]/;
const WORDS = /[ \t]+/;
// Line continuations, then the quotes and escapes the shells drop from a word: Bash's quotes and backslash,
// PowerShell's backtick and curly quotes, cmd's caret.
const joinLines = (s) => s.replace(/[\\`^]\r?\n/g, '');
const unquoted = (s) => s.replace(/["'`\\^‘-‟]/g, '');
const dequoted = (s) => s.replace(/["'`‘-‟]/g, '');
const isRead = (s) =>
  READ.test(
    s
      .trim()
      .replace(/[ \t]+/g, ' ')
      .replace(/\bcore\.hookspath\b/gi, 'core.hooksPath'),
  );

// A git config file touched by a command other than a reader, or written through a redirect.
function touchesConfigFile(line) {
  for (const part of line.split(PARTS)) {
    if (!CONFIG_FILE.test(unquoted(part)) && !CONFIG_FILE.test(dequoted(part))) continue;
    const first = unquoted(part.trim().split(WORDS)[0] ?? '').toLowerCase();
    const writes = />/.test(part.replace(NULL_REDIRECT, ''));
    if (writes || (!READERS.has(first) && !GIT.test(first))) return true;
  }
  return false; // git's own options (`git config --file …`) are judged by gitAsks
}

// A write on a line that names where git keeps its config, or a path with a glob.
function writesGitPlace(line) {
  const flat = unquoted(line);
  if (!WRITES.test(line.replace(NULL_REDIRECT, ''))) return false;
  return GIT_PLACE.test(flat) || GIT_PLACE.test(line) || GLOB_TARGET.test(line);
}

// True when the git call at `words[at]` sets config that the hook can't vouch for.
function callAsks(words, at) {
  // A word holding quotes, an escape or an expansion can't be vouched for, whatever it spells.
  const unsure = (w) => UNREADABLE.test(w) || w.includes('\\');
  const setsRisky = (raw) => unsure(raw) || RISKY_KEY.test(unquoted(raw).split('=')[0]);
  let i = at + 1;
  // Options are read as git gets them, quotes and escapes taken out: `\-c` is -c.
  for (; i < words.length && unquoted(words[i]).startsWith('-'); i++) {
    const w = unquoted(words[i]);
    const attached = /^-c(.+)$/.exec(w) ?? /^--config-env=(.+)$/.exec(w);
    if (attached && (unsure(words[i]) || setsRisky(attached[1]))) return true;
    if (GIT_OPTION_ARG.test(w)) {
      if ((w === '-c' || w === '--config-env') && setsRisky(words[i + 1] ?? '')) return true;
      i++;
    }
  }
  const sub = words[i];
  if (sub === undefined) return false;
  if (unsure(sub)) return true; // `git $(…)`, `git co""nfig`, PowerShell's `git @args`
  if (sub.toLowerCase() !== 'config') return false;
  const rest = words.slice(i + 1);
  if (rest.some((w) => unsure(w) || /^(?:--edit|-e)$/.test(w))) return true;
  return rest.some((w) => RISKY_KEY.test(w)) && !isRead(words.slice(at).join(' '));
}

// The first git call in `part`, and any later one that a substitution or a block starts (`git status $(git …)`).
// A later `git` inside a quoted commit message starts nothing, so it is left alone.
function gitAsks(part) {
  const words = part.trim().split(WORDS);
  if (words.some((w) => GIT_GLUED.test(w))) return true;
  const isGit = (w) => GIT.test(dequoted(w)) || GIT.test(unquoted(w));
  const first = words.findIndex(isGit);
  if (first < 0) return false;
  return words.some(
    (w, i) => (i === first || (i > first && isGit(w) && /[({`]/.test(w))) && callAsks(words, i),
  );
}

// 'ask', or null to leave the command to the permission rules.
export function verdict(command) {
  const line = joinLines(command);
  const flat = unquoted(line);
  if (INDIRECT.test(flat) || INDIRECT.test(line)) return 'ask';
  if (touchesConfigFile(line) || writesGitPlace(line)) return 'ask';
  if (!NAMES_GIT.test(line) && !NAMES_GIT.test(flat)) return null;
  if (ODD_CHAR.test(line)) return 'ask';
  const plain = line.replace(SAFE_REDIRECT, ' ');
  if (KEY.test(flat)) {
    if (UNREADABLE.test(plain)) return 'ask';
    for (const part of plain.split(PARTS))
      if (KEY.test(unquoted(part)) && !isRead(part)) return 'ask';
  }
  return plain.split(PARTS).some(gitAsks) ? 'ask' : null;
}

async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

// Run as the hook; imported by the tests, it only exports. The file name is compared, not the full path, so a short
// name or another drive-letter case in the path can't switch the hook off.
if (/^hookspath-ask\.mjs$/i.test(path.basename(process.argv[1] ?? ''))) {
  let decision;
  try {
    const input = await readInput();
    decision = verdict(String(input.tool_input?.command ?? ''));
  } catch {
    decision = 'ask';
  }
  if (decision === 'ask') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            "This could point git's hooks elsewhere (core.hooksPath in some spelling, git config the hook can't read, a git config file, or config from an include or the environment), which needs the owner's OK.",
        },
      }),
    );
  }
}
