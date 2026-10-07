import * as path from 'node:path';

/**
 * `--overlay <tree-path>=<file>` (repeatable), taken by check-engine-purity and
 * check-engine-encapsulation: the gate reads `<file>`'s text as though it sat at
 * `<tree-path>` (relative to the repository root), so it is scoped, checked and reported
 * by that path. A gate's regression test plants its violation this way instead of writing
 * under src/, where other suites walk in parallel and would race a file appearing and
 * vanishing. Without the flag a gate sees the tree exactly as it is.
 *
 * Returns absolute tree path -> absolute file path.
 */
export function readOverlays(root: string, argv: string[] = process.argv): Map<string, string> {
  const overlays = new Map<string, string>();
  argv.forEach((arg, i) => {
    if (arg !== '--overlay') return;
    const spec = argv[i + 1] ?? '';
    const eq = spec.indexOf('=');
    if (eq <= 0 || eq === spec.length - 1) {
      console.error(`❌ --overlay expects <tree-path>=<file>, got '${spec}'`);
      process.exit(1);
    }
    overlays.set(path.resolve(root, spec.slice(0, eq)), path.resolve(spec.slice(eq + 1)));
  });
  return overlays;
}
