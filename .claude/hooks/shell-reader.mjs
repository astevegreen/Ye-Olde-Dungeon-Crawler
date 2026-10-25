// How bash or PowerShell reads one command line, for the sprint guards: where its strings and runs end, the
// simple commands it holds, each command's words as the shell reads them, and what a wrapper runs. It decides
// nothing about what is allowed; each repo's guard applies its own rules to what readCommand returns.
// Identical copies live in YODC (.claude/hooks/), Terminal Dusk (tools/hooks/) and the blockchain course
// (tools/hooks/), each beside shell-reader.cases.json, the cases every copy must pass: change all three together.
import path from 'node:path';

// A command the reader can't read word by word (`sh -c "…"`, `eval`, a command held in a variable): refuse it.
export class Unreadable extends Error {}
const unreadable = (why) => {
  throw new Unreadable(why);
};

// Inside a literal, |, ;, &, ), a backtick, $ and a newline are masked, so a search pattern ("a\|b") or a
// multi-line note isn't split. So is an escaped operator outside quotes (`sed -n 1p\;9p`, find's `\;`).
const MASK = { '|': '\u0001', ';': '\u0002', '&': '\u0003', ')': '\u0004', '`': '\u0005', $: '\u0006', '\n': '\u0007' };
const UNMASK = Object.fromEntries(Object.entries(MASK).map(([k, v]) => [v, k]));
const unmask = (s) => s.replace(/[\u0001-\u0007]/g, (c) => UNMASK[c]);
// A message flag's literal value is text the command stores and never runs (a commit message, an issue
// body, a queue note): it is blanked, so a note that mentions `git push`, curl or --no-verify isn't read as
// one. A value holding $ (or, in bash, a backtick) is read like any other word.
const TEXT_FLAG = /(^|\s)(--note|--also|--body|--comment|--title|--message|-m)(=|\s+)$/;
// PowerShell's call operator and dot-source run the command a variable or an expression names (`& $g push`,
// `. (gcm git)`); in bash, `& $g` backgrounds and then runs one. `2>&1` and `&&` are not that &.
const RUNS_VALUE = /(?<![>&])&(?![&>])\s*([$(]|"[^"]*\$)|(^|[;|\n{(&])\s*\.\s+([$(]|"[^"]*\$)/;
// In bash, a command named by a substitution (`$(which git) push`, `"$(which git)" push`, `` `which git` push ``)
// runs what it prints.
const NAMED_BY_RUN = /(^|[;|&\n({!]|\b(then|do|else)\s)\s*"?(\$\(|`)/;
// Git's subcommand or checkout in a variable or a substitution (`git $p`, `git $(echo push)`, `git -C "$d" commit`,
// PowerShell's splatted `git @a`).
const GIT_HIDDEN = /(?<![\w.-])git(\.exe)?["']?(\s+(-C|-c|--git-dir|--work-tree|--namespace|--config-env)\s+\S+|\s+-\S+)*\s+["']?[$`@]/i;

// A command's name as the shell runs it: `/usr/bin/git`, `git.exe` and `Git` are all git.
export const cmdName = (x) => path.posix.basename(String(x ?? '').replace(/\\/g, '/')).toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
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
  // The course's lab tests run as `wsl -d Ubuntu -- bash dynamic-labs/regression-tests/automated/<lab>/run.sh`.
  wsl: ['-d', '--distribution', '-u', '--user', '--cd'],
};
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const STRING_RUNNERS = new Set(['cmd', 'eval', 'invoke-expression', 'iex', 'invoke-command', 'icm']);
// Programs Start-Process may not start: their arguments would run a command the guard never reads as one.
const NOT_STARTED = new Set(['git', 'docker', 'docker-compose', 'podman', 'wsl', 'pwsh', 'powershell', 'curl', 'wget',
  'invoke-webrequest', 'iwr', 'invoke-restmethod', 'irm']);
const GIT_VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
// Git's subcommand: its first word that is not an option or an option's value.
export const gitSub = (w) => {
  for (let i = 1; i < w.length; i++) {
    if (GIT_VALUED.has(w[i])) i++;
    else if (!w[i].startsWith('-')) return w[i];
  }
  return undefined;
};

/**
 * Reads one command line as `shell` ('bash' or 'powershell') would.
 * - text: the line with message values blanked, for checks that read it whole;
 * - literalsBlank: the line with every literal string blanked (a pattern or a note may name `rm -r` or curl);
 * - textRead: its words as the shell reads them, joined (`--no-ver""ify` is --no-verify);
 * - parts: its simple commands, split on control operators, a substitution's commands among them;
 * - words(part): a part's words, quotes joined and escapes removed;
 * - commandsIn(words): the commands one simple command runs (itself, and what a wrapper runs), each
 *   { w, at, fromArgs, repl } (`at`: its first word as written); throws Unreadable when one can't be read;
 * - refusal: why the line runs a command the reader can't see (`& $g`, `$(which git) push`), or null;
 * - gitHidden: git's subcommand or checkout is held in a variable or a substitution.
 */
export function readCommand(command, shell = 'bash') {
  const PS = shell === 'powershell';
  // The escape character: bash's backslash, PowerShell's backtick (in bash a backtick runs a command).
  const ESC = PS ? '`' : '\\';
  // An escape before a newline joins the two lines into one command: `git \⏎push` pushes, in PowerShell `git `⏎push`.
  const line = String(command ?? '').replace(PS ? /`\r?\n/g : /\\\r?\n/g, ' ');

  // Where a run that starts at i ends, as the shell finds it. `$(…)` holds a command of its own, whose quotes
  // and parentheses nest (`"$(echo "a"; git push)"` is one string); a bash backtick run ends at the next
  // unescaped backtick; a double-quoted string ends at its first quote outside a run.
  function tickEnd(s, i) {
    while (i < s.length && s[i] !== '`') i += s[i] === '\\' ? 2 : 1;
    return i;
  }
  function doubleEnd(s, i) {
    while (i < s.length && s[i] !== '"') {
      if (s[i] === ESC) i += 2;
      else if (s[i] === '$' && s[i + 1] === '(') i = parenEnd(s, i + 2) + 1;
      else if (s[i] === '`' && !PS) i = tickEnd(s, i + 1) + 1;
      else i++;
    }
    return i;
  }
  function parenEnd(s, i) {
    for (let depth = 0; i < s.length; i++) {
      const c = s[i];
      if (c === ESC) i++;
      else if (c === "'") i = s.indexOf("'", i + 1) < 0 ? s.length : s.indexOf("'", i + 1);
      else if (c === '"') i = doubleEnd(s, i + 1);
      else if (c === '`' && !PS) i = tickEnd(s, i + 1);
      else if (c === '$' && s[i + 1] === '(') i = parenEnd(s, i + 2);
      else if (c === '(') depth++;
      else if (c === ')' && depth-- === 0) return i;
    }
    return s.length;
  }
  // In double quotes that run a command, only `$(…)` and bash's backticks hold commands, each read as a
  // command of its own; an operator elsewhere in them is text (`--body "Done; $n left"`).
  function maskDouble(q, blankAll) {
    let out = '';
    for (let k = 0; k < q.length; k++) {
      const c = q[k];
      if (c === ESC) {
        out += c + (q[k + 1] ?? '');
        k++;
        continue;
      }
      const tick = c === '`' && !PS;
      if (tick || (c === '$' && q[k + 1] === '(')) {
        const from = k + (tick ? 1 : 2);
        const end = tick ? tickEnd(q, from) : parenEnd(q, from);
        out += q.slice(k, from) + maskQuoted(q.slice(from, end), blankAll) + (q[end] ?? '');
        k = end;
        continue;
      }
      out += /[|;&)\n]/.test(c) ? MASK[c] : c;
    }
    return out;
  }
  // A literal in quotes is text: single quotes, or double quotes holding no $ (nor, in bash, a backtick).
  // `blankAll` empties every literal, not only a message flag's value.
  function maskQuoted(s, blankAll = false) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === ESC) {
        out += `${ESC}${/[|;&)]/.test(s[i + 1] ?? '') ? MASK[s[i + 1]] : s[i + 1] ?? ''}`;
        i++;
        continue;
      }
      if (c !== '"' && c !== "'") {
        out += c;
        continue;
      }
      const j = c === '"' ? doubleEnd(s, i + 1) : s.indexOf("'", i + 1) < 0 ? s.length : s.indexOf("'", i + 1);
      const q = s.slice(i, j + 1);
      const literal = c === "'" || !(PS ? /\$/ : /[$`]/).test(q);
      if (literal && (blankAll || TEXT_FLAG.test(out))) out += "''";
      else out += literal ? q.replace(/[|;&)`$\n]/g, (x) => MASK[x]) : maskDouble(q, blankAll);
      i = j;
    }
    return out;
  }

  const masked = maskQuoted(line);
  const text = unmask(masked);
  let refusal = null;
  if (RUNS_VALUE.test(masked)) refusal = '`& $x`, `& (…)` and `. $x` run a command the guard can\'t read; run it by name';
  else if (!PS && NAMED_BY_RUN.test(masked)) {
    refusal = 'a command named by `$(…)` or backticks runs what it prints, which the guard can\'t read; run it by name';
  }
  // A lone & ends a command (bash's background) or starts one (PowerShell's call operator); `2>&1` and `&>`
  // are redirects.
  const parts = masked
    .split(PS ? /&&|\|\||(?<!>)&(?!>)|[;|\n]|\$\(|\)/ : /&&|\|\||(?<!>)&(?!>)|[;|\n`]|\$\(|\)/)
    .map((p) => unmask(p).trim())
    .filter(Boolean);

  // A word as the shell reads it: its quoted and unquoted pieces joined (`git "pu"sh` and `git pu''sh` are git
  // push), without the quotes, and without an escape outside single quotes (`git pu\sh`, PowerShell's `git pu`sh`).
  const E = PS ? '`' : '\\\\';
  const WORD = new RegExp(`(?:[^\\s"']+|"(?:[^"${E}]|${E}.)*"|'[^']*'|["'])+`, 'g');
  const PIECE = new RegExp(`"((?:[^"${E}]|${E}.)*)"|'([^']*)'|["']|[^"']+`, 'g');
  const unescape = (s, inDouble) => (PS ? s.replace(/`(.)/g, '$1') : s.replace(inDouble ? /\\([$`"\\])/g : /\\(.)/g, '$1'));
  const words = (s) => s.match(WORD)?.map((w) => w.replace(PIECE, (piece, dq, sq) =>
    sq ?? (dq !== undefined ? unescape(dq, true) : /^["']$/.test(piece) ? '' : unescape(piece, false)))) ?? [];

  // The commands one simple command runs: itself, and what a wrapper (env, nice, xargs, find -exec, ...)
  // runs from its words. A wrapper that runs a string (sh -c, cmd, eval) can't be read word by word.
  // `fromArgs`: find or xargs adds words to it, `repl` being xargs' or find's placeholder.
  function commandsIn(raw, fromArgs = false, repl = null, depth = 0) {
    if (depth > 4) unreadable('too many nested wrappers to read');
    const w = [...raw];
    // PowerShell runs the command an assignment stores: `$x = git push`, `$x=git push`, `$env:X += …`.
    for (let lead = true; lead && w.length;) {
      const bare = w[0].replace(/^(\[[\w.]+\])*@?[({]+|^(\[[\w.]+\])+$/, '');
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
      if (PS) return [];
      unreadable(`\`${w[0]}\` runs a command held in a variable, which the guard can't read; run it by name`);
    }
    const name = cmdName(w[0]);
    const self = { w: [name, ...w.slice(1)], at: w[0], fromArgs, repl };
    const inner = (rest, args = fromArgs, r = repl) => commandsIn(rest, args, r, depth + 1);

    if (name in PREFIX) {
      const valued = new Set(PREFIX[name]);
      let i = 1;
      let xrepl = null;
      for (; i < w.length; i++) {
        const t = w[i];
        if (t === '--') {
          i++;
          break;
        }
        if (name === 'wsl' && (t === '-e' || t === '--exec')) {
          i++;
          break;
        }
        if (name === 'env' && (t === '-' || ASSIGN.test(t))) continue;
        if (name === 'env' && /^(-S|--split-string)/.test(t)) unreadable('`env -S` runs a string the guard can\'t read');
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
        if (/^\d*<+$/.test(t)) {
          i++;
          continue;
        }
        if (/^\d*</.test(t)) continue;
        if (t === '--') {
          script = i + 1 < w.length;
          break;
        }
        if (/^-[A-Za-z]*[cs][A-Za-z]*$/.test(t) || t === '--command') unreadable(`\`${name} -c\` runs a string the guard can't read; run the command itself`);
        if (/^[-+][oO]$|^--(rcfile|init-file)$/.test(t)) {
          i++;
          continue;
        }
        if (/^[-+]/.test(t)) continue;
        script = true;
        break;
      }
      if (!script) unreadable(`\`${name}\` with no script reads its commands from input, which the guard can't read`);
      return [self];
    }
    if (name === 'pwsh' || name === 'powershell') {
      // Parameters may be shortened (-c, -com, -e, -f) and start with -, -- or /.
      const params = [];
      for (let i = 1; i < w.length; i++) if (/^(--?|\/)[A-Za-z]+$/.test(w[i])) params.push([w[i].replace(/^(--?|\/)/, '').toLowerCase(), i]);
      const file = params.find(([p]) => 'file'.startsWith(p));
      if (params.some(([p]) => p.startsWith('c') || p === 'ec' || 'encodedcommand'.startsWith(p)) || !file || w[file[1] + 1] === '-') {
        unreadable(`\`${name}\` runs only with -File here: a -Command string can't be read by the guard`);
      }
      return [self];
    }
    if (STRING_RUNNERS.has(name)) unreadable(`\`${name}\` runs a string the guard can't read; run the command itself`);
    if (['start-process', 'start', 'saps'].includes(name)) {
      const runs = w.slice(1).flatMap((t) => t.split(',')).map((t) => cmdName(t.replace(/^['"]|['"]$/g, '')));
      if (runs.some((r) => NOT_STARTED.has(r) || SHELLS.has(r) || STRING_RUNNERS.has(r))) {
        unreadable(`\`${name}\` may not start git, Docker, WSL, a shell or a web fetch; run the command itself`);
      }
    }
    return [self];
  }

  return {
    text,
    literalsBlank: unmask(maskQuoted(line, true)),
    textRead: words(text).join(' '),
    parts,
    words,
    commandsIn: (raw) => commandsIn(raw),
    refusal,
    gitHidden: GIT_HIDDEN.test(masked),
  };
}
