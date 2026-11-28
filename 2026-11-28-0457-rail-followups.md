# Handoff: four rail follow-ups before the overnight sprint
2026-11-28 04:57 UTC · branch claude/strange-gauss-8997f8 · HEAD 8cddb58c · tree clean · folder C:/Antigravity/YODC/.claude/worktrees/strange-gauss-8997f8

## Goal
Resolve the four `docs/follow-ups.md` items sprint lanes cannot edit, on `origin/main` with CI green.
Owner's words (relayed by the orchestrating session): "Follow-ups + reserve (Recommended)".

## Done
- 20fec107 Pin the workflows' actions by commit SHA
- 50bb7b95 Point agy's invariants list at ARCHITECTURE.md's sections
- 06092fb0 Say that SHA-pinned actions get no Dependabot alert
- 8cddb58c Skip the pre-push gates for a push that only deletes side branches
- Uncommitted: none

## Next
Complete

## Decisions
- Action comments carry the full release (`# v7.0.1`) — chosen because Dependabot rewrites a comment only while it names a tag still on the old commit.
- Deleting `main` still runs the gates — chosen on the orchestrating session's suggestion. The wider version audited `LOOSENS: yes`, the narrowed one `no`, so it was pushed without the owner's yes; the owner was told, and `git revert 8cddb58c` undoes it.
- Pinned actions raise no Dependabot alert (alerts are on for the repo): their fixes come with the weekly updates, after 7 days.

## Read first
- .githooks/pre-push:31 — which pushes skip the gates
- .github/dependabot.yml:1 — cooldown and alert facts

## Verification
- lint, unit, tooling: green on 8cddb58c; pre-push on both pushes: 107 passed, 16 skipped, three browsers
- CI deploy.yml: 06092fb0 success, deployed; 8cddb58c success, ships nothing
- The new hook skip runs only once `C:\Antigravity\YODC` (core.hooksPath) is pulled; its `main` was at 664f2fc1
- Not seen yet: a Dependabot update PR against the SHA pins
