import { readStamps, runStamped, treeKey, type GateCommand } from './lib/gate-stamp';

/**
 * `npm run gate-stamp -- run [--force] lint test tooling` runs the named gates, skipping any already
 * stamped for this exact working tree, and stamps them after a full pass. The pre-commit hook
 * calls it without `--force`; `npm run gates` calls it with `--force`, because its job is to
 * produce real output, and stamps what it ran.
 *
 * `npm run gate-stamp -- status [gate...]` says whether the current tree is stamped for each
 * gate (default: all of them) and exits 1 if any is not.
 *
 * `GATE_STAMP=off` ignores stamps altogether. Why, and why it is safe:
 * docs/architecture/quality-gates.md, "Local pre-commit hook".
 */

const npm = (...args: string[]): GateCommand => ({ file: 'npm', args, shell: true });
const COMMANDS: Record<string, GateCommand> = {
  lint: npm('run', 'lint'),
  test: npm('run', 'test:unit'),
  // The tests that spawn processes to try the repo's own tooling (the `tooling` project in
  // vite.config.ts), about half the suite's time, keyed on what they exercise: a commit that
  // leaves it alone skips them. The pre-push hook and CI run them on every push, since a game
  // change can break one too (the engine-creep test plants a real spell id).
  tooling: {
    ...npm('run', 'test:tooling'),
    paths: [
      'scripts/',
      '.githooks/',
      '.claude/skills/handoff/notes.mjs',
      '.claude/hooks/handoff-nudge.mjs',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
    ],
  },
};

const [command, ...rest] = process.argv.slice(2);
const names = rest.filter((arg) => !arg.startsWith('--'));
const unknown = names.filter((name) => !COMMANDS[name]);
if ((command !== 'run' && command !== 'status') || unknown.length > 0 || (command === 'run' && names.length === 0)) {
  if (unknown.length > 0) console.error(`gate-stamp: unknown gate '${unknown[0]}' (known: ${Object.keys(COMMANDS).join(', ')})`);
  console.error('usage: gate-stamp run [--force] <gate...> | gate-stamp status [gate...]');
  process.exit(2);
}

const root = process.cwd();

if (command === 'run') {
  const result = runStamped({
    root,
    gates: names,
    commands: COMMANDS,
    force: rest.includes('--force'),
    useStamps: process.env.GATE_STAMP !== 'off',
  });
  process.exit(result.status);
}

const gates = names.length > 0 ? names : Object.keys(COMMANDS);
const passed = gates.map((gate) => {
  const key = treeKey(root, COMMANDS[gate]!.paths);
  const when = readStamps(root, key)[gate];
  console.log(`${gate} (tree ${key.slice(0, 12)}): ${when ? `passed ${when}` : 'not stamped'}`);
  return Boolean(when);
});
process.exit(passed.every(Boolean) ? 0 : 1);
