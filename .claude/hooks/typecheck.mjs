// Stop hook: type-check once when Claude finishes a turn that left TypeScript under src/ changed.
// Exit 2 feeds tsc's errors back to Claude, which fixes them before finishing; any other path
// exits 0 silently. A turn whose edits were committed already ran tsc in the pre-commit lint.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

// Already continuing because of a Stop hook: don't loop.
if (input?.stop_hook_active) process.exit(0);

const cwd = input?.cwd ?? process.cwd();

const status = spawnSync('git', ['status', '--porcelain', '--', 'src'], { cwd, encoding: 'utf8' });
if (status.status !== 0) process.exit(0);
const changed = status.stdout
  .split('\n')
  .map((line) => line.slice(3).trim().replace(/^.* -> /, ''))
  .filter((file) => /\.tsx?$/.test(file));
if (changed.length === 0) process.exit(0);

const res = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
  cwd,
  encoding: 'utf8',
  shell: true,
});

if (res.status === 0) process.exit(0);

const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(0, 40).join('\n');
process.stderr.write(`tsc --noEmit failed with ${changed.length} changed TypeScript file(s) under src/:\n${out}\n`);
process.exit(2);
