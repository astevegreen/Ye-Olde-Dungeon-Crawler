# Handoff: test suite audit, complete
2026-10-17 15:56 UTC · branch main · HEAD 7b671042 · tree clean · folder C:/Antigravity/YODC

## Goal
The owner's test-suite audit ("Audit the test suite and how it works…", "Do all 1-6 in sequence", then "approve your recommendations" and "Do it here now" for the follow-ups) is finished. Nothing is left in this task; this note records what a later test or CI task would want.

## Done
- 7fd4cc28 the Pages deploy waits for the browser tests: `deploy.yml` calls `playwright.yml` as a job, and only the tip of `main` deploys
- 3cb72143 ARCHITECTURE.md §2: UI and rendering tests import the engine through its index; content tests, `scripts/`, `tests/`, `e2e/` may deep-import
- ca9e3166 the 16 `review-2026-10-06-*` test files renamed by subject (`<area>Regressions.test.ts`, `struckReactions`, `vaultPlacement`, `commandCatalogKeys`)
- 443d97fe retired P-IDs dropped from 21 describe titles
- 0eff164a guarded assertions prove they ran (11 tests); a dead "teaches real spells" check removed, since rites teach no spell
- 6aec42df draw-dependent tests seeded (chaosSimulation, triage, bugReportAutomation, the dice-range test)
- ddbd510a, 7b671042 console noise and test-only exports, made by the linked session "Quiet test output and test-only exports" (local_d01101d0-b6cc-4c88-a761-d0522df540a0), which was pushing them when this note was written
- Uncommitted: none

## Next
Complete

## Decisions
- Deploy after the browser tests, and keep `check:engine-purity` strict for UI tests — owner: "approve your recommendations"
- Skip a coverage report and a soak-bot test — owner: "Do it here now" (approving the recommended set)
- Only the branch tip deploys, checked by a step in the deploy job, instead of cancelling older runs (chosen: it never cancels a deploy midway, and `ci:watch` reports a superseded commit as "success, not deployed")
- A guarded test asserts that the list it loops over is non-empty, as `monsterDefinitionRoundTrip.test.ts` does (chosen: the smallest change that makes an empty list fail)

## Read first
- `.github/workflows/deploy.yml` — the build, browsers and deploy jobs, and the tip check
- `scripts/watch-ci.ts` — follows the one deploy run and says whether it deployed
- `docs/architecture/quality-gates.md` — CI bullet describes the new deploy order

## Verification
- lint, unit (3262 tests), tooling: green on 6aec42df
- pre-push (sim, schema, build, Playwright in three browsers, 90 passed): green on 6aec42df
- CI: deploy.yml succeeded and deployed on 3cb72143 (browser job ended 15:16:53, deploy began 15:16:56) and on 6aec42df
- ddbd510a, 7b671042: the linked session reported lint and 3264 unit tests green; push and CI not verified here (local `main` was 2 ahead of origin)
Resumed: 2026-10-21 18:48 UTC
