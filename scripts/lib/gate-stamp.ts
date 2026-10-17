import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Gate stamps (docs/architecture/quality-gates.md, "Local pre-commit hook").
 *
 * A stamp records that a gate passed on exactly one working tree, identified by a SHA-256 of
 * the content of every tracked and every untracked-but-not-ignored file (plus the Node
 * version). The pre-commit hook asks for it before running lint and the unit tests, so the
 * second and later commits cut from one working tree ("one request per commit", ARCHITECTURE.md
 * §8.4) don't rerun gates that just passed on identical content.
 *
 * A stamp is a cache of a pass, never an authority, so every doubt runs the gate:
 *  - a tree that cannot be fingerprinted (no git, an unreadable file, a nested repository)
 *    runs every gate and writes no stamp;
 *  - a stamp is written only if the tree is byte-identical before and after the gates ran;
 *  - any edit, added file or deletion changes the key, so the old stamp simply never matches.
 * A gate that names its `paths` is keyed on those files alone, so an edit elsewhere leaves its
 * stamp standing; a path that names no file throws, so a renamed one can't drop out unseen.
 * Stamps live in `<git-dir>/gate-stamps/`, per clone and never committed.
 */

const STAMP_VERSION = 1;
/** Stamp files kept on disk; the oldest are pruned on each write. */
export const KEEP_STAMPS = 40;

/** A gate's command. `shell` is true for `npm`, which is a `.cmd` shim on Windows. */
export interface GateCommand {
  file: string;
  args: string[];
  shell: boolean;
  /** The only files its result depends on, when not the whole tree; a trailing `/` names a directory. */
  paths?: string[];
}

/** Gate name -> ISO time it passed on the stamped tree. */
export type Stamps = Record<string, string>;

function git(root: string, args: string[]): string {
  const env = { ...process.env };
  // `git commit <paths>` runs the hook against a temporary index; the real one is the truth.
  delete env.GIT_INDEX_FILE;
  return execFileSync('git', args, {
    cwd: root,
    env,
    encoding: 'utf-8',
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const firstLine = (err: unknown): string => (err instanceof Error ? err.message : String(err)).split('\n')[0] ?? '';

/**
 * Fingerprint of the working tree: path and content hash of every tracked and untracked,
 * not-ignored file, or of those under `paths`. Raw bytes, so a line-ending flip also changes
 * it (the gates do read line endings). Throws when it cannot be sure, which the caller
 * treats as "no stamp".
 */
export function treeKey(root: string, paths?: readonly string[]): string {
  const listed = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0');
  let files = [...new Set(listed.filter(Boolean))].sort();
  const key = createHash('sha256');
  key.update(`gate-stamp v${STAMP_VERSION}\0node ${process.version}\0`);
  if (paths) {
    const under = (file: string, scope: string): boolean => (scope.endsWith('/') ? file.startsWith(scope) : file === scope);
    const empty = paths.find((scope) => !files.some((file) => under(file, scope)));
    if (empty !== undefined) throw new Error(`'${empty}' names no file`);
    files = files.filter((file) => paths.some((scope) => under(file, scope)));
    key.update(`paths ${[...paths].sort().join('\0')}\0`);
  }
  for (const file of files) {
    key.update(`${file}\0`);
    try {
      key.update(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest());
    } catch (err) {
      // Listed by git but gone from disk: a deletion is part of the tree's state. Anything
      // else (a directory from a nested repository, a permission error) is not.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      key.update('deleted');
    }
  }
  return key.digest('hex');
}

function stampDir(root: string): string {
  return path.resolve(root, git(root, ['rev-parse', '--git-path', 'gate-stamps']).trim());
}

/** The gates stamped for this tree key; empty when there are none or the file is unusable. */
export function readStamps(root: string, key: string): Stamps {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(stampDir(root), `${key}.json`), 'utf-8')) as {
      version?: number;
      gates?: Stamps;
    };
    return parsed.version === STAMP_VERSION && parsed.gates && typeof parsed.gates === 'object' ? parsed.gates : {};
  } catch {
    return {};
  }
}

/** Record that `gates` passed on the tree `key`, merged with what is already stamped for it. */
export function writeStamps(root: string, key: string, gates: string[], now: Date = new Date()): void {
  const dir = stampDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const merged: Stamps = readStamps(root, key);
  for (const gate of gates) merged[gate] = now.toISOString();
  const file = path.join(dir, `${key}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ version: STAMP_VERSION, gates: merged }, null, 2)}\n`);
  fs.renameSync(tmp, file);

  const stale = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(KEEP_STAMPS);
  for (const { name } of stale) fs.rmSync(path.join(dir, name), { force: true });
}

export interface RunOptions {
  root: string;
  gates: string[];
  commands: Record<string, GateCommand>;
  /** Run every gate even where a stamp exists (the stamp is still written afterwards). */
  force?: boolean;
  /** False ignores stamps entirely: nothing read, nothing written (`GATE_STAMP=off`). */
  useStamps?: boolean;
  log?: (line: string) => void;
}

export interface RunResult {
  /** 0 when every gate passed or was skipped, else the failing gate's exit status. */
  status: number;
  skipped: string[];
  stamped: string[];
}

/**
 * Run `gates` in order, skipping each one already stamped for this exact tree (or its own
 * `paths`), stopping at the first failure. After a full pass, stamp the gates that ran,
 * provided what they are keyed on did not change underneath them.
 */
export function runStamped(opts: RunOptions): RunResult {
  const { root, gates, commands } = opts;
  const log = opts.log ?? ((line: string) => console.log(line));
  for (const gate of gates) if (!commands[gate]) throw new Error(`gate-stamp: unknown gate '${gate}'`);

  // Gates naming the same paths share one key; one that can't be computed leaves them unstamped.
  const scopeOf = (gate: string): string => JSON.stringify(commands[gate]!.paths ?? null);
  const keyOf = (gate: string): string => treeKey(root, commands[gate]!.paths);
  const keys = new Map<string, string | null>();
  if (opts.useStamps !== false) {
    for (const gate of gates) {
      if (keys.has(scopeOf(gate))) continue;
      try {
        keys.set(scopeOf(gate), keyOf(gate));
      } catch (err) {
        keys.set(scopeOf(gate), null);
        log(`gate-stamp: cannot fingerprint the tree for ${gate} (${firstLine(err)}); running it unstamped`);
      }
    }
  }
  const keyFor = (gate: string): string | null => keys.get(scopeOf(gate)) ?? null;

  const known: Stamps = {};
  for (const gate of gates) {
    const key = keyFor(gate);
    const when = key && !opts.force ? readStamps(root, key)[gate] : undefined;
    if (when) known[gate] = when;
  }
  const skipped = gates.filter((gate) => known[gate]);
  if (skipped.length > 0) {
    const when = skipped.map((gate) => `${gate} ${known[gate]}`).join(', ');
    log(`gate-stamp: already passed on this exact tree, not re-running: ${when}`);
  }

  const todo = gates.filter((gate) => !known[gate]);
  for (const gate of todo) {
    const { file, args, shell } = commands[gate]!;
    log(`gate-stamp: ${[file, ...args].join(' ')}`);
    const result = spawnSync(file, args, { cwd: root, stdio: 'inherit', shell });
    if (result.status !== 0) return { status: result.status ?? 1, skipped, stamped: [] };
  }

  const stamped = new Set<string>();
  let changed = false;
  for (const [scope, key] of keys) {
    const ran = todo.filter((gate) => scopeOf(gate) === scope);
    if (!key || ran.length === 0) continue;
    let after: string | null = null;
    try {
      after = keyOf(ran[0]!);
    } catch {
      // Unverifiable, so unstamped.
    }
    if (after !== key) {
      changed = true;
      continue;
    }
    try {
      writeStamps(root, key, ran);
      for (const gate of ran) stamped.add(gate);
    } catch (err) {
      log(`gate-stamp: could not write the stamp (${firstLine(err)}); the gates passed regardless`);
    }
  }
  if (changed) log('gate-stamp: the tree changed while the gates ran, so no stamp was written');
  return { status: 0, skipped, stamped: gates.filter((gate) => stamped.has(gate)) };
}
