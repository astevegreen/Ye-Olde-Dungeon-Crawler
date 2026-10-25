# Handoff: sprint pre-push hook, only the integrator pushes to main
2026-10-25 10:03 UTC · branch main · HEAD 0f00ff5b · tree 1 uncommitted file · folder C:/Antigravity/YODC

## Goal
The coordinator's structural fix for hidden pushes, part of the owner's "Let's prepare for another sprint. Ensure everything is prepped and ready, incorporating lessons learned and best practices for this next iteration." A command guard can't see a push made from `node -e` or a script. Done: built, gated and pushed as option (a).

## Done
- 0f00ff5b the guard reads a run inside double quotes as a command with quotes of its own (the coordinator's nested probe: 0 of 12 allowed).
- 46d71c93 while a sprint window is open, pre-push refuses a push to main from any folder but `C:/Antigravity/YODC-integrate`.
- 6d5eeed2 the guard reads words as bash or PowerShell does (the coordinator's 18 hidden-push forms are all refused); 04ce6da6 PowerShell assignments and calls.
- Uncommitted: docs/retros/ — the owner's, never committed.

## Next
Complete

## Decisions
- Option (a) — owner: "Implement A".
- The lock runs before SKIP_HOOKS, which skips only the gates — chosen so a session told to skip hooks still can't land lane work.
- A window file that can't be read refuses — chosen because a sprint may be running; the message says to report it to the owner.
- The coordinator is extracting the guard's reader into one `shell-reader.mjs` for all three repos (branch reader/shared, C:/Antigravity/YODC-reader) — owner, to the coordinator: "Go ahead with the cleanest fix". This session lands it; leave the guard and its test alone until then.

## Dead ends
- Also allowing the main folder: plan sessions work there and every worktree shares one object store, so a script's `git -C C:/Antigravity/YODC push origin sprint/12:main` would land.

## Read first
- scripts/sprint/push-lock.mjs — the rule and the hook's CLI
- .githooks/pre-push — runs it first, with the ref lines on stdin
- scripts/__tests__/pushLock.test.ts — the rule, and the real hook against a bare repo

## Verification
- gate-stamp lint test tooling: green on 46d71c93 (3865 unit, 52 tooling)
- pre-push (sim, build, Playwright ×3): green on 46d71c93, 106 passed, 1 flaky (webkit, the log's history)
- ci:watch: deploy success on 46d71c93 and on 0f00ff5b
- pre-push on 0f00ff5b: green, 105 passed, 2 flaky (firefox gameplay:44, webkit gameplay:786)
