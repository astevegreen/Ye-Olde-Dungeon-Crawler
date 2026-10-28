// What scripts/second-look.mjs decides from agy's answers: which files are rails, and whether the change may be
// pushed. The owner's gates since 28 Oct (CLAUDE.md, "What waits on the owner"): a [blocker] from the second look
// holds the push like a reviewer blocker, notes never do; a change touching a rail gets a deep rail audit, and
// only its "yes, this loosens" holds the change for the owner. Types: second-look.d.mts.

// The rails: what a change could loosen to hide its own failure. Hooks and guards, the sprint skills and agents
// that wire them, git hooks, CI, the gates with their allowlists and configs, the review itself, and the sprint's
// queue and push lock. Path prefixes from the repository root.
export const RAILS = [
  '.claude/settings',
  '.claude/hooks/',
  '.claude/skills/sprint-',
  '.claude/agents/implementer.md',
  '.claude/agents/reviewer.md',
  '.githooks/',
  '.github/',
  'scripts/sprint/',
  'scripts/check-',
  'scripts/gate-stamp.ts',
  'scripts/lib/gate-',
  'scripts/engine-creep-allowlist.json',
  'scripts/engine-encapsulation-allowlist.json',
  'scripts/purity-clock-allowlist.json',
  'scripts/ui-palette-baseline.json',
  'scripts/second-look',
  'scripts/lib/second-look',
  'scripts/rail-audit.md',
  'scripts/lib/agy.mjs',
  'scripts/deploy-scope',
  'scripts/lib/deploy-scope',
  'package.json',
  'knip.json',
  'tsconfig.json',
  'e2e/tsconfig.json',
  'vite.config.ts',
  'playwright.config.ts',
];

export const railFiles = (files) => files.filter((f) => RAILS.some((r) => f.startsWith(r)));

// The second look's findings start "[blocker]" or "[note]" (scripts/second-look.md), at most one per line.
export const blockers = (answer) => (answer.match(/^\s*(?:[-*+]|\d+[.)])?\s*\**\s*\[blocker\]/gim) ?? []).length;

// The rail audit answers with a line "LOOSENS: yes" or "LOOSENS: no" (scripts/rail-audit.md), the first one counting; null
// when it gives neither.
export function loosens(answer) {
  const m = /^\W*LOOSENS\W*(yes|no)\b/im.exec(answer);
  return m ? m[1].toLowerCase() === 'yes' : null;
}

// The decision, from what ran: `rail` and `look` are each null (not run), { answer } or { error }.
// - owner: the rail audit says the change loosens a rail; it waits for the owner, with the audit's reason.
// - retry: a rail changed but no audit answered; a machine failure, so run it again later, never push unaudited.
// - fix: the second look found a [blocker]; fix it and run it again, as with a reviewer blocker.
// - ship: nothing holds it. A skipped second look on a change that touches no rail never holds the push.
export function verdict({ rails = [], rail = null, look = null }) {
  const held = look?.answer ? blockers(look.answer) : 0;
  const fix = held ? `the second look found ${held} [blocker]${held === 1 ? '' : 's'}` : null;
  if (rails.length) {
    const said = rail?.answer ? loosens(rail.answer) : null;
    if (said === true) {
      return { verdict: 'owner', why: ['the rail audit says it loosens a rail; it waits for the owner', fix].filter(Boolean).join('; also ') };
    }
    if (said === null) {
      const why = rail?.error ?? (rail?.answer ? 'the rail audit gave no "LOOSENS: yes|no" line' : 'the rail audit did not run');
      return { verdict: 'retry', why: `${why}; a change to ${rails.join(', ')} is never pushed unaudited` };
    }
  }
  if (fix) return { verdict: 'fix', why: fix };
  const notes = [rails.length ? 'the rail audit says it loosens nothing' : null, look?.error ? `second look skipped: ${look.error}` : null];
  return { verdict: 'ship', why: notes.filter(Boolean).join('; ') || 'no blocker' };
}
