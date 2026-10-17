// Handoff notes live on origin's `handoffs` branch: an orphan branch that holds only notes, never
// merges into main and deploys nothing. Local and cloud sessions read and write the same branch
// through this script, and the working branch is never touched: notes are committed with plumbing
// on a private index, so no commit hook runs, and .githooks/pre-push skips the gates for a push
// that updates only this branch. Times are UTC: cloud sessions run in UTC, and names sort as times.
//
//   node notes.mjs publish <file>   check a new note, stamp its line 2 (time, branch, HEAD, tree,
//                                   folder), file it as .prompts/handoffs/<YYYY-MM-DD-HHMM>-<slug>.md
//                                   and push it; a file already named so keeps its name
//   node notes.mjs record <file>    push a claimed note again, with the owner's answers in it
//   node notes.mjs list             unresumed notes, newest first, with their line 2
//   node notes.mjs claim [name]     take a note (the only open one when no name is given): copy it to
//                                   .prompts/handoffs/, append Resumed:, push it, and print it with
//                                   what changed since it was written
// Exit codes: 0 done, 1 error or a note that fails its checks, 2 usage, 3 the note is claimed
// (another session took it first), 4 several notes are open: name one.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRANCH = 'handoffs';
const REF = `refs/remotes/origin/${BRANCH}`;
const LOCAL = '.prompts/handoffs';
const MAX_LINES = 40;
const NAMED = /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/;
const HEADER =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC · branch (\S+) · HEAD ([0-9a-f]+) · tree (clean|\d+ uncommitted files?)(?: · folder (.+))?$/;

class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// git's trimmed stdout; null when it fails and `soft` is set, otherwise a throw.
function git(args, { cwd, env, soft = false, timeout } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      env: env ?? process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    }).trim();
  } catch (err) {
    if (soft) return null;
    throw new Error(`git ${args.join(' ')}: ${String(err.stderr ?? err.message).trim()}`);
  }
}

// An explicit refspec, so a single-branch clone fetches it too.
const fetchNotes = (cwd) => git(['fetch', '-q', 'origin', `+refs/heads/${BRANCH}:${REF}`], { cwd, soft: true }) !== null;
const tip = (cwd) => git(['rev-parse', '-q', '--verify', `${REF}^{commit}`], { cwd, soft: true }) || null;
const noteAt = (commit, name, cwd) => git(['show', `${commit}:${name}`], { cwd, soft: true });
const isClaimed = (text) => /^Resumed:/m.test(text ?? '');
const samePath = (a, b) => {
  const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const statusLines = (cwd) => (git(['status', '--porcelain'], { cwd, soft: true }) ?? '').split('\n').filter(Boolean);

export function stamp(now = new Date()) {
  const iso = now.toISOString();
  return { text: `${iso.slice(0, 10)} ${iso.slice(11, 16)}`, file: `${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}` };
}

// The facts line 2 records about the checkout a note is written in.
function treeFacts(cwd) {
  const changed = statusLines(cwd).length;
  return {
    root: git(['rev-parse', '--show-toplevel'], { cwd }),
    branch: git(['branch', '--show-current'], { cwd, soft: true }) || '(detached)',
    head: git(['rev-parse', '--short', 'HEAD'], { cwd, soft: true }) || 'none',
    tree: changed ? `${plural(changed, 'uncommitted file')}` : 'clean',
  };
}

export function header(cwd, now = new Date()) {
  const f = treeFacts(cwd);
  // A cloud session's disk goes with it, so its path names nothing a later session can open.
  const folder = process.env.CLAUDE_CODE_REMOTE ? 'cloud' : f.root;
  return `${stamp(now).text} UTC · branch ${f.branch} · HEAD ${f.head} · tree ${f.tree} · folder ${folder}`;
}

// Open notes on the local copy of origin/handoffs, newest first, each with its line 2.
export function openNotes(cwd) {
  const commit = tip(cwd);
  if (!commit) return [];
  return (git(['ls-tree', '--name-only', commit], { cwd, soft: true }) ?? '')
    .split('\n')
    // Notes only: a patch parked on the branch to carry a commit off a machine is never claimed.
    .filter((name) => name.endsWith('.md'))
    .sort()
    .reverse()
    .map((name) => ({ name, text: noteAt(commit, name, cwd) ?? '' }))
    .filter((n) => !isClaimed(n.text))
    .map((n) => ({ name: n.name, header: n.text.split('\n')[1] ?? '' }));
}

const format = (notes) => notes.map((n) => `${n.name}  ${n.header}`).join('\n');

// Commit `file` to origin/handoffs as `name`, on a private index, and push it. `mode` says what a
// copy on the branch that is already claimed means: a new note can't take that name, a claim lost
// the race, and a record is that claimed note being updated.
function push(file, name, mode, cwd) {
  const idx = path.resolve(cwd, git(['rev-parse', '--git-path', 'handoffs-index'], { cwd }));
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  for (let tries = 1; ; tries++) {
    fetchNotes(cwd);
    const parent = tip(cwd);
    // Checked on every try, so a claim that lost the push race sees the winner's line.
    if (parent && mode !== 'record' && isClaimed(noteAt(parent, name, cwd))) {
      throw mode === 'claim'
        ? new Refusal(3, `already claimed: another session took ${name}`)
        : new Refusal(3, `not published: ${name} on origin/${BRANCH} is claimed; write the new note to a new file`);
    }
    rmSync(idx, { force: true });
    git(parent ? ['read-tree', parent] : ['read-tree', '--empty'], { cwd, env });
    const blob = git(['-c', 'core.safecrlf=false', 'hash-object', '-w', `--path=${name}`, file], { cwd });
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`], { cwd, env });
    const tree = git(['write-tree'], { cwd, env });
    rmSync(idx, { force: true });
    if (parent && tree === git(['rev-parse', `${parent}^{tree}`], { cwd })) return `unchanged: ${name} is already on origin/${BRANCH}`;
    const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `handoff: ${name}`], { cwd });
    if (git(['push', '-q', 'origin', `${commit}:refs/heads/${BRANCH}`], { cwd, soft: true }) !== null) {
      git(['update-ref', REF, commit], { cwd });
      return `pushed ${name} to origin/${BRANCH} (${git(['rev-parse', '--short', commit], { cwd })})`;
    }
    // Another session pushed a note first: rebuild on the new tip.
    if (tries === 3) throw new Refusal(1, `push to origin/${BRANCH} failed 3 times; the note is only on this disk: ${file}`);
  }
}

export function publish(file, { cwd, now = new Date() }) {
  if (!existsSync(file)) throw new Refusal(1, `not published: no such file: ${file}`);
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n');
  const line2 = header(cwd, now);
  // Line 2 is publish's: replace whatever the draft put there, or insert it above the first section.
  const second = lines[1] ?? '';
  const body = second.startsWith('#') ? ['', ...lines.slice(1)] : second.trim() === '' ? lines.slice(1) : lines.slice(2);
  const note = [lines[0], line2, ...body];

  const problems = [];
  if (!lines[0].startsWith('# Handoff:')) problems.push('line 1 must be "# Handoff: <task in a few words>"');
  for (const section of ['## Goal', '## Next']) if (!lines.includes(section)) problems.push(`it has no "${section}" section`);
  if (lines.some((l) => l.startsWith('Resumed:')))
    problems.push('it was claimed (Resumed:), so /handoff resume would never offer it; write further work as a new note');
  if (note.length > MAX_LINES) problems.push(`it is ${note.length} lines; keep it to ${MAX_LINES}`);
  if (problems.length) throw new Refusal(1, `not published: ${problems.join('; ')}.`);

  const base = path.basename(file);
  const slug =
    base
      .replace(/\.md$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'note';
  // A note already named by publish is being updated: it keeps its name, and its place on the branch.
  const name = NAMED.test(base) ? base : `${stamp(now).file}-${slug}.md`;
  const dest = path.join(cwd, LOCAL, name);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, `${note.join('\n')}\n`);
  if (!samePath(path.resolve(file), dest)) rmSync(file);
  return `${push(dest, name, 'publish', cwd)}\n${line2}\n${path.posix.join(LOCAL, name)}`;
}

export function record(file, { cwd }) {
  if (!existsSync(file)) throw new Refusal(1, `not recorded: no such file: ${file}`);
  if (!isClaimed(readFileSync(file, 'utf8'))) throw new Refusal(1, 'not recorded: it has no Resumed: line; a new note goes through publish.');
  return push(file, path.basename(file), 'record', cwd);
}

export function list({ cwd }) {
  const fetched = fetchNotes(cwd);
  const notes = openNotes(cwd);
  const warn = fetched ? '' : `could not fetch origin/${BRANCH} (not created yet, or offline); showing the last copy fetched\n`;
  if (!tip(cwd)) return `${warn}no notes on origin/${BRANCH}`;
  return warn + (notes.length ? format(notes) : `no unresumed notes on origin/${BRANCH}`);
}

export function claim(name, { cwd, now = new Date() }) {
  fetchNotes(cwd);
  const commit = tip(cwd);
  if (!commit) throw new Refusal(1, `no notes on origin/${BRANCH}`);
  if (!name) {
    const notes = openNotes(cwd);
    if (notes.length === 0) throw new Refusal(1, `no unresumed notes on origin/${BRANCH}`);
    if (notes.length > 1)
      throw new Refusal(4, `${notes.length} open notes; ask the owner which one, then run claim <name>:\n${format(notes)}`);
    name = notes[0].name;
  }
  name = path.basename(name);
  const text = noteAt(commit, name, cwd);
  if (text === null) throw new Refusal(1, `no note named ${name} on origin/${BRANCH}`);
  if (isClaimed(text)) throw new Refusal(3, `already claimed: another session took ${name}`);

  const dest = path.join(cwd, LOCAL, name);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, text.endsWith('\n') ? text : `${text}\n`);
  appendFileSync(dest, `Resumed: ${stamp(now).text} UTC\n`);
  const pushed = push(dest, name, 'claim', cwd);
  const note = readFileSync(dest, 'utf8').trimEnd();
  return [note, '', '## Since the note', ...sinceNote(note.split('\n')[1], cwd).map((l) => `- ${l}`), '', pushed, `Claimed copy: ${path.posix.join(LOCAL, name)}`].join('\n');
}

// Where the note's work is now, against what its line 2 recorded: what to run to bring it in,
// and what can't be brought in from here.
export function sinceNote(line2, cwd) {
  const m = HEADER.exec(line2 ?? '');
  if (!m) return ['Line 2 is not one publish wrote: check the branch and commits by hand (SKILL.md, Resume step 2).'];
  const [, branch, sha, tree, folder] = m;
  const out = [];

  const shallow = git(['rev-parse', '--is-shallow-repository'], { cwd, soft: true }) === 'true';
  if (git(['fetch', '-q', ...(shallow ? ['--unshallow'] : []), 'origin'], { cwd, soft: true, timeout: 120_000 }) === null)
    out.push('Fetch: origin could not be reached; what follows is from what this clone already has.');

  const here = treeFacts(cwd);
  if (here.branch !== branch) out.push(`Branch: the note was on ${branch}; this folder is on ${here.branch}.`);
  if (git(['cat-file', '-e', `${sha}^{commit}`], { cwd, soft: true }) === null) {
    out.push(
      `Commits: the note's HEAD ${sha} is in no branch here or on origin: its work never left the machine that wrote it. Tell the owner before going on.`,
    );
  } else if (git(['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd, soft: true }) !== null) {
    const log = git(['log', '--oneline', '-15', `${sha}..HEAD`], { cwd, soft: true });
    out.push(log ? `Commits since the note:\n${log.replace(/^/gm, '  ')}` : 'Commits: none since the note.');
  } else {
    const holders = (git(['branch', '-a', '--contains', sha, '--format=%(refname:short)'], { cwd, soft: true }) ?? '')
      .split('\n')
      .filter((b) => b && b !== 'origin' && b !== `origin/${BRANCH}` && !b.endsWith('/HEAD'));
    const from = holders.find((b) => b === `origin/${branch}`) ?? holders.find((b) => b === branch) ?? holders[0];
    out.push(
      from
        ? `Commits: HEAD lacks the note's HEAD ${sha}. Bring it in: \`git merge --no-edit ${from}\` (a conflict goes to the owner).`
        : `Commits: the note's HEAD ${sha} is in no branch: tell the owner before going on.`,
    );
  }

  if (folder === 'cloud') {
    if (tree !== 'clean') out.push(`Uncommitted: the note saw ${tree} in a cloud session; they went with it.`);
  } else if (folder && samePath(folder, here.root)) {
    const now = statusLines(cwd);
    if (now.length || tree !== 'clean')
      out.push(`Uncommitted: ${plural(now.length, 'file')} here now; the note saw ${tree}.`, ...now.slice(0, 15).map((l) => `  ${l}`));
  } else if (folder && existsSync(folder) && git(['rev-parse', '--show-toplevel'], { cwd: folder, soft: true }) !== null) {
    const there = statusLines(folder).length;
    if (there || tree !== 'clean')
      out.push(
        `Uncommitted: the note was written in ${folder}, which has ${plural(there, 'uncommitted file')} now (the note saw ${tree}). ` +
          `They are not in this folder: tell the owner, and recommend a session opened in ${folder}.`,
      );
  } else if (tree !== 'clean') {
    out.push(
      folder
        ? `Uncommitted: the note saw ${tree} in ${folder}, which is not on this machine (another PC, or a removed worktree): they are not here.`
        : `Uncommitted: the note saw ${tree}, and its line 2 names no folder: check where they are before going on.`,
    );
  }
  return out;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invoked) {
  const [command, arg] = process.argv.slice(2);
  const start = process.cwd();
  let code = 0;
  let out;
  try {
    const cwd = git(['rev-parse', '--show-toplevel'], { cwd: start });
    const file = arg && path.resolve(start, arg);
    if (command === 'publish' && arg) out = publish(file, { cwd });
    else if (command === 'record' && arg) out = record(file, { cwd });
    else if (command === 'list') out = list({ cwd });
    else if (command === 'claim') out = claim(arg, { cwd });
    else {
      code = 2;
      out = 'usage: node notes.mjs publish <file> | record <file> | list | claim [name]';
    }
  } catch (err) {
    code = err instanceof Refusal ? err.code : 1;
    out = err instanceof Refusal ? err.message : `notes.mjs: ${err.message}`;
  }
  (code ? process.stderr : process.stdout).write(`${out}\n`);
  process.exit(code);
}
