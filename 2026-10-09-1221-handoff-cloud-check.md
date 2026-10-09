# Handoff: check handoffs reach the cloud
2026-10-09 12:21 · branch main · HEAD b9fd525 · tree clean

## Goal
Owner: "an optimal solution to the problem of cloud sessions not seeing handoffs". Built and pushed; done when a cloud session has resumed this very note.

## Done
- dbb9632 notes live on origin's orphan `handoffs` branch, read and written by `.claude/skills/handoff/notes.sh`; a push that updates only that branch skips the pre-push gates
- b9fd525 pre-push gives a failing Playwright test one retry (known webkit flakes failed two pushes in a row)
- 1dfbcda (family-sprite test timeout) pushed with them
- Uncommitted: none

## Next
1. If this session is in the cloud, steps 1–6 of Resume are the test: `notes.sh list` should show this note; HEAD b9fd525 is on main, so step 2 merges nothing; `notes.sh mark` should print `pushed`. Report to the owner whether each worked.
2. Any failure: tell the owner which step failed and its output; the fallback is committing notes on the session branch (`git log bbe4361 -- .claude/skills/handoff/SKILL.md` has that version).
3. Then `Complete`: ask the owner for the next task.

## Decisions
- One orphan branch, not notes on each session branch — chosen because cloud sessions may push any branch (code.claude.com cloud-environments, "GitHub proxy"), so local and cloud share one place and notes never merge into main.
- Hook edits — owner: "Both edits (Recommended)".

## Dead ends
- Notes in a tracked `handoffs/` folder on the working branch (bbe4361) — local notes on main never pushed; every note paid the full commit and push gates.

## Read first
- .claude/skills/handoff/notes.sh — what each subcommand does
- .githooks/pre-push:22-31 — the handoffs-only skip

## Verification
- lint + test (2625/2625): green on dbb9632 and b9fd525; pre-push sim, schema, build, Playwright 88/88: green on b9fd525
Resumed: 2026-10-09 16:25
