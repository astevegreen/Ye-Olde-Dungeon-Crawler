// PreToolUse (Bash|PowerShell): asks the owner before a command that could point git's hooks elsewhere.
// The ask rules in .claude/settings.json match `core.hooksPath` as spelled. But git reads config keys in any case
// (`core.hookspath`), the shells can build a key out of pieces (`core.hooks""Path`, `core.hooks$''Path`,
// `('core.hooks'+'Path')`), and git also takes config from included files, hand-edited config files and the
// environment. So this hook asks for:
// - git config, -c or --config-env that names core.hooksPath, include.path or includeIf.<cond>.path in any
//   spelling, or that holds anything it can't read (quotes, `$`, brackets, globs);
// - a line naming git and holding the key that it can't read in full;
// - a git config file (.git/config, ~/.gitconfig, any path ending in /config) touched by anything but a reader;
// - include.path, includeIf, an [include] section, GIT_CONFIG_*, XDG_CONFIG_HOME, or setting HOME.
// A plain read, `git [-C dir] config [--get] core.hooksPath` in any case, runs as before. So does every other line.
// Input it can't parse asks.
// Out of its reach: a line where neither git nor the key is written out (`G=gi; ${G}t config …`), a script file that
// runs git, and a config file reached in another call (`cd .git`, then `echo … >> config`). There, the checks the
// hooks would have run are still waiting in CI.
// One copy per repo, identical in all of them: the root keeps them in step (YODC, the course, flashcards).
import path from 'node:path';

const KEY = /hookspath(?![\w-])/i; // not this hook's own file or branch name
const RISKY_KEY = /^(?:core\.hookspath|include\.path|includeif\..*)$/i;
const INDIRECT =
  /\binclude\.path\b|\bincludeif\.|\[\s*include|\bGIT_CONFIG\w*|\bXDG_CONFIG_HOME\b|(?:^|[\s;&|(])(?:\$env:)?HOME\s*=|\bsetx\s+HOME\b|SetEnvironmentVariable\W+HOME\b/i;
// .git/config, ~/.gitconfig, /etc/gitconfig, or any path whose last part is config (`.gi?/config`, XDG's git/config).
const CONFIG_FILE =
  /\.git[\\/]+config\b|gitconfig\b|[\\/]config(?![\w.\\/-])|>>?\s*config(?![\w.\\/-])/i;
const READERS = new Set(
  'cat type get-content gc head tail less more grep rg select-string sls ls dir get-childitem gci cd set-location sl test-path stat wc file get-item gi'.split(
    ' ',
  ),
);
const NAMES_GIT = /\bgit(?:config)?\b/i; // git, .git/config, ~/.gitconfig
// The git command as one word: git, git.exe, a path to it, or the start of `$(git` or `(git`.
const GIT = /(?:^|[\\/({])git(?:\.exe)?$/i;
// git glued to a variable or a substitution, such as `git${IFS}config`: nobody can read what it runs.
const GIT_GLUED = /(?:^|[\\/({])git(?:\.exe)?[$`{]/i;
// git's options that take the next word: -C dir, -c key=value, --git-dir dir, and so on.
const GIT_OPTION_ARG = /^(?:-C|-c|--git-dir|--work-tree|--namespace|--super-prefix|--config-env)$/;
// After every spelling of the key becomes `core.hooksPath`, a read is git, optional `-C dir`, config, read-only
// options or the `get` subcommand, then the key last. Case matters here: `-c core.hooksPath=x` sets it.
const READ =
  /^git(?:\s+-C\s+[^\s-]\S*)*\s+config(?:\s+(?:get|--get|--get-all|--show-origin|--show-scope|--local|--global|--system|--worktree|--includes|--no-includes|--null|-z))*\s+core\.hooksPath$/;
// Redirects whose target can't hide a command: 2>&1, 2>/dev/null, 2>$null, > out.txt.
const SAFE_REDIRECT = /\s\d*>>?\s*(?:&\d+|\$null|[\w./\\:~-]+)(?=$|[\s;|&])/gi;
const UNREADABLE = /["'`$(){}[\]<>^?*]/;
const PARTS = /&&|\|\||[;|&\n\r]/;
// Line continuations, then the quotes and escapes the shells drop from a word: Bash's quotes and backslash,
// PowerShell's backtick, cmd's caret.
const joinLines = (s) => s.replace(/[\\`^]\r?\n/g, '');
const unquoted = (s) => s.replace(/["'`\\^]/g, '');
const dequoted = (s) => s.replace(/["'`]/g, '');
const isRead = (s) =>
  READ.test(
    s
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\bcore\.hookspath\b/gi, 'core.hooksPath'),
  );

// A git config file touched by a command other than a reader, or written through a redirect.
function touchesConfigFile(line) {
  for (const part of line.split(PARTS)) {
    if (!CONFIG_FILE.test(unquoted(part)) && !CONFIG_FILE.test(dequoted(part))) continue;
    const first = unquoted(part.trim().split(/\s+/)[0] ?? '').toLowerCase();
    const writes = />/.test(
      part.replace(/\d*>>?\s*(?:&\d+|\/dev\/null|\$null|nul)(?![\w./\\-])/gi, ''),
    );
    if (writes || (!READERS.has(first) && !GIT.test(first))) return true;
  }
  return false; // git's own options (`git config --file …`) are judged by gitAsks
}

// True when a git call in `part` sets config that the hook can't vouch for.
function gitAsks(part) {
  const words = part.trim().split(/\s+/);
  if (words.some((w) => GIT_GLUED.test(w))) return true;
  const at = words.findIndex((w) => GIT.test(dequoted(w)) || GIT.test(unquoted(w)));
  if (at < 0) return false;
  const setsRisky = (kv) => UNREADABLE.test(kv) || RISKY_KEY.test(unquoted(kv).split('=')[0]);
  let i = at + 1;
  for (; i < words.length && words[i].startsWith('-'); i++) {
    const w = words[i];
    const attached = /^-c(.+)$/.exec(w) ?? /^--config-env=(.+)$/.exec(w);
    if (attached && setsRisky(attached[1])) return true;
    if (GIT_OPTION_ARG.test(w)) {
      if ((w === '-c' || w === '--config-env') && setsRisky(words[i + 1] ?? '')) return true;
      i++;
    }
  }
  const sub = words[i];
  if (sub === undefined) return false;
  if (UNREADABLE.test(sub)) return true; // `git $(…)`, `git co""nfig`
  if (unquoted(sub).toLowerCase() !== 'config') return false;
  const rest = words.slice(i + 1);
  if (rest.some((w) => UNREADABLE.test(w) || /^(?:--edit|-e)$/.test(w))) return true;
  return rest.some((w) => RISKY_KEY.test(unquoted(w))) && !isRead(words.slice(at).join(' '));
}

// 'ask', or null to leave the command to the permission rules.
export function verdict(command) {
  const line = joinLines(command);
  const flat = unquoted(line);
  if (INDIRECT.test(flat) || INDIRECT.test(line)) return 'ask';
  if (touchesConfigFile(line)) return 'ask';
  if (!NAMES_GIT.test(line) && !NAMES_GIT.test(flat)) return null;
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
