// PreToolUse hook on Read, Grep and Glob: package-lock.json is 150 KB of resolved versions that npm reads and no
// session needs (`npm ls --depth=0` lists what is installed). Until 28 Oct a `Read(package-lock.json)` deny rule
// did this, but Claude Code applies Read deny rules to Bash commands that name the file too, so it also refused
// `git diff -- package-lock.json` and `git add package.json package-lock.json`. This hook leaves Bash alone.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const target = String(input.tool_input?.file_path ?? input.tool_input?.path ?? '');
if (/(^|[\\/])package-lock\.json$/i.test(target)) {
  process.stderr.write(
    'lockfile-read: package-lock.json is npm\'s, not a session\'s: `npm ls --depth=0` lists what is installed, and `git diff --stat` says whether it changed.\n',
  );
  process.exit(2);
}
