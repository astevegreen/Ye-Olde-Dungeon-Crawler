# Handoff: overnight sprint after the greenbeanbot appeal
2026-11-28 13:00 UTC · branch main · HEAD 3746d34a · tree clean · folder C:/Antigravity/YODC

## Goal
The owner asked "how to orchestrate work so that all the follow-ups and any newly generated follow-ups can resolved
overnight" and chose "Follow-ups + reserve (Recommended)". Done when a 12 h sprint window has run on the Backlog and
the morning leftovers (`blocked`, `held`, `after-sprint` issues) are reported.

## Decide first
- 12 files in the main checkout changed uncommitted at 07:52–07:57 local on 28 Nov, by no listed session (Antigravity
  or a `claude rc` run?): `.claude/settings.json` (adds ask/deny rules, drops plugin toggles), reviewer agent, handoff
  skill, ci.yml, playwright.yml, `scripts/lib/agy.mjs`, `gemini-api.mjs` and their tests. The dry run needs a clean
  `main`. Recommend: the owner names who made them; that session commits them (rail audit: they touch rails), else
  `git stash` them with the owner's OK.

## Done
- 664f2fc1 sprint setup: log #121, questions #122, Backlog N1–N5, X3/X5/X8/X9/X10, K5–K8.
- 20fec107, 50bb7b95, 06092fb0, 8cddb58c: the four rail follow-ups; CI green; main checkout at 8cddb58c.
- Uncommitted: the 12 unowned files above (not this task's).

## Next
1. Check `gh auth status`: greenbeanbot must log in without the 403 "suspended" error. Until then stop; never
   `gh auth switch` and never loosen `queue.mjs identity`.
2. Clean `main` (Decide first), then `/sprint-start 12 --dry-run`, which must end `DRY-RUN OK yodc`.
3. Owner: Preflight in `docs/sprint.md:313` (pause updates, never sleep, Claude Code 2.1.304+), `/sprint-cue`,
   `/sprint-start 12`.
4. Morning: post "What we measure" on #121; list open `blocked`, `held`, `after-sprint` issues.

## Model
Sonnet 5.5 at medium thinking: checks, a dry run and relaying.
## Decisions
- Reuse the sprint machinery, no new orchestrator: lanes file `-follow` issues the queue picks up.
- X10b dropped as intended behaviour (`inventoryController.ts:806-814`); K9–K11 back on `docs/follow-ups.md`.
- greenbeanbot is suspended; wait for the appeal, don't run as astevegreen — owner: "Appeal".

## Read first
- docs/sprint.md:313 — Preflight; docs/sprint.md:163 — the Backlog

## Verification
- gate-stamp green on 664f2fc1; deploy.yml green on 8cddb58c; dry run not run (bot suspended, tree dirty).
