# Handoff: test audit leftovers
2026-10-17 15:18 UTC · branch main · HEAD 3cb72143 · tree clean · folder C:/Antigravity/YODC

## Goal
The owner's test-suite audit ("Audit the test suite and how it works…", then "Do all 1-6 in sequence") is finished, along with its two follow-up decisions. The audit also found optional cleanups outside items 1–6. Done means the owner has picked which ones to do and those are committed and pushed.

## Decide first
- Which of the audit's optional cleanups should be done? The candidates: tests wrapped in an `if` that pass without checking anything when the condition is false; tests that use unseeded randomness; console noise in test output; a coverage report; a test for the soak bot; 9 exports that only tests use; renaming the `review-2026-10-06-*` test files; describe titles that cite retired P-IDs. — recommend: the `if`-guarded tests and the unseeded randomness first, because those tests can pass without checking anything or fail by chance; then the two renames, which are cheap; skip the coverage report and the soak-bot test unless the owner wants them, since neither catches a bug the gates miss today.

## Done
- 7fd4cc28 ci: the Pages deploy waits for the browser tests (deploy.yml calls playwright.yml as a job; only the branch tip deploys)
- 3cb72143 docs: UI and rendering tests import the engine through its index too (ARCHITECTURE.md §2)
- Earlier audit commits: 68458e77, 2afba1ad, 18ee31bd, d36ce93c, bc7d5a92, f626816a, 9acca344
- Uncommitted: none

## Next
1. Ask the Decide first question, then have `scout` locate each chosen cleanup (for example `if (` around `expect` in `src/**/__tests__`, or `Math.random` in test files) before editing.
2. One commit per chosen cleanup, each with its own `Requested:` trailer.

## Decisions
- The Pages deploy waits for the browser tests: `.github/workflows/deploy.yml` calls `playwright.yml` as a job and deploys after both it and the build pass. playwright.yml no longer runs on its own for a push — owner: "approve your recommendations"
- Only the tip of `main` deploys, so an older push whose browser run finishes last can't replace a newer one (chosen because browser runs finish out of order).
- `check:engine-purity` stays strict for UI and rendering tests, and ARCHITECTURE.md §2 now says so — owner: "approve your recommendations"
- Chromium-only specs skip per spec with `test.skip(({ browserName }) => …)`, not with a project filter (chosen: one source of truth in the spec).

## Read first
- `docs/architecture/quality-gates.md` — gates, hooks, stamps and CI as they are now
- `scripts/watch-ci.ts` — now follows the one deploy run and says whether it deployed

## Verification
- lint, unit (425 files, 3262 tests), tooling (6 files, 45 tests): green on 3cb72143
- pre-push: sim, schema, build, Playwright in three browsers (90 passed, 12 skipped as designed): green on 3cb72143
- CI: deploy.yml run 39043847101 on 3cb72143 succeeded and deployed; the deploy job started at 15:16:56, after the browser tests ended at 15:16:53
Resumed: 2026-10-17 15:20 UTC
