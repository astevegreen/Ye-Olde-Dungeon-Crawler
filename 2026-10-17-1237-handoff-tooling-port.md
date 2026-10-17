# Handoff: handoff tooling ported from Terminal Dusk
2026-10-17 12:37 UTC · branch main · HEAD f36f4b7c · tree clean · folder C:/Antigravity/YODC

## Goal
Owner: "Check what it changed and see if the changes objectively improve the handoff skill", then "Do it": port the six improvements, keeping our handoffs branch, UTC and guards.

## Done
- f36f4b7c chore(handoff): notes.mjs checks, stamps and names each note, and reports drift on claim
- Uncommitted: none

## Next
Complete. The first real `claim` is the open P-36 note (2026-10-17-1127-p36-measurement-soak.md): its line 2 predates the folder field, so **Since the note** reports no folder check for it. That is expected.

## Decisions
- Notes stay on origin's `handoffs` branch, in UTC — chosen because cloud sessions read them; Terminal Dusk's local `.handoff/` and local time were not ported.
- `record <file>` republishes a claimed note with the owner's answers — chosen because `publish` now refuses any note carrying `Resumed:`.
- The SessionStart reminder reads the local copy of origin/handoffs, never fetching — chosen so a session start never waits on the network or a credential prompt.
- notes.sh rewritten in Node — chosen so the nudge hook imports `openNotes` and the tooling gets Vitest tests.

## Read first
- .claude/skills/handoff/notes.mjs:1 — commands, exit codes, line 2 format
- scripts/__tests__/handoffNotes.test.ts:1 — what the tooling guarantees

## Verification
- lint + test (gate-stamp): green on f36f4b7c, 3313 tests
- pre-push (sim, build, Playwright ×3): green, pushed to main
