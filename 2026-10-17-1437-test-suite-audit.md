# Handoff: test suite audit and cleanup
2026-10-17 14:37 UTC · branch main · HEAD 9acca344 · tree clean · folder C:/Antigravity/YODC

## Goal
The owner asked to "Audit the test suite and how it works…", then "Do all 1-6 in sequence". All six are done, pushed and green on CI. What's left is two decisions for the owner and some optional follow-ups the audit found outside items 1–6.

## Decide first
- Should the Pages deploy wait for the browser tests? Today `.github/workflows/deploy.yml` runs on push alongside `playwright.yml`, so a build that fails in Linux browsers still reaches players. — recommend: yes, deploy after `playwright.yml` passes, because players then only get builds that ran in all three browsers; the cost is a deploy a few minutes later.
- ARCHITECTURE.md:21 says test files may deep-import the engine, but `check:engine-purity` rejects deep imports from UI and rendering tests (`scripts/check-engine-purity.ts:287` has no test exemption). §8.2 says to flag this, not pick a side. — recommend: keep the gate and narrow the §2 wording to "engine and content tests and `scripts/`", because UI tests that go through the engine index catch the same barrel gaps UI code would hit, and every UI test passes the gate today.

## Done
- 68458e77 a unit test fails when the engine catches an error during it
- 2afba1ad a browser test fails on any game error (`e2e/fixtures.ts`)
- 18ee31bd Vitest: eight workers at most, mocks restored automatically, `.only` fails
- d36ce93c tooling tests run at commit only when the tooling changed
- bc7d5a92 exhaustive playtest trimmed to `e2e/story-milestones.spec.ts` (Chromium); campaign-flow dropped
- f626816a root `tests/*.test.ts` folded into `src/**/__tests__`; duplicates and an unfailable sum dropped
- 9acca344 gate-stamp: staging a deletion keeps the tree key
- Uncommitted: none

## Next
1. Ask the two Decide first questions. Deploy: add a `workflow_run` trigger on `playwright.yml` (or `needs:`) in `.github/workflows/deploy.yml`, and update `docs/architecture/quality-gates.md`, whose CI bullet says the deploy does not wait. Purity: edit ARCHITECTURE.md:21, or add the test exemption in `scripts/check-engine-purity.ts`.
2. Optional audit leftovers, for the owner to choose: if-guarded tests that pass when the guard is false; unseeded randomness in tests; console noise in test output; a coverage report; a soak-bot test; 9 exports that only tests use; renaming the `review-2026-10-06-*` test files; describe titles that cite retired P-IDs.

## Model
Sonnet 5.5 at medium thinking: a workflow trigger and a one-line doc or gate change, both specified.

## Decisions
- Chromium-only specs skip per spec with `test.skip(({ browserName }) => …)`, not with a project filter, so `npm run gates` and the push run the same list (chosen because it keeps one source of truth in the spec).
- The itemModifiers mechanism tests use modifiers the tests own. Hel-touched (Q23/Q34) and Loki-touched (Q22) keep cotw's numbers, because those are the owner's approved values (chosen).

## Read first
- `docs/architecture/quality-gates.md` — gates, hooks, stamps and CI as they are now
- `.github/workflows/deploy.yml` — the deploy trigger
- `scripts/check-engine-purity.ts:280` — where a test exemption would go

## Verification
- lint, unit (425 files, 3262 tests), tooling (6 files, 45 tests): green on 9acca344
- pre-push: sim, validate:schema, build, and Playwright in three browsers (90 passed, 12 skipped as designed): green on 9acca344
- CI: deploy.yml and playwright.yml succeeded on 9acca344
Resumed: 2026-10-17 15:03 UTC
