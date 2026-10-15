// Stop hook, two checks, both held while background work is running (below). A reply that sends the owner to /clear or /handoff resume goes back to
// Claude unless an unclaimed note is published (below). And once the conversation passes LIMIT tokens, send Claude back to write the handoff
// before it finishes the turn. CLAUDE.md's "the session has run long" never fired on judgement
// alone: sessions ran to auto-compaction first. Fires once per session, and again only after the
// context drops below LIMIT (a compaction) and climbs past it once more. Exit 2 feeds the reason
// to Claude; any other path exits 0 silently.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIMIT = 200_000;

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

// A turn that ends by sending the owner to /clear or /handoff resume needs a note `list` will
// offer: published by this session after its last commit, with no Resumed: line. Sessions that
// resumed a note, worked on, and republished that claimed note sent the owner to an empty list.
// Only the reply's closing instruction counts ("After `/clear`, type `/handoff resume`"), not a
// reply that explains the workflow ("if Claude tells you to /clear or /handoff resume").
const closing = lastAssistantText(entries).trim().split(/\n\s*\n/).slice(-2).join('\n');
const CLEAR = '`?/clear`?';
const sendsToClear = new RegExp(
  `${CLEAR}[^.\\n]{0,40}?\\b(then|and)\\b[^.\\n]{0,30}(/handoff resume|fresh session)` +
    `|\\b(after|with|suggest|ready to|to continue[:,]?|to start it[:,]?)\\s+(type\\s+|run\\s+)?${CLEAR}`,
  'i',
);
// Background work still running (a push and its gates, a test run, an agent) makes any note written
// now say "running" and sends the next session to check it. Hold the size nudge until the turn that
// follows its notification, and stop a reply that sends the owner to /clear before it lands.
const running = runningInBackground(entries);
if (running.length > 0) {
  if (sendsToClear.test(closing)) {
    process.stderr.write(
      `Your reply sends the owner to /clear, but background work is still running: ${running.join('; ')}. ` +
        `End the turn saying what it waits on; when its notification arrives, report the result and ` +
        `write or update the note with it, so the next session has nothing to check.\n`,
    );
    process.exit(2);
  }
  process.exit(0);
}

if (sendsToClear.test(closing) && !publishedOpenNote(entries)) {
  process.stderr.write(
    `Your reply sends the owner to /clear or /handoff resume, but this session has published no ` +
      `unclaimed note since its last commit, so the next session's \`notes.sh list\` finds nothing. ` +
      `Run the handoff skill's write branch now (a new note; a note you resumed stays claimed), then ` +
      `tell the owner. When the reply only explains the workflow, or \`notes.sh list\` already shows ` +
      `the note it points to, end the turn as it is.\n`,
  );
  process.exit(2);
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

// Calls started in the background (a Bash or PowerShell run_in_background, an async Agent) whose
// <task-notification>, naming the call's <tool-use-id>, has not arrived. A launch older than
// STALE_MS counts as finished: a task that was stopped or lost never notifies.
function runningInBackground(list) {
  const STALE_MS = 2 * 60 * 60 * 1000;
  const calls = new Map();
  const started = new Set();
  const finished = new Set();
  for (const e of list) {
    const content = e.message?.content;
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === 'tool_use') {
          calls.set(part.id, { what: part.input?.description ?? part.name, at: Date.parse(e.timestamp ?? '') });
        }
      }
    }
    if (e.type === 'user' && Array.isArray(content)) {
      for (const part of content) {
        if (part?.type !== 'tool_result') continue;
        const text = Array.isArray(part.content) ? part.content.map((x) => x?.text ?? '').join('') : String(part.content ?? '');
        if (/Command running in background with ID|Async agent launched/.test(text)) started.add(part.tool_use_id);
      }
    }
    const raw = JSON.stringify(e);
    if (raw.includes('task-notification')) {
      for (const m of raw.matchAll(/<tool-use-id>(toolu_\w+)<\/tool-use-id>/g)) finished.add(m[1]);
    }
  }
  const now = Date.now();
  return [...started]
    .filter((id) => !finished.has(id))
    .map((id) => calls.get(id))
    .filter((call) => call && !(now - call.at > STALE_MS))
    .map((call) => call.what);
}

function lastAssistantText(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const content = list[i].type === 'assistant' && list[i].message?.content;
    if (!Array.isArray(content)) continue;
    const text = content.filter((part) => part?.type === 'text').map((part) => part.text).join('\n');
    if (text) return text;
  }
  return '';
}

// The latest `notes.sh publish` after the latest `git commit` printed `pushed` or `unchanged`
// for a note that, on the local copy of origin/handoffs, carries no Resumed: line.
function publishedOpenNote(list) {
  const results = new Map();
  for (const e of list) {
    if (e.type !== 'user' || !Array.isArray(e.message?.content)) continue;
    for (const part of e.message.content) {
      if (part?.type !== 'tool_result') continue;
      const c = part.content;
      results.set(part.tool_use_id, Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : String(c ?? ''));
    }
  }
  let name = null;
  for (const e of list) {
    if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) continue;
    for (const part of e.message.content) {
      const command = part?.type === 'tool_use' ? String(part.input?.command ?? '') : '';
      if (/notes\.sh"?\s+publish/.test(command)) {
        const out = results.get(part.id) ?? '';
        const m = out.match(/pushed (\S+\.md) to origin|unchanged: (\S+\.md) is already/);
        if (m) name = m[1] ?? m[2];
      } else if (/\bgit\s+commit\b/.test(command)) {
        name = null;
      }
    }
  }
  if (!name) return false;
  try {
    const note = execFileSync('git', ['show', `refs/remotes/origin/handoffs:${name}`], {
      cwd: input.cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return !/^Resumed:/m.test(note);
  } catch {
    return false;
  }
}

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
