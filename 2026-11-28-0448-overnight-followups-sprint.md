# Handoff: overnight follow-ups sprint
2026-11-28 04:48 UTC · branch main · HEAD 664f2fc1 · tree clean · folder C:/Antigravity/YODC

## Goal
The owner asked "how to orchestrate work so that all the follow-ups and any newly generated follow-ups can resolved
overnight" and chose "Follow-ups + reserve (Recommended)". This is done when a 12 h sprint window has run on the new
Backlog and the morning leftovers (`blocked`, `held`, `after-sprint` issues) are reported.

## Decide first
- gh is active as astevegreen, so `queue.mjs identity` refuses `/sprint-start` (it needs greenbeanbot, which is logged
  in but inactive). Never `gh auth switch`. Recommend: the owner switches it before the cue.

## Done
- 664f2fc1: the log is #121 and questions #122 (#19 and #72 are gone). Backlog: N1–N5, X3/X5/X8/X9/X10 and K5–K8.
  Story and lore lanes removed; permission 8 added; the `after-sprint` label is never queued (sprint-lane step 2.2).
- Uncommitted: none.
- Session `local_67ba05fb…` (branch `claude/strange-gauss-8997f8`): four rail commits audited `LOOSENS: no`
  (SHA pins, pre-push skips side-branch deletions, `.agents/` shrink, Dependabot check). It was pushing them, and
  none were on `origin/main` at handoff.

## Next
1. `git fetch && git log --oneline 664f2fc1..origin/main`: check the four rail commits landed, or ask that session.
   They must land before the window: the push lock admits only the integrator.
2. Once gh is greenbeanbot: `/sprint-start 12 --dry-run`, which must end `DRY-RUN OK yodc`.
3. Owner: the Preflight in `docs/sprint.md` (pause updates, never sleep, Claude Code 2.1.304 or later), then
   `/sprint-cue` and `/sprint-start 12`.
4. Morning: post "What we measure" on #121, and list the open `blocked`, `held` and `after-sprint` issues.

## Model
Sonnet 5.5 at medium thinking: checks, a dry run and relaying.
## Decisions
- Reuse the sprint machinery, with no new orchestrator: lanes already file `-follow` issues the queue picks up.
- X10b is dropped as intended behaviour (`inventoryController.ts:806-814`); K9–K11 are back on `docs/follow-ups.md`.

## Read first
- docs/sprint.md:15-40 — permissions and trailers; docs/sprint.md:163 — the Backlog

## Verification
- gate-stamp: green on 664f2fc1. second-look `--rails-only`: ship. ci:watch: success, not deployed.
- Dry run not run (gh is on astevegreen). agy said Opus is "out of usage until Tue 1 Dec"; maybe agy's quota only.
