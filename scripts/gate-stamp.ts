import { readStamps, runStamped, treeKey, type GateCommand } from './lib/gate-stamp';

/**
 * `npm run gate-stamp -- run [--force] lint test` runs the named gates, skipping any already
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
  test: npm('test'),
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
const key = treeKey(root);
const stamps = readStamps(root, key);
console.log(`tree ${key.slice(0, 12)}`);
for (const gate of gates) console.log(`  ${gate}: ${stamps[gate] ? `passed ${stamps[gate]}` : 'not stamped'}`);
process.exit(gates.every((gate) => stamps[gate]) ? 0 : 1);
