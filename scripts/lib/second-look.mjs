// What scripts/second-look.mjs decides from agy's answers: which files are rails, and whether the change may be
// pushed. The owner's gates since 28 Oct (CLAUDE.md, "What waits on the owner"): a [blocker] from the second look
// holds the push like a reviewer blocker, notes never do; a change touching a rail gets a deep rail audit, and
// only its "yes, this loosens" holds the change for the owner. A review that did not run never ships: it is run
// again. Types: second-look.d.mts.
import { ARGON, OPUS, modelName } from './agy.mjs';

// The rails: what a change could loosen to hide its own failure. Hooks and guards, the sprint skills and agents
// that wire them, git hooks, CI, the gates with their allowlists and configs and the scripts package.json runs
// for them, the review itself with the rules agy reviews against (`.agents/rules/`, this repo's GEMINI.md), and
// the sprint's queue and push lock. Path prefixes from the repository root.
export const RAILS = [
  '.claude/settings',
  '.claude/hooks/',
  '.claude/skills/sprint-',
  '.claude/agents/implementer.md',
  '.claude/agents/reviewer.md',
  '.agents/rules/',
  '.githooks/',
  '.github/',
  'scripts/sprint/',
  'scripts/check-',
  'scripts/gate-stamp.ts',
  'scripts/lib/gate-',
  'scripts/headless-sim.ts',
  'scripts/validate-schema.ts',
  'scripts/watch-ci.ts',
  'scripts/lib/deploy-outcome',
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

// The models a rail audit may come from, deepest first. A loosened rail hides its own failure, so only Argon or Opus
// may say "no"; when neither answers, the audit is run again later, never answered by Flash or Sonnet. This is
// YODC's own order: agy.mjs's ORDER is shared word for word with the other repos and stays as it is.
export const RAIL_MODELS = [ARGON, OPUS];

// The second look's findings start "[blocker]" or "[note]" (scripts/second-look.md), at most one per line. Only
// markup, numbering or punctuation may come before the tag (`**1. [blocker]**`, ``- `[blocker]` ``, a table cell),
// so a blocker counts however the model formats its list; a tag after words ("not a [blocker]") is no finding.
export const blockers = (answer) => (answer.match(/^[^\p{L}\n]*\[blocker\]/gimu) ?? []).length;

// The rail audit answers with a line "LOOSENS: yes" or "LOOSENS: no" (scripts/rail-audit.md), the first one counting; null
// when it gives neither.
export function loosens(answer) {
  const m = /^\W*LOOSENS\W*(yes|no)\b/im.exec(answer);
  return m ? m[1].toLowerCase() === 'yes' : null;
}

// The decision, from what ran: `rail` and `look` are each null (not run), { answer, model } or { error }. `look`
// is null only for --rails-only, which asks for the rail audit alone.
// - owner: the rail audit says the change loosens a rail; it waits for the owner, with the audit's reason.
// - retry: a review did not run (no model answered, git failed) or a rail audit came from a model other than Argon
//   or Opus; a machine failure, so run it again later, never push unreviewed and never ask the owner.
// - fix: the second look found a [blocker]; fix it and run it again, as with a reviewer blocker.
// - ship: nothing holds it.
export function verdict({ rails = [], rail = null, look = null }) {
  const held = look?.answer ? blockers(look.answer) : 0;
  const fix = held ? `the second look found ${held} [blocker]${held === 1 ? '' : 's'}` : null;
  if (rails.length) {
    const deep = rail?.answer && RAIL_MODELS.includes(rail.model);
    const said = deep ? loosens(rail.answer) : null;
    if (said === true) {
      return { verdict: 'owner', why: ['the rail audit says it loosens a rail; it waits for the owner', fix].filter(Boolean).join('; also ') };
    }
    if (said === null) {
      const why =
        rail?.error ??
        (!rail?.answer
          ? 'the rail audit did not run'
          : !deep
            ? `the rail audit came from ${rail.model ? modelName(rail.model) : 'no named model'}, and only Argon or Opus may give it`
            : 'the rail audit gave no "LOOSENS: yes|no" line');
      return { verdict: 'retry', why: `${why}; a change to ${rails.join(', ')} is never pushed unaudited` };
    }
  }
  if (look?.error) return { verdict: 'retry', why: `the second look did not run: ${look.error}; a change is never pushed on a review that did not run` };
  if (fix) return { verdict: 'fix', why: fix };
  return { verdict: 'ship', why: rails.length ? 'the rail audit says it loosens nothing' : 'no blocker' };
}
