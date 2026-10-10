// Stop hook: once the conversation passes LIMIT tokens, send Claude back to write the handoff
// before it finishes the turn. CLAUDE.md's "the session has run long" never fired on judgement
// alone: sessions ran to auto-compaction first. Fires once per session, and again only after the
// context drops below LIMIT (a compaction) and climbs past it once more. Exit 2 feeds the reason
// to Claude; any other path exits 0 silently.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIMIT = 150_000;

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
if (input?.stop_hook_active || !input?.transcript_path || !input?.session_id) process.exit(0);

let entries;
try {
  entries = readFileSync(input.transcript_path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
} catch {
  process.exit(0);
}

// Context size: what the latest model call read, cached or not.
let context = 0;
for (let i = entries.length - 1; i >= 0; i--) {
  const usage = entries[i].type === 'assistant' && entries[i].message?.usage;
  if (usage) {
    context =
      (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    break;
  }
}

const marker = join(tmpdir(), 'yodc-handoff-nudge', input.session_id.replace(/[^\w-]/g, ''));
if (context < LIMIT) {
  rmSync(marker, { force: true });
  process.exit(0);
}
if (existsSync(marker)) process.exit(0);

// A handoff written this turn already did the job; a resume (list, claim) did not.
const toolUses = entries
  .slice(lastOwnerMessage(entries) + 1)
  .flatMap((e) => (e.type === 'assistant' && Array.isArray(e.message?.content) ? e.message.content : []))
  .filter((part) => part?.type === 'tool_use');
const handedOff = toolUses.some(
  (part) =>
    (part.name === 'Skill' &&
      String(part.input?.skill ?? '').endsWith('handoff') &&
      !String(part.input?.args ?? '').trim().startsWith('resume')) ||
    /notes\.sh"?\s+publish/.test(String(part.input?.command ?? '')),
);

mkdirSync(join(tmpdir(), 'yodc-handoff-nudge'), { recursive: true });
writeFileSync(marker, String(context));
if (handedOff) process.exit(0);

process.stderr.write(
  `The conversation is ${Math.round(context / 1000)}k tokens, past the ${LIMIT / 1000}k handoff line ` +
    `(CLAUDE.md, Sessions: the session has run long). Before ending this turn, run the handoff skill's ` +
    `write branch. A question this turn was about to ask the owner goes under Decide first; work in ` +
    `progress stays uncommitted and listed, as the skill says.\n`,
);
process.exit(2);

function lastOwnerMessage(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e.type !== 'user' || e.isMeta) continue;
    const content = e.message?.content;
    if (typeof content === 'string') return i;
    if (Array.isArray(content) && content.some((part) => part?.type === 'text')) return i;
  }
  return -1;
}
