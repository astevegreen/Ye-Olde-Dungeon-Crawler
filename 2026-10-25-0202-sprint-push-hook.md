# Handoff: sprint pre-push hook, only the integrator pushes to main
2026-10-25 02:02 UTC · branch main · HEAD 6d5eeed2 · tree 1 uncommitted file · folder C:/Antigravity/YODC

## Goal
The coordinator's structural fix for hidden pushes, part of the owner's "Let's prepare for another sprint. Ensure everything is prepped and ready, incorporating lessons learned and best practices for this next iteration." A command guard can't see a push made from `node -e` or a script, and main accepts direct pushes. Done when the owner has picked an option and it is built, gated and pushed, or declined.

## Decide first
- While a sprint window is open, should a git pre-push hook refuse pushes to main from anywhere but `C:/Antigravity/YODC-integrate`? (a) Yes: it catches pushes from scripts too, but the owner's and interactive sessions' pushes to main wait for the window to end or `/sprint-stop`. (b) Refuse only from lane and research folders: the owner's pushes are unchanged, but a hidden push from the main folder still lands. (c) No hook. — recommend: (a), because it is the only option that stops a push the guard can't see; it is not airtight, since a session could push from the integrator's folder.

## Done
- 6d5eeed2 the guard reads words as bash or PowerShell does (the coordinator's 18 hidden-push forms are all refused); 04ce6da6 PowerShell assignments and calls.
- The same question is the only Decide-first item in note 2026-10-24-2330-sprint-act2-prep.md, claimed by the phone session "YODC" (session_01G4VS7b…). Whichever session the owner answers in builds it, after messaging the other.
- Uncommitted: docs/retros/ — the owner's, never committed.

## Next
1. Message the "YODC" phone session (ListAgents) that this session is building, so only one does.
2. In `.githooks/pre-push`, read each stdin line `<local ref> <local sha> <remote ref> <remote sha>`. For remote ref `refs/heads/main`, while `<git-common-dir>/sprint-window.json` puts now between its start and end (`scripts/sprint/queue-rules.mjs:117`, `:159`), refuse unless `git rev-parse --show-toplevel` is YODC-integrate (a), or refuse when it is a YODC-lane-* or YODC-research* folder (b).
3. Test it in `scripts/__tests__/` with a temporary repo and window file. Read `docs/architecture/quality-gates.md` before the hook edit. Gate, then commit with `Requested:` quoting the owner's answer, and push.
4. Tell the coordinator and the phone session; add a line to `C:\Antigravity\sprints\yodc.md` under "Offered".

## Model
Sonnet 5.5 at medium thinking — a specified hook change with tests.

## Dead ends
- Also allowing the main folder: plan sessions work there and every worktree shares one object store, so a script's `git -C C:/Antigravity/YODC push origin sprint/12:main` would land.

## Read first
- .githooks/pre-push — where the check goes
- scripts/sprint/queue-rules.mjs:117 — the window file and its phases
- .claude/skills/sprint-integrate/SKILL.md:65 — the integrator's push

## Verification
- gate-stamp lint test tooling: green on 6d5eeed2
- pre-push (sim, build, Playwright ×3): green on 6d5eeed2, 107 passed, 0 flaky
- ci:watch: deploy success on 6d5eeed2
- the hook: not built
