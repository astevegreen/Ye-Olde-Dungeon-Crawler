// PreToolUse (Bash|PowerShell): asks the owner before a command that could point git's hooks elsewhere.
// git reads config keys in any case, so `core.hookspath` or `CORE.HOOKSPATH` skips the hooks as surely as
// `core.hooksPath`, but the ask rules in .claude/settings.json match one spelling only. Nor can they see a config
// git is told to include (`include.path`, `includeIf.<cond>.path`) or read from a variable (`GIT_CONFIG_GLOBAL`,
// `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_KEY_0`, …), which can set the key out of sight.
// A plain read, `git [-C dir] config [--get] core.hooksPath` in any case, runs as before. So does a line that never
// names git. Quotes and escapes can't hide the key (`core.hooks""Path`, `core.hooks\Path`), and a line holding the
// key that the hook can't read in full, such as one with quotes, `$(…)` or a variable, asks.
// One copy per repo, identical in all of them: the root keeps them in step (YODC, the course, flashcards).
import { pathToFileURL } from 'node:url';

const HOOKS_KEY = /hookspath/i;
const INDIRECT =
  /\binclude(?:if\.\S*)?\.path\b|\bGIT_CONFIG(?:_GLOBAL|_SYSTEM|_PARAMETERS|_COUNT|_KEY_\d+)?\b/i;
const NAMES_GIT = /\bgit(?:config)?\b/i; // git, .git/config, ~/.gitconfig
// After every spelling of the key becomes `core.hooksPath`, a read is git, optional `-C dir`, config, read-only
// options or the `get` subcommand, then the key last. Case matters here: `-c core.hooksPath=x` sets it.
const READ =
  /^git(?:\s+-C\s+[^\s-]\S*)*\s+config(?:\s+(?:get|--get|--get-all|--show-origin|--show-scope|--local|--global|--system|--worktree|--includes|--no-includes|--null|-z))*\s+core\.hooksPath$/;
const REDIRECT = /\s\d*>>?&?\s*[^\s;|&]+/g; // 2>&1, 2>/dev/null, 2>$null, > out.txt
const UNREADABLE = /["'`$(){}<>^]/;
// Quotes and escapes the shells drop from a word: Bash's quotes and backslash, PowerShell's backtick, cmd's caret.
const unquoted = (s) => s.replace(/["'`\\^]/g, '');

// 'ask', or null to leave the command to the permission rules.
export function verdict(command) {
  const flat = unquoted(command);
  if (!NAMES_GIT.test(command) && !NAMES_GIT.test(flat)) return null;
  if (INDIRECT.test(flat)) return 'ask';
  if (!HOOKS_KEY.test(flat)) return null;
  const plain = command.replace(REDIRECT, ' ');
  if (UNREADABLE.test(plain)) return 'ask';
  for (const part of plain.split(/&&|\|\||[;|&\n\r]/)) {
    if (!HOOKS_KEY.test(unquoted(part))) continue;
    const read = part
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\bcore\.hookspath\b/gi, 'core.hooksPath');
    if (!READ.test(read)) return 'ask';
  }
  return null;
}

async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

// Run as the hook; imported by the tests, it only exports.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
            "This could point git's hooks elsewhere (core.hooksPath in some spelling, or a config git includes or reads from a variable), which needs the owner's OK.",
        },
      }),
    );
  }
}
