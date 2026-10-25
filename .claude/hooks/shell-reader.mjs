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
// Bash's `$'…'` single-character escapes.
const ANSI = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
// The frames the fold (in readCommand) reads a line in. COMMAND frames run commands: the line itself, a subshell,
// `$(…)`, a process substitution `<(…)`, and double quotes around them. A backtick run ('`') runs commands too, but
// bash finds its closing backtick before reading them, so a comment in it ends there and a heredoc in it can't be
// followed. A SPAN holds no command of its own. In arithmetic (`$((…))` and a `((…))` command, 'z(' and 'a('), `${…}`
// ('z{') and `$[…]` ('z['), a `<<` is a shift or a pattern. In a GUESSED span, a `(` glued to a word ('g(': an
// extglob, an array, a function's `()`) and a word's `[…]` ('w[': `a[1<<2]=x`, but `echo a[1<<2]` opens a heredoc),
// the reader can't tell.
const COMMAND = new Set(['cmd', '(', '$(', '<(', 'dq']);
const SPAN = new Set(['z(', 'z[', 'z{', 'a(', 'g(', 'w[']);
const GUESSED = new Set(['g(', 'w[']);
// A heredoc the fold follows: `<<` or `<<-`, then a plain delimiter, bare or wholly quoted (<<EOF, <<'EOF', <<"EOF",
// <<\EOF), ending its word.
const PLAIN_HEREDOC = /^<<(-?)[ \t]*(?:([\w.:+@%=/-]+)|'([^'\n]*)'|"([^"$`\\\n]*)"|\\([\w.:+@%=/-]+))(?=[\s;|&<>)]|$)/;
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
// A script read from input: `bash /dev/stdin <<'EOF'`, `echo … | sh -`, `source /dev/fd/3`, however the path is
// spelled (`/dev//stdin`, `/dev/./stdin`, `../../dev/stdin`).
const STDIN = /(^|\/)(dev\/stdin|dev\/fd\/\d+|proc\/[^/]+\/fd\/\d+)$/i;
const isStdin = (t) => t === '-' || STDIN.test(path.posix.normalize(t.replace(/\\/g, '/')).replace(/\/+$/, ''));
// A script path the reader can't spell out (`$f`, a substitution, a glob, `{a,b}`) may name input too.
const fromInput = (t) => isStdin(t) || /[$`*?[]|\{[^}]*(,|\.\.)[^}]*\}/.test(t);
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
 * - refusal: why the line runs a command the reader can't see (`& $g`, `$(which git) push`), or can't be sure where
 *   its comments and heredocs end (`cat <<$'EOF'`, a quote never closed), or null;
 * - gitHidden: git's subcommand or checkout is held in a variable or a substitution;
 * - heredocs: each heredoc or here-string's body, { quoted, body }; `quoted` bodies are literal input.
 */
export function readCommand(command, shell = 'bash') {
  const PS = shell === 'powershell';
  // The escape character: bash's backslash, PowerShell's backtick (in bash a backtick runs a command).
  const ESC = PS ? '`' : '\\';
  const heredocs = [];
  const raw = String(command ?? '');
  // Why the fold can't be sure where the line's comments and heredocs end, if it can't: the line is refused.
  let unsure = null;
  const doubt = (why) => {
    unsure ??= `${why}, so the guard can't tell what runs; write it plainly`;
  };
  // An escape before a newline joins the two lines into one command: `git \⏎push` pushes, in PowerShell `git `⏎push`.
  // Comments, `$'…'` strings and heredoc bodies are folded first (fold, below); a body's own escapes are literal.
  const line = fold(raw).replace(PS ? /`\r?\n/g : /\\\r?\n/g, ' ');

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
  // The runs in a heredoc body or an expandable here-string: `$(…)` and, in bash, backticks. A `$((…))` stays whole,
  // read like one on the command line, since a `$(…)` inside it runs (and in PowerShell it is a `$(…)`).
  function runsIn(body) {
    const runs = [];
    for (let k = 0; k < body.length; k++) {
      if (body[k] === ESC) k++;
      else if (body.startsWith('$(', k) || (body[k] === '`' && !PS)) {
        const end = body[k] === '`' ? tickEnd(body, k + 1) : parenEnd(body, k + 2);
        if (end >= body.length) doubt('a run in a heredoc or here-string is never closed');
        runs.push(body.slice(k, end + 1));
        k = end;
      }
    }
    return runs;
  }
  // Decodes the bash `$'…'` escape at s[k] into [the character, the escape's length] (`$'\x70ush'` is push).
  function ansiEscape(s, k) {
    const rest = s.slice(k + 1);
    if (rest[0] in ANSI) return [ANSI[rest[0]], 2];
    let m = /^x([0-9a-fA-F]{1,2})/.exec(rest) ?? /^u([0-9a-fA-F]{1,4})/.exec(rest) ?? /^U([0-9a-fA-F]{1,8})/.exec(rest);
    if (m) return [String.fromCodePoint(parseInt(m[1], 16)), 2 + m[1].length];
    m = /^[0-7]{1,3}/.exec(rest);
    if (m) return [String.fromCharCode(parseInt(m[0], 8)), 1 + m[0].length];
    m = /^c(.)/.exec(rest);
    if (m) return [String.fromCharCode(m[1].charCodeAt(0) & 31), 3];
    return [`\\${rest[0] ?? ''}`, 2];
  }
  // One pass over the line before anything else reads it, keeping the frames the shell keeps (COMMAND, SPAN), so that:
  // - a comment is dropped: a `#` that starts a word, to the end of its line (after a space, `;`, `|`, `&`, `<`, `>`,
  //   `(`, a subshell's or a case pattern's `)`; in PowerShell also `{`, `}` and any `)`), and PowerShell's `<# … #>`;
  //   nothing in one opens a string or a heredoc;
  // - bash's `$'…'` is decoded into a plain single-quoted string;
  // - a heredoc body is input, not commands (a `$(…)` inside double quotes included, the usual
  //   `git commit -m "$(cat <<'EOF' … EOF)"`). A quoted delimiter (<<'X', <<"X", <<\X) keeps the body literal, so the
  //   body is cut out; an unquoted body runs only its `$(…)` and backticks, which stay, one to a line. `<<-` strips
  //   leading tabs before the delimiter is matched; `<<<` is a here-string and `$((a<<2))` arithmetic.
  // - PowerShell's here-strings read the same way: @'…'@ is literal, @"…"@ runs only its `$(…)`. One opens only
  //   where a word starts and ends its line, and closes at a line starting '@ or "@.
  // A wrong cut hides a command, so the fold cuts only in command frames all the way down, and not after PowerShell's
  // `--%`; anywhere else the text stays and is read as commands. Where even that can't be sure, the line is doubted
  // (and refused): a heredoc whose delimiter isn't a plain word, or that may open where its body can't be followed, a
  // body that would start inside another frame, and a quote, frame, `<# … #>` or here-string never closed.
  function fold(s) {
    let out = '';
    let pending = [];
    const stack = ['cmd'];
    // Whether the next character starts a word, so that a `#` there starts a comment.
    let start = true;
    // After PowerShell's `--%` the rest of the line, to a `|` outside double quotes, goes to the program as written:
    // nothing in it is a comment, a quote or a here-string, and its quotes are blanked.
    let verbatim = false;
    let verbatimQuote = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const ctx = stack[stack.length - 1];
      // Opens `frames` with the `len` characters at i.
      const enter = (len, ...frames) => {
        stack.push(...frames);
        out += s.slice(i, i + len);
        i += len - 1;
        start = !SPAN.has(frames[frames.length - 1]);
      };
      if (verbatim) {
        if (c === '"') verbatimQuote = !verbatimQuote;
        if (c === '\n' || (c === '|' && !verbatimQuote)) verbatim = false;
        else {
          out += /["'`]/.test(c) ? ' ' : c;
          continue;
        }
      }
      if (c === ESC) {
        out += c + (s[i + 1] ?? '');
        i++;
        start = false;
        continue;
      }
      // Runs, arithmetic and `${…}` open the same way inside double quotes and out of them. Like bash, `$((` is
      // arithmetic only when its inner `(` closes just before the outer one; `$((ls) )` runs a subshell.
      if (!PS && s.startsWith('$((', i)) {
        if (s[parenEnd(s, i + 3) + 1] === ')') enter(3, 'z(', 'z(');
        else enter(2, '$(');
        continue;
      }
      if (s.startsWith('${', i)) {
        enter(2, 'z{');
        continue;
      }
      if (!PS && s.startsWith('$[', i)) {
        enter(2, 'z[');
        continue;
      }
      if (s.startsWith('$(', i)) {
        enter(2, '$(');
        continue;
      }
      if (c === '`' && !PS) {
        if (ctx !== '`') enter(1, '`');
        else {
          stack.pop();
          out += c;
          start = false;
        }
        continue;
      }
      if (ctx === 'dq') {
        if (c === '"') stack.pop();
        out += c;
        start = false;
        continue;
      }
      // A command frame or a span. In double quotes, or a span inside them, a single quote is a character.
      let under = stack.length - 1;
      while (SPAN.has(stack[under])) under--;
      const inDouble = stack[under] === 'dq';
      const span = SPAN.has(ctx);
      const sure = stack.every((f) => COMMAND.has(f));
      if (c === '\n' && pending.length) {
        const where = stack.join(' ');
        if (pending.every((doc) => doc.where === where)) {
          out += c;
          let p = i + 1;
          for (const doc of pending) {
            let body = '';
            while (p < s.length) {
              const nl = s.indexOf('\n', p);
              const end = nl < 0 ? s.length : nl;
              const text = s.slice(p, end).replace(/\r$/, '');
              p = end + 1;
              if ((doc.strip ? text.replace(/^\t+/, '') : text) === doc.delimiter) break;
              body += `${text}\n`;
            }
            heredocs.push({ quoted: doc.quoted, body });
            if (!doc.quoted) out += runsIn(body).map((r) => `${r}\n`).join('');
          }
          pending = [];
          i = p - 1;
          start = true;
          continue;
        }
        doubt('a heredoc\'s body would start inside a run or a span its `<<` is not in');
        pending = [];
      }
      if (c === '#' && start && sure) {
        const nl = s.indexOf('\n', i);
        i = (nl < 0 ? s.length : nl) - 1;
        continue;
      }
      if (PS && start && sure && s.startsWith('<#', i)) {
        const end = s.indexOf('#>', i + 2);
        if (end < 0) doubt('a `<#` comment is never closed');
        i = (end < 0 ? s.length : end + 2) - 1;
        out += ' ';
        continue;
      }
      if (PS && start && sure && /^--%(\s|$)/.test(s.slice(i, i + 4))) {
        verbatim = true;
        verbatimQuote = false;
        out += '--%';
        i += 2;
        continue;
      }
      const here = PS && start && sure ? /^@(['"])[ \t]*\r?\n/.exec(s.slice(i, i + 64)) : null;
      if (here) {
        const from = i + here[0].length;
        const close = s.indexOf(`\n${here[1]}@`, from - 1);
        if (close < 0) doubt('a here-string is never closed');
        const body = s.slice(from, close < 0 ? s.length : close).replace(/\r$/, '');
        const quoted = here[1] === "'";
        heredocs.push({ quoted, body });
        out += quoted ? "''" : `"${runsIn(body).join(' ')}"`;
        i = (close < 0 ? s.length : close + 3) - 1;
        start = false;
        continue;
      }
      if (c === "'" && !inDouble) {
        const end = s.indexOf("'", i + 1);
        if (end < 0) doubt('a quote is never closed');
        out += s.slice(i, end < 0 ? s.length : end + 1);
        i = end < 0 ? s.length : end;
        start = false;
        continue;
      }
      if (!PS && !inDouble && c === '$' && s[i + 1] === "'") {
        let text = '';
        let k = i + 2;
        while (k < s.length && s[k] !== "'") {
          if (s[k] === '\\') {
            const [ch, len] = ansiEscape(s, k);
            text += ch;
            k += len;
          } else {
            text += s[k];
            k++;
          }
        }
        if (k >= s.length) doubt('a quote is never closed');
        out += `'${text.replace(/'/g, "'\\''")}'`;
        i = k;
        start = false;
        continue;
      }
      if (c === '"') {
        enter(1, 'dq');
        start = false;
        continue;
      }
      // Bash's process substitution runs a command, and its word goes on after it (`<(x)#y`).
      if (!PS && !span && (c === '<' || c === '>') && s[i + 1] === '(') {
        enter(2, '<(');
        continue;
      }
      if (c === '(') {
        if (span) enter(1, GUESSED.has(ctx) ? 'g(' : 'z(');
        else if (PS) enter(1, '(');
        // A `((…))` command is arithmetic on the same test as `$((`; otherwise it is two subshells.
        else if (start && s[i + 1] === '(' && s[parenEnd(s, i + 2) + 1] === ')') enter(2, 'a(', 'z(');
        else enter(1, start ? '(' : 'g(');
        continue;
      }
      if (c === ')') {
        const closes = ['(', '$(', '<(', 'z(', 'a(', 'g('].includes(ctx);
        if (closes) stack.pop();
        out += c;
        // A word goes on after a run's, arithmetic's or a glued `)` (`$(x)#y`, `a=(x)#y`); a subshell's, a `((…))`
        // command's and a case pattern's `)` end it, and in PowerShell every `)` does.
        start = PS || ctx === '(' || ctx === 'a(' || (!closes && !span);
        continue;
      }
      if (c === '{' && ctx === 'z{') {
        enter(1, 'z{');
        continue;
      }
      if (c === '}' && ctx === 'z{') {
        stack.pop();
        out += c;
        start = false;
        continue;
      }
      // A word's `[…]` may be an assignment's subscript (`a[1<<2]=x`, `a[ i ]=x`); a bracket inside a span is one.
      if (!PS && c === '[' && (span || (!start && /(^|[\s;|&(){}<>`])[A-Za-z_]\w*$/.test(s.slice(Math.max(0, i - 128), i))))) {
        enter(1, span && !GUESSED.has(ctx) ? 'z[' : 'w[');
        continue;
      }
      if (c === ']' && (ctx === 'z[' || ctx === 'w[')) {
        stack.pop();
        out += c;
        start = false;
        continue;
      }
      if (!PS && s.startsWith('<<<', i)) {
        out += '<<<';
        i += 2;
        start = true;
        continue;
      }
      // In arithmetic, `${…}` or `$[…]` a `<<` is a shift or a pattern; anywhere else it may open a heredoc.
      if (!PS && s.startsWith('<<', i) && (!span || GUESSED.has(ctx))) {
        const op = sure ? PLAIN_HEREDOC.exec(s.slice(i)) : null;
        if (op) {
          pending.push({ strip: op[1] === '-', delimiter: op[2] ?? op[3] ?? op[4] ?? op[5], quoted: op[2] === undefined, where: stack.join(' ') });
          out += op[0];
          i += op[0].length - 1;
          start = false;
          continue;
        }
        doubt(sure ? 'a heredoc\'s delimiter is not a plain word' : 'a `<<` may open a heredoc in a backtick run, a span or a glued `(…)` or `[…]`');
      }
      out += c;
      start = (PS ? /[\s;|&(){}]/ : /[\s;|&<>]/).test(c);
    }
    // An open subscript is only a word with a `[` in it (`echo a[`).
    if (stack.some((f) => f !== 'cmd' && f !== 'w[')) doubt('a quote, a run or a span is never closed');
    return out;
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
  // The fold's doubt first: past it, what the line runs may be misread.
  let refusal = unsure;
  if (!refusal && RUNS_VALUE.test(masked)) refusal = '`& $x`, `& (…)` and `. $x` run a command the guard can\'t read; run it by name';
  else if (!refusal && !PS && NAMED_BY_RUN.test(masked)) {
    refusal = 'a command named by `$(…)` or backticks runs what it prints, which the guard can\'t read; run it by name';
  }
  // A lone & ends a command (bash's background) or starts one (PowerShell's call operator); `2>&1` and `&>`
  // are redirects. Bash's process substitutions `<(…)` and `>(…)` run a command like `$(…)`.
  const parts = masked
    .split(PS ? /&&|\|\||(?<!>)&(?!>)|[;|\n]|\$\(|\)/ : /&&|\|\||(?<!>)&(?!>)|[;|\n`]|[$<>]\(|\)/)
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
    // `.` with no file, or input as its file (`. <(…)` leaves it alone), runs what it reads.
    if (raw[0] === '.' && (raw.length === 1 || fromInput(raw[1]))) unreadable('`.` runs a script read from input, which the guard can\'t read');
    const w = [...raw];
    // PowerShell runs the command an assignment stores: `$x = git push`, `$x=git push`, `$env:X += …`.
    for (let lead = true; lead && w.length;) {
      const bare = w[0].replace(/^(\[[\w.]+\])*[@!]?[({]+|^(\[[\w.]+\])+$/, '');
      const glued = /^(\[[\w.]+\])*\$[^\s=]+?[-+*/%]?=(.*)$/.exec(w[0]);
      if (LEAD.has(w[0]) || ASSIGN.test(w[0]) || !bare) w.shift();
      else if (bare !== w[0]) w[0] = bare;
      else if (glued && glued[2]) w[0] = glued[2];
      else if (glued) w.shift();
      else if (/^(\[[\w.]+\])*\$\S+$/.test(w[0]) && /^[-+*/%]?=$/.test(w[1] ?? '')) w.splice(0, 2);
      else lead = false;
    }
    if (!w.length) return [];
    if (isStdin(w[0])) unreadable(`\`${w[0]}\` runs a script read from input, which the guard can't read`);
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
          if (fromInput(w[i + 1] ?? '')) unreadable(`\`${name}\` runs a script read from input, which the guard can't read`);
          script = i + 1 < w.length;
          break;
        }
        if (/^-[A-Za-z]*[cs][A-Za-z]*$/.test(t) || t === '--command') unreadable(`\`${name} -c\` runs a string the guard can't read; run the command itself`);
        if (/^[-+][oO]$|^--(rcfile|init-file)$/.test(t)) {
          i++;
          continue;
        }
        if (/^[-+]/.test(t)) continue;
        if (fromInput(t)) unreadable(`\`${name}\` runs a script read from input, which the guard can't read`);
        script = true;
        break;
      }
      if (!script) unreadable(`\`${name}\` with no script reads its commands from input, which the guard can't read`);
      return [self];
    }
    if (name === 'source') {
      const file = w.slice(1).find((t) => !t.startsWith('-') || t === '-');
      if (!file || fromInput(file)) unreadable('`source` runs a script read from input, which the guard can\'t read');
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
    heredocs,
  };
}
