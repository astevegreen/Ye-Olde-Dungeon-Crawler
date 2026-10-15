# Handoff: token-audit follow-ups
2026-10-15 22:14 UTC · branch main · HEAD 2e66f643 · tree 1 staged entry (ARCHITECTURE.md, empty diff, not this session's)

## Goal
Owner: "Analyze chats, skills, hooks, sessions, and workflows from the past 7-9 days to identify if the performance audit/token usage reduction measures have been effective ... determine if there are obvious optimizations". Measuring is done; what's left is applying whichever optimizations the owner picks.

## Decide first
- Explore agents run on Opus (59 runs, ~16% of all tokens 8–15 Oct). Pin them to Sonnet with `.claude/agents/Explore.md` (`model: sonnet`)? Recommend: yes. Their job is finding code, and Sonnet does that well.
- Should general-purpose subagents default to Sonnet unless a call asks for Opus (`CLAUDE_CODE_SUBAGENT_MODEL=sonnet` in `.claude/settings.json` env, no FORCE)? Recommend: yes. Art and design agents still pass `model: opus` when they need it.
- Raise the handoff nudge from 150k to ~200k (`.claude/hooks/handoff-nudge.mjs` LIMIT)? Recommend: yes. Each resume costs ~450k input-equivalent tokens (start-up plus 19 calls to orient). Finishing the same task past 150k is cheaper until about 80 more calls.

## Done
- Plan's "Measuring the result" ticked with Result lines (`.prompts/00-WORKFLOW-OVERHAUL-PLAN.md`); scripts and outputs in `.prompts/workflow-metrics/` (`mine.mjs`, `agg.mjs`, `after-*-2026-10-15.txt`). Memory `workflow-overhaul-plan` updated.
- Uncommitted: none from this session (.prompts is gitignored).

## Next
1. Apply the answers. Settings and hook edits need the owner's OK (memory `settings-edit-needs-owner`). After setting the env var, check in a subagent transcript's `message.model` that it took effect, because the docs don't confirm `env` reaches subagents.
2. Add `resume` to `.claude/skills/handoff/notes.sh`: list (auto-pick when only one note), claim, `git fetch`, merge-base check, drift log, and status in one call, then point the skill's Resume steps 1–3 at it. Resumes average 4.1 calls on notes.sh and git now.
3. Optional: split the magic sections out of `docs/architecture/content-extensibility.md` (35k chars, touched by 15 commits since 9 Oct) into their own sub-doc.

## Model
Sonnet 5.5 at medium: settings, a hook constant and a shell script, all with a clear spec.

## Read first
- `.prompts/workflow-metrics/after-agg-2026-10-15.txt` — period comparison
- `.claude/skills/handoff/notes.sh` — for step 2
