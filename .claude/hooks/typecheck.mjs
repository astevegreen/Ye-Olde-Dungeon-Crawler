// PostToolUse hook: type-check after Edit/Write on a TypeScript file under src/.
// Exit 2 feeds tsc's errors back to Claude; any other path exits 0 silently.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const file = String(input?.tool_input?.file_path ?? '').replace(/\\/g, '/');
if (!/\/src\/.+\.tsx?$/.test(file)) process.exit(0);

const res = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
  cwd: input.cwd ?? process.cwd(),
  encoding: 'utf8',
  shell: true,
});

if (res.status === 0) process.exit(0);

const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(0, 40).join('\n');
process.stderr.write(`tsc --noEmit failed after editing ${file}:\n${out}\n`);
process.exit(2);
