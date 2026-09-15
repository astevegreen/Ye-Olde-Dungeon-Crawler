# Foundation Housekeeping & Meta-Analysis Report

- **Started:** 2026-09-15.
- **Stage 0/1 author:** Claude Code (Opus 5).
- **Local HEAD at start:** `7c9b9cf` on `main`.
- **Local main is 3 commits behind `origin/main` (`61c4cd2`).** See backlog item 1.
- **How evidence was gathered:** `git`, ripgrep, direct file reads, the prior Claude Code session transcript (`2fc1fac6…`), a search of Antigravity's `brain/` logs, and real gate and mutation runs.
- **Where the runs happened:** in a disposable `git worktree` at `origin/main`, torn down afterwards. `git worktree list` confirms it is gone, and the main tree was never modified.
- **Grep pitfall:** ripgrep brace-globs such as `{ui,rendering}/**` silently matched nothing twice during this audit. Every "no matches" claim below comes from a re-run with plain paths.

---

## STAGE 0 — Ground truth

### 0.1 Test-suite overhaul status

**Source of the plan:** the D1–D6 decisions come from the 2026-09-14 Claude Code session. The plan was posted at 22:52Z and the user's decisions at 23:08Z. The work landed in commit `ccde814 "Test Suite Overhaul"` (Steve, 2026-09-14 20:13 -0400).

| Item | Decision | Status | Evidence (local HEAD) |
|---|---|---|---|
| D1 #1 | Click-to-pickup goes through the command bus | **DONE** | `src/rendering/canvas-renderer.ts:279` `commandBus.dispatch({ type: 'pickup_item', … })` |
| D1 #2 | No direct `quickSpells` writes | **DONE** | `src/ui/spellbookModal.ts:165` `player.setQuickSpell(…)`; method at `src/engine/entities/player.ts:266` |
| D1 #3 | No direct `tutorialFlags` writes | **DONE** | `src/ui/townReturnModal.ts:228,234,240` `markTutorialSeen(…)`; method at `player.ts:270` |
| D1 #4 | `setPaused` on the engine | **DONE** | `src/engine/engine.ts:1049`; caller `src/rendering/input-handler.ts:108` |
| D1 extras (found by the checker) | sort, roar flag | **DONE** | `sort_pack` command at `commandBus.ts:135` (callers `main.ts:912`, `inventory-overlay.ts:457,668`); warchief roar world flag at `content/warcraft/ai.ts:42` |
| D2 | `createFromDefinition` throws; all call sites audited | **DONE** | `src/engine/entities/monster.ts:225-227` throws. Call sites: `spellPipeline.ts:589` (try/catch, now live), `dungeon-generator.ts:473` (`spawnDefinedMonster` helper), fixtures guarded |
| D3 | Pipeline rejects a hook result or `perform()` return without a valid `ActionResult` | **DONE** | `src/engine/actions/actionPipeline.ts:113-115, 127-129, 140-142`, plus `isActionResult` at :156 |
| D4 | Monster-turn exceptions isolated now | **DONE** | `engine.ts:999-1032` (`processMonsterAction` boundary, energy spent on failure); `engine.ts:1035` (surfaced as `pipelineError`) |
| D5 | Unknown tiles load as wall with a warning | **DONE** | `src/engine/storage/serializer.ts:616-630` (was :619-633 before item 1 pulled PR #2); test `storage/__tests__/loadFailurePaths.test.ts:88` |
| D6 | Wall-clock assertions moved from `npm test` to `npm run sim` | **DONE** | `chaosSimulation.test.ts:316` and `spellVisualEffects.test.ts:245` now carry only a pointer comment; budgets live at `scripts/headless-sim.ts:33,35,252-257` |

**Also from that plan (P4/P6), confirmed present:**
- migrator missing-step, throwing-step and no-version tests, plus corrupt `loadCharacter` tests (`loadFailurePaths.test.ts:15-74`)
- `flightRecorderReportFailure.test.ts`
- `turnFailureIsolation.test.ts`
- `pipelineFailureContract.test.ts`
- `registryContracts.test.ts`
- `scripts/headless-sim-all.ts` deleted
- **Follow-up commit `b12b134` (PR #2, on origin only):** closed the remaining silent fallbacks the plan listed as "not done": AI routine default, generator default, effect dispatch, and dead `SAVE_VERSION`.

#### The three required deliverables — revert-and-confirm

- **History:** the 2026-09-14 session reported a 29-mutation harness: 28 caught, 1 informational miss (M09).
- **The harness was never committed.** It lived in that session's scratchpad, so the proof could not be reproduced from the repo.
- **Re-proved today:** I ran the proofs again against `origin/main` `61c4cd2`. The files involved are byte-identical to local `7c9b9cf`, since PR #2 touched none of them.
- **Restore check:** every mutation was restored with `git checkout`, and `git status` was clean afterwards.

| Deliverable | Exists | Runs in `npm test` / `lint` | Mutation | Result |
|---|---|---|---|---|
| **(a)** `executeWithHooks` failure isolation | `actions/__tests__/pipelineFailureContract.test.ts` (6 tests) plus `actionPipelineHooks.test.ts` "Failure Isolation Contract (Gap 2)" (3 tests) | yes | **A1:** `handlePipelineError` rethrows (isolation removed) | **Caught:** 9 failed, 11 passed (20) |
| (a, D3) | same | yes | **A2:** remove the pre-hook short-circuit validity check | **Caught:** 1 failed, 5 passed; only the phase-specific test catches it |
| **(b)** mutation-boundary check | `scripts/check-engine-encapsulation.ts` (TS type checker) plus `scripts/engine-encapsulation-allowlist.json` (9 entries), wired into `npm run lint` | yes | **B:** revert D1 #1 (Container/GameMap mutators), D1 #2 (indexed write), D1 #4 (`isPaused` write), and add the original diagnostic-modal-style `player.isInvulnerable = true` | **Caught:** all 5 reported, `CHECK_EXIT=1`; passes again after restore |
| **(c)** MonsterRegistry-style lookup fails loudly | `src/engine/__tests__/registryContracts.test.ts` (9 tests) | yes | **C:** restore the "Unknown Creature" silent fallback in `createFromDefinition` | **Caught:** 3 failed, 6 passed |

**Wording note on (c):** `MonsterRegistry.get()` itself returns `undefined`, not a throw, and the test asserts exactly that. The throw lives one level up, in `Monster.createFromDefinition`. Both behaviors match the "return null or throw" requirement.

Mutation output (verbatim, abridged to the failing lines):

```
A1  × …pipelineFailureContract > isolates a pre-hook that short-circuits without an ActionResult…
    × …> isolates a post-hook that replaces the result with a non-ActionResult
    × …> isolates an action whose perform() returns no ActionResult
    × …> catches an exception outside the per-phase boundaries at the top-level boundary
    × …> isolates and records non-Error thrown values
    × …> does not advance the world after an isolated player-action failure
    × …Failure Isolation Contract (Gap 2) > isolates content-style pre-hook exception…
    × …Failure Isolation Contract (Gap 2) > isolates action.perform() engine exception…
    × …Failure Isolation Contract (Gap 2) > isolates post-hook exception…
    Test Files  2 failed (2)   Tests  9 failed | 11 passed (20)

A2  × …> isolates a pre-hook that short-circuits without an ActionResult instead of returning undefined
    Test Files  1 failed (1)   Tests  1 failed | 5 passed (6)

B   ❌ Found 5 direct mutation(s) of engine internals outside src/engine/:
      [SUBSYSTEM_MUTATION] src/rendering/canvas-renderer.ts:279  (Container.addItem)
      [SUBSYSTEM_MUTATION] src/rendering/canvas-renderer.ts:280  (GameMap.removeItemAt)
      [PROPERTY_WRITE] src/rendering/input-handler.ts:108  (GameEngine.isPaused)
      [PROPERTY_WRITE] src/rendering/input-handler.ts:108  (Entity.isInvulnerable)
      [INDEXED_WRITE] src/ui/spellbookModal.ts:165  (Player.quickSpells)
    CHECK_EXIT=1
    (after restore) ✓ Engine Encapsulation: 0 unsanctioned mutations of engine internals outside src/engine/.

C   × Definition lookups fail loudly… > Monster.createFromDefinition throws on an unknown ID…
    × createFromDefinition call sites… > summon effect: an unknown creature ID spawns nothing and logs the failure
    × createFromDefinition call sites… > DungeonGenerator: unregistered hard-coded spawn IDs are skipped…
    Test Files  1 failed (1)   Tests  3 failed | 6 passed (9)

Baseline after all restores: Test Files 3 passed (3)  Tests 29 passed (29);  git status: []
```

#### Baseline gates at `origin/main` `61c4cd2` (all green)

```
npm run lint            EXIT 0  (tsc; purity: 388 files, 0 violations; encapsulation: 55 presentation + 32 content files, 9 allowlisted, 0 unsanctioned)
npm test                EXIT 0  Test Files 165 passed (165) · Tests 971 passed (971)
npm run sim             EXIT 0  realistic=7, realistic-high=21, stress=105; awake(21) median 0.101 ms/turn; Pipeline Caught Errors: 0
npm run validate:schema EXIT 0  ✅ Schema migration validation passed: v1 -> v9 verified.
npm run build           EXIT 0  dist/index.html 833.23 kB · dist/cotw.html 833.23 kB
```

**Anomaly:** `sim` again shows `dormant 0 → 1.004 ms/turn` versus `dormant 7 → 0.089 ms/turn`. This is the cleared-floor respawn rescan that the 2026-09-14 session flagged as a separate task; see item 10.

### 0.2 Build/revert cruft

**Scheduler partition residue: none.**
- `activeEntities|dormantEntities|reclassify|SCHEDULER_BUCKET_SIZE`: zero hits in `src/`, `scripts/`, `tests/`, `e2e/` and the root files. ARCHITECTURE.md §6's historical note doesn't use those identifiers either.
- `src/engine/scheduler.ts` has no dormant/partition/active logic.
- `src/engine/core/turnScheduler.ts` is a one-line alias re-export, `export { EnergyScheduler, TurnScheduler } from '../scheduler'`, dating from `fc7df79` (2026-09-11). That predates the partition experiment, so it is not revert residue. Its only consumer is `scheduler-guard.test.ts:3`.

**Throwaway/diagnostic artifacts:**

| Artifact | Finding | Recommendation |
|---|---|---|
| `run-bench.cjs` | **Broken.** Crashes with `TypeError: Cannot read properties of null (reading '1')` at line 8, because it parses a `Latency:` line that `headless-sim.ts` no longer prints. knip: unused file. | **Delete** |
| `run-bench-internal.ts` | Runs (`Dormant: 0/30/150/500 → 1.095/0.134/0.326/2.349 ms/turn`), but it benchmarks today's single-list scheduler. The partition code is reverted, so it cannot reproduce the comparison it is cited for. `npm run sim` supersedes it (ARCHITECTURE.md §6 says so). | **Delete**, and update the §6 sentence that says the harness "remains at the repo root" to cite commit `3d71469` instead |
| `scripts/scaffold-content.js` | Unreferenced (knip; no script, skill or doc mentions it). Emits an obsolete `MonsterDefinition` shape (`experienceReward`, `dropTableId`) instead of `xpValue`/`lootTable`/`speed`/`aiType`. | **Delete** |
| `src/rendering/atlas/index.ts` | Unused barrel (knip); every consumer imports `./atlas/sprite-atlas` directly | **Delete** |
| `e2e/example.spec.ts` | Stock Playwright scaffold: it navigates to `https://playwright.dev/` and tests nothing in this project. `.github/workflows/playwright.yml` runs it on every push **and pull request** across chromium, firefox and webkit. | **Decision needed:** promote to a real smoke test of `dist/index.html`, or delete the spec, config and workflow |
| `tests/auditRemediations.test.ts` | A real regression suite (8 tests, passing) from an earlier adversarial audit | **Keep** |
| Prior mutation harness | Never in the repo (scratchpad only) | Nothing to delete. Optionally promote later; not proposed here. |
| `.claude/worktrees/competent-moore-98198d` | Detached at `af4811a`, clean. Its branch was merged via PR #2. | **Remove** the worktree and the local branch |
| `.claude/worktrees/elegant-wu-84731d` | Branch `claude/elegant-wu-84731d` at `0339f1a`, 3 commits behind main, with **uncommitted work**: `spawner.ts`, `floorManager.ts`, and a new `clearedFloorRespawn.test.ts`, last modified 2026-09-14 23:31. This is an unlanded fix for the respawn rescan. | **Decision needed** (item 10). Do not delete without instruction. |
| `refs/remotes/local-main/main` | A remote-tracking ref for a remote that no longer exists (`git remote -v` lists only `origin`) | **Delete the ref** |
| `vite.config.ts` test exclude `'playwright/**'` | That directory was removed in `9b49aa9` | **Remove the entry** |

**Other debugging residue:**
- `console.log`/`debug` in non-test source: only the boot banner at `src/main.ts:1406` (`'Castle of the Winds initialized with Main Menu & Settings.'`).
- `TODO`/`FIXME`/`HACK`: none in non-test `src/`. The `XXX` hits are vault map glyphs.
- Commented-out code: none found. This was a heuristic regex for commented statements, not a full parse.
- **knip (informational):** 4 unused files (all listed above), 89 unused exports, 75 unused exported types, 6 duplicate exports. Many are deliberate barrel or public-API surface. knip is a devDependency with no config and no npm script.

### 0.3 Cross-document coherence

#### The four previously-proposed patches

- **Where I looked for their text:**
  - the repo
  - both Claude Code transcripts for this project
  - Antigravity `brain/` logs, searched for "diagnostics boundary", "re-propose", "sanctioned dynamic" and "false positive"
- **What I found:** no copy. The only brain hits were Vitest's "false positive tests" warning. They were most likely drafted in a separate chat.
- **How I assessed them:** against the current files, from the task's description.

| Proposed patch | Applied? | Evidence |
|---|---|---|
| adversarial-audit.md: execution-path purity scope | **No** | Line 11 still limits content scanning to files "registered as a manifest hook or handler". `guardian.md:4,6` has the same narrowing. |
| adversarial-audit.md: no false positives on sanctioned dynamic handlers | **No** | No mention of `engine-encapsulation-allowlist.json`, runtime-registered primitives (`HookDispatcher.registerPrimitive`), manifest-registered handlers, or the sanctioned `on*` callback slots |
| adversarial-audit.md: don't re-propose the scheduler partition without new evidence | **No** | No reference to §6 *Scheduler Partitioning (Evaluated, Not Adopted)* or to `Evaluated, Not Adopted` items generally. Its scope note (line 7) covers only `[Planned]`. |
| rules.md: `[UI]` persona diagnostics-boundary line | **No** | `rules.md:36` lists only Canvas, input-handler, chordBuffer and DOM modals. `ui-specialist.md` also says nothing about `engine.diagnostics` or the encapsulation rule. |

**Earlier doc-sync edits (2026-09-13/14 sessions), still applied and not drifted:**
- adversarial-audit.md scope note, `[Planned]` skip and engine-test fixture exemption (lines 7, 13, 24, 27, 42)
- rules.md encapsulation invariant and extended lint gate (lines 21, 25). Line 21 has since drifted in scope; see the table below.

#### Independent sweep — every rule and archetype against current ARCHITECTURE.md

| # | Source | Conflict | ARCHITECTURE.md / code evidence |
|---|---|---|---|
| X1 | ARCHITECTURE.md §5, line 142 | "`CURRENT_SCHEMA_VERSION` … (**8** as of 2026-09-13; do not restate it elsewhere)" | `migrator.ts:4` is `= 9`; §3 line 78 says "schema v9"; `validate:schema` prints "v1 -> v9". The doc contradicts itself and breaks its own no-restating rule. |
| X2 | `.antigravity/rules.md:21` | Forbids "calling mutators on internal subsystems" for **all** code outside `src/engine/`, content included | §7.2 lines 211-212 and `check-engine-encapsulation.ts:21-27` apply that rule to **presentation code only**; content is exempt because hooks act through subsystem methods. No content code currently makes such calls (grep: zero hits), so this is a doc contradiction with no code impact today. |
| X3 | `guardian.md:4,6`; `adversarial-audit.md:11` | Content purity review limited to files "registered as a manifest hook or handler" | §2 line 27 defines purity by execution path; §7.2 line 204 says content is checked "regardless of whether they are registered as hooks, because file location never exempts simulation code" |
| X4 | `adversarial-audit.md:20` | "ensure **new entity state models** are tracked in `migrator.ts` with a new forward-only step" | §5 line 144 requires a step only for a **breaking** save-format change; §3 line 76 (Renown) needed "no `SaveData` field or migration step". An auditor following line 20 would raise false findings. |
| X5 | ARCHITECTURE.md §7.2 line 201; §9 P-18 line 357 | "There is no pull-request CI"; "CI runs only on push to `main`" | `.github/workflows/playwright.yml` triggers on `pull_request` to `main`. It runs only the scaffold e2e spec, no gates, so the doc's intent ("gates run after merge") still holds, but the literal statements are false. The §3 layout table also omits `e2e/` and `playwright.config.ts`. |
| X6 | ARCHITECTURE.md §9 P-24 line 386 | "Sequencing: independent of the other four." | No "four" sibling items remain. P-23 is absent; that is a numbering gap, not an error, since §0 says numbers are stable. |
| X7 | `.antigravity/skills/meta-retrospective-evolver.md` | Malformed file | Line 53 garbled ("Why a an change, ephemeral fact is not procedural systemic this"); the ```` ```text ```` fence opened at line 49 is never closed, and a ```` ```diff ```` fence is nested inside it (lines 57-61); `trigger: post-task-hook` is not a documented trigger |
| X8 | `.claude/commands/audit-architecture.md` | Drift | Its numbered sections are offset by one from ARCHITECTURE.md (its "1" is §2); step 4 says to verify storage "against scheduler.ts"; step 6 omits `validate:schema` and `check:engine-encapsulation`; step 7 asks "whether rules.md references ARCHITECTURE.md at all", which is long settled |
| — | `designer.md`, `scaffold-monster.md`, `validate-schema.md`, `CLAUDE.md` | No contradictions | `scaffold-monster.md:6`'s claim that content gold drops use `Math.random` is still true (`cotw/monsters.ts` 16 sites, `warcraft/monsters.ts` 4) |

### 0.4 Decision-history density (informational only)

ARCHITECTURE.md is **52,788 bytes, 387 lines**. Measured with `scratchpad/density.cjs`, with the scheduler block re-measured by `sed | wc -c`:

| Marker class | Count | Bytes | % of doc |
|---|---|---|---|
| `[Planned: P-NN]` inline tags (all before §9) | 31 tags on 31 lines | 8,747 (whole lines carrying a tag, not just the tag text) | 16.6% |
| §9 Planned Work Register | 23 entries | 9,262 | 17.5% |
| "Evaluated, Not Adopted" | 2 occurrences (§2 line 34 cross-ref; §6 block) | §6 block lines 160-164: 1,286 | 2.4% |
| Other historical-narrative lines outside §9 ("previously", "originally", "reverted", "as of 2026-…", "then cited", "supersedes", "Phase 1's original") | 10 lines including the §6 block | 5,041 | 9.5% |

- **Combined share:** §9 plus the historical-narrative lines is about 14,300 bytes, **≈27%** of the document.
- **Upper bound (≈44%):** add every line carrying a `[Planned]` tag. That overstates the share, because those lines mostly describe current state and carry only a short tag.

---

## STAGE 1 — Prioritized backlog

Within each tier, items are ordered cheapest and safest first.

### CRITICAL — broken, or two sources actively contradict

1. **Fast-forward local `main` to `origin/main`.**
   - Local is 3 commits behind, PR #2 (`b12b134`, `af4811a`, `61c4cd2`: `behaviorTree.ts`, `effectRegistry.ts`, `dungeonArc.ts`, `serializer.ts`, `storage/types.ts`, and tests).
   - Antigravity shares this directory and would otherwise build on pre-PR code.
   - Change: `git pull --ff-only`. Verify with `git log` / `git status`; gates already pass at `61c4cd2` (§0.1).
2. **X1:** remove the stale "(8 as of 2026-09-13…)" from ARCHITECTURE.md §5 line 142, so it simply points at `migrator.ts`.
3. **X2:** narrow `.antigravity/rules.md:21` so the subsystem-mutator ban applies to presentation code (`src/ui/`, `src/rendering/`, `src/main.ts`), matching §7.2 and the checker.
4. **X3:** make `guardian.md:4,6` and `adversarial-audit.md:11` scope content purity by execution path and all content source, per §2 and §7.2. This is proposed patch #1, never applied.
5. **X4:** reword `adversarial-audit.md:20` to "breaking save-format changes" per §5 line 144.
6. **X5:** correct ARCHITECTURE.md §7.2 line 201 and P-18 line 357 to describe the PR-triggered Playwright workflow accurately. Gates still run post-merge only.
   - If item 22 changes or removes that workflow, revisit this wording.

### CORRECTNESS GAP — proposed fix never applied, or unfinished and unverified

7. **Proposed patch #2:** adversarial-audit.md "no false positives on sanctioned dynamic handlers" is not applied. The original wording isn't recoverable, so I'll draft from the §3/§7.2 sources (allowlist file, `registerPrimitive`, manifest-registered handlers, `on*` slots). **You confirm the wording.**
8. **Proposed patch #3:** adversarial-audit.md "don't re-propose §6 *Scheduler Partitioning (Evaluated, Not Adopted)* without new evidence" is not applied. Same wording caveat.
9. **Proposed patch #4:** rules.md `[UI]` persona diagnostics-boundary line is not applied. `ui-specialist.md` also lacks the §2 diagnostics namespacing and the encapsulation rule. Same wording caveat.
10. **Cleared-floor respawn rescan.**
    - **Symptom:** `sim` `dormant(0)` is 1.004 vs 0.089 ms/turn, so a cleared floor re-scans the whole map every turn (`floorManager.ts`).
    - **Unlanded fix:** it sits uncommitted in the `elegant-wu-84731d` worktree on stale base `0339f1a`.
    - **Status:** flagged by the 2026-09-14 session, never approved or landed.
    - **Decision needed:** port it onto current `main` (touches `spawner.ts`, `floorManager.ts`, and a new test; full gates plus a mutation proof), or discard it. The most expensive item in this tier.

### CLEANUP — no functional risk

11. Delete the orphaned ref `refs/remotes/local-main/main`.
12. Remove the merged `competent-moore-98198d` worktree and local branch `claude/competent-moore-98198d`. Deleting the remote branch is outward-facing and would be asked separately.
13. Drop the stale `'playwright/**'` entry from the `vite.config.ts` test exclude.
14. **X6:** remove "Sequencing: independent of the other four." from ARCHITECTURE.md P-24.
15. Delete the unused barrel `src/rendering/atlas/index.ts`.
16. Delete the unreferenced, obsolete `scripts/scaffold-content.js`.
17. Remove the boot `console.log` at `src/main.ts:1406`, or explicitly keep it as an intentional banner.
18. Delete `run-bench.cjs` (broken) and `run-bench-internal.ts` (superseded, cannot reproduce the partition comparison). Update the ARCHITECTURE.md §6 line 164 sentence to cite git history (`3d71469`) instead.
19. **X7:** repair the malformed `.antigravity/skills/meta-retrospective-evolver.md` (garbled line 53, unclosed or nested fences).
20. **X8:** re-sync `.claude/commands/audit-architecture.md` with ARCHITECTURE.md section numbers and the current gate list.
21. Replace the `core/turnScheduler.ts` alias shim: point `scheduler-guard.test.ts` at `../scheduler` and delete the one-line file.
22. **Playwright scaffold decision:** either promote `e2e/example.spec.ts` to a real `file://` smoke test of the built bundle, or delete the spec, `playwright.config.ts`, `.github/workflows/playwright.yml` and the `@playwright/test` dependency.

### INFORMATIONAL — no action now

23. **§0.4 density:** ≈27% of ARCHITECTURE.md is §9 plus historical narrative (≈44% counting every `[Planned]`-tagged line). Input for a later extraction decision; not proposed here.
24. **Revert-and-confirm for deliverables (a)(b)(c):** re-proved today and all caught. The 2026-09-14 harness was never persisted. The pre-existing Gap-2 tests don't assert the failing phase, so they alone miss a removed per-phase catch (prior M06; today's A2 again caught only by the phase-specific test).
25. **knip:** 89 unused exports, 75 unused types, 6 duplicate exports. Largely intentional API surface; knip has no config or script.
26. **Untracked `.agents/`, `.claude/skills/`, `skills-lock.json`:** installed skill packs, not assessed. Commit or ignore at your discretion.
27. **Known planned gaps touched during this audit, unchanged:**
    - P-06: environmental-update isolation
    - P-10: `Math.random` in content gold drops and warcraft AI/hooks
    - P-19: `scripts/` not type-checked, which is how `run-bench.cjs` and `scaffold-content.js` rotted unnoticed
28. **Scheduler partition code residue:** none found (§0.2).

Ready to execute item 1 of 28. Confirm to proceed, skip to a different item, or adjust priorities first.

---

## STAGE 2+ — Execution log

_(Dated entries appended per completed item.)_

### 2026-09-15 — Item 1 (CRITICAL): fast-forward local `main` to `origin/main`

**Change**
- Ran `git fetch origin` first. The remote was still at `61c4cd2`, the commit verified in Stage 0, so nothing new had arrived.
- Ran `git merge --ff-only origin/main`: `7c9b9cf → 61c4cd2`, bringing in PR #2 (`b12b134`, `af4811a`, merge `61c4cd2`).
- 11 files, +448/−13; 4 new test files.
- Untracked files (`.agents/`, `.claude/skills/`, `skills-lock.json`, this report) don't overlap any incoming path and were left untouched.

**Verification**
- **Tree state:** `git diff --stat HEAD origin/main` is empty; `git status -sb` shows `## main...origin/main` (not ahead or behind).
- **Why the full gate run:** the pull changed engine source (`behaviorTree.ts`, `effectRegistry.ts`, `dungeonArc.ts`, `serializer.ts`, `storage/types.ts`). These results come from the real working directory, not the Stage 0 scratch worktree.

```
✓ Headless Simulation Purity: 0 DOM/Canvas globals across 308 engine & content files.
✓ Engine Boundary Isolation: 0 reverse imports in engine source and test files.
✓ Content Boundary Isolation: 0 UI/Rendering imports across 32 content files.
✓ Public API Surface: 0 deep imports into engine internals across 80 UI/Rendering files.
✓ Engine Encapsulation: 0 unsanctioned mutations of engine internals outside src/engine/.
===== EXIT 0 (npm run lint)
 Test Files  165 passed (165)
      Tests  971 passed (971)
===== EXIT 0 (npm test)
Data points: realistic=7 (median @1.0x), realistic-high=23 (max @1.5x), stress=115 (5x, not realistic)
dormant            0           0.981        1.018                0
Pipeline Caught Errors: 0
✓ Headless simulation passed.
===== EXIT 0 (npm run sim)
✅ Schema migration validation passed: v1 -> v9 verified.
===== EXIT 0 (npm run validate:schema)
dist/index.html  832.87 kB │ gzip: 222.62 kB
dist/cotw.html   832.87 kB │ gzip: 222.62 kB
===== EXIT 0 (npm run build)
```

The only stderr during `npm test` came from `autosaveManager.test.ts > handles storage errors gracefully without throwing`, which deliberately injects a storage error.

**Effect on the backlog**
- No re-prioritization needed; no Stage 0 finding referenced the files PR #2 changed.
- One evidence line number shifted: D5's `serializer.ts:619-633` is now `:616-630`, corrected in §0.1.
- The `dormant(0)` anomaly (item 10) still reproduces at the new HEAD: 0.981 ms/turn.
- Branch `claude/competent-moore-98198d` is now also reachable from local `main`, so item 12 stays a safe cleanup.

### 2026-09-15 — Item 2 (CRITICAL): remove stale schema-version restatement (X1)

**Change:** one line in ARCHITECTURE.md §5 (line 142). ARCHITECTURE.md is not a protected file under §8.1.

```diff
-  … `CURRENT_SCHEMA_VERSION` in `migrator.ts` is the authoritative current version (8 as of 2026-09-13; do not restate it elsewhere).
+  … `CURRENT_SCHEMA_VERSION` in `migrator.ts` is the authoritative current version. Do not restate its value in this document or elsewhere; read it from `migrator.ts`.
```

**Deliberately left unchanged:**
- §3 line 78, "(schema v9)"
- §5 line 131, "(schema v8)"

These record which version *introduced* `SaveData.companion` and item `parentId`/`ownerId`. They are historical facts that stay true as the version advances, not claims about the current version.

**Verification**

This was a narrow doc-only check. The change touches no code, test, script or config, so the lint/test/sim/build gates cannot be affected. What needs proving: (a) the diff is only this line, (b) the removed number really was wrong, and (c) no other agent-facing doc still restates the current version.

```
$ git diff --stat -- ARCHITECTURE.md
 ARCHITECTURE.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

$ grep -n "CURRENT_SCHEMA_VERSION =" src/engine/storage/migrator.ts
4:export const CURRENT_SCHEMA_VERSION = 9;

$ npm run validate:schema
✅ Schema migration validation passed: v1 -> v9 verified.
EXIT=0

$ grep -rniE "<current-version restatement patterns>" ARCHITECTURE.md CLAUDE.md .antigravity/rules.md .antigravity/skills/*.md .antigravity/archetypes/*.md .claude/commands/*.md
ARCHITECTURE.md:243:2. **Additive schema migration:** … incrementing `CURRENT_SCHEMA_VERSION` (§5). …
```

- **Sweep result:** the one hit is a false positive (the regex matched "5" in "§5"). No doc among the 11 files swept restates a current schema version.
- **Double-check:** the sweep was run with explicit paths as well as a glob, per the brace-glob caution in Stage 0; both gave the same result.
- **Line endings:** git warned "LF will be replaced by CRLF". The diff is still one line, so there is no line-ending churn.

**Effect on the backlog:** none. No new findings.

---

**Batch mode.** From item 3 onward the user said "Proceed with all remaining items without asking."

- **Order and verification:** items were still executed in order, each with its own verification, and each is logged separately below.
- **Nothing outward-facing:** no commits, no remote branch deletion, no downloads. Playwright browsers 1.63.0 were already installed.
- **Decisions taken without asking:** where an item needed a decision, the recommended option was taken and is flagged **[decision taken]**.
- **Wording to review:** items 7–9 are drafted from ARCHITECTURE.md, because the originally approved wording could not be recovered (§0.3). Review them against what you approved.
- **Batched gates:** the final full gate run (end of this log) covers every code-touching item together.

### 2026-09-15 — Item 3 (CRITICAL): rules.md encapsulation scope (X2)

**Change:** `.antigravity/rules.md:21` now splits the rule by scope, matching the checker:
- **Presentation and content:** no direct field, index, `as any` or `Object.assign` writes.
- **Presentation only:** engine state changes go through `GameEngine`/`Player`/`Entity` methods or `commandBus`, never subsystem or collection mutators.
- **Content:** explicitly exempt from the subsystem-mutator restriction (§7.2).

**Verification:** diff (1 line), plus the checker's own scope table and ARCHITECTURE.md §7.2. The checker run confirms the "enforces all of this" claim still holds.

```
scripts/check-engine-encapsulation.ts:15-27
 *  1. PROPERTY_WRITE … [presentation + content]   2. INDEXED_WRITE … [presentation + content]
 *  3. ANY_CAST_WRITE … [presentation + content]   4. OBJECT_ASSIGN … [presentation + content]
 *  5. SUBSYSTEM_MUTATION … [presentation only]    6. COLLECTION_MUTATION … [presentation only]
ARCHITECTURE.md:211  - In `src/ui/`, `src/rendering/`, `src/main.ts`, and `src/content/` (tests exempt), it fails on assignment…
ARCHITECTURE.md:212  - In presentation code it also fails on mutator-named calls into internal engine subsystems…
$ npm run check:engine-encapsulation
✓ Engine Encapsulation: 0 unsanctioned mutations of engine internals outside src/engine/.   EXIT=0
```

### 2026-09-15 — Item 4 (CRITICAL): purity scope by execution path (X3; proposed patch #1)

**Change:** `guardian.md:4` and `adversarial-audit.md:11` now cover all `src/content/` source "whether or not a file is registered as a manifest hook or handler", plus callbacks injected at runtime (§2, §7.2).

`guardian.md:6` was left unchanged: it already scopes purity to "any `src/content/` code that runs inside the simulation", which matches §2.

**Verification:** diffs; an explicit-path sweep of all 11 agent docs for leftover narrowing; the purity checker's real scope.

```
sweep "registered as (a )?manifest hook" → only the two new lines (guardian.md:4, adversarial-audit.md:11), both in the new negated form
scripts/check-engine-purity.ts:7   const CONTENT_DIR = path.resolve(process.cwd(), 'src/content');
scripts/check-engine-purity.ts:35  const contentFiles = walkDirectory(CONTENT_DIR);
scripts/check-engine-purity.ts:62  for (const filePath of [...engineFiles, ...contentFiles]) {
```

### 2026-09-15 — Item 5 (CRITICAL): schema-migration trigger (X4)

**Change:** `adversarial-audit.md:20` now requires a step only for a *breaking* save-format change (§5). It also tells the auditor not to flag state that rides on already-serialized structures, such as renown on `WorldState.counters`/`flags` (§3).

**Verification:** diff; both cited anchors exist; a sweep of all agent docs for leftover "new state model → migration" wording finds only the new sentence.

```
ARCHITECTURE.md:144  - Every breaking save-format change increments `CURRENT_SCHEMA_VERSION` and registers exactly one new forward-only…
ARCHITECTURE.md:76   - **Milestone Renown Ledger:** … no `SaveData` field or migration step was needed …
```

### 2026-09-15 — Item 6 (CRITICAL): "no pull-request CI" claim (X5)

**Change:** two lines in ARCHITECTURE.md.
- **§7.2 line 201:** the gates run only in `deploy.yml` after merge; `playwright.yml` runs on push and PR but only runs the Playwright smoke suite. The wording was finalized after item 22 so it describes what that job now actually does.
- **P-18 "Current:":** reworded to match.

The P-18 target is unchanged: gating CI on pull requests and a local hook are still planned.

**Verification:** diff (both lines shown in the final diff review), plus tag parity.

```
[Planned] tags without §9 entry: []      §9 entries without tag: []
```

### 2026-09-15 — Item 7 (GAP): no false positives on sanctioned dynamic wiring (proposed patch #2)

**Change:** new bullet in adversarial-audit.md Phase 1 §1. Three kinds of wiring are not violations in themselves:
- allowlisted writes in `engine-encapsulation-allowlist.json`;
- manifest- or registry-registered behavior (action hooks, `registerPrimitive`, status handlers, AI strategies);
- handlers acting through their injected context, including content calling subsystem methods.

Such code is flagged only when its body breaks an unmarked invariant, or when an allowlist entry has no reason.

**[decision taken]** The wording was drafted from ARCHITECTURE.md §3/§7.2, because the originally approved text isn't recoverable.

**Verification:** diff (shown in the final review). Every name cited exists:
- `scripts/engine-encapsulation-allowlist.json` has 9 entries, all with a `reason`.
- `HookDispatcher.registerPrimitive` is named in §3 line 74.
- The `Monster.intent` allowlist entry is at `content/warcraft/ai.ts`.

### 2026-09-15 — Item 8 (GAP): don't re-propose Evaluated-Not-Adopted designs (proposed patch #3)

**Change:** added a sentence to the adversarial-audit.md Scope Note. The auditor must not re-propose a design recorded as **Evaluated, Not Adopted** (naming §6 *Scheduler Partitioning*) without new evidence the recorded evaluation didn't cover, and must cite that evidence.

**[decision taken]** The wording was drafted from §6.

**Verification:** diff. A sweep shows this guidance now exists in ARCHITECTURE.md (source) and adversarial-audit.md (the only agent file that proposes designs), and nowhere contradictory.

### 2026-09-15 — Item 9 (GAP): [UI] diagnostics boundary (proposed patch #4)

**Change:**
- **`rules.md:36` (`[UI]` trigger):** triage and inspection features go through `engine.diagnostics` (§2), never as direct engine-state writes from `src/ui/` or `src/rendering/`.
- **`ui-specialist.md`:** now lists four hard constraints: the existing barrel/content rule, plus presentation-tier imports (§3), encapsulation (§7.2), and the diagnostics boundary (§2). The last says the F2 menu is player-facing and not build-flag gated, and names the four `engine.diagnostics` methods.

**[decision taken]** The wording was drafted from §2/§3/§7.2.

**Verification:** diff. The four method names match ARCHITECTURE.md §2 line 32 (`spawnMonster`, `spawnItem`, `toggleGodMode`, `revealFloorMap`). The encapsulation check (item 3 run) confirms no current UI code violates the new text.

### 2026-09-15 — Item 10 (GAP): cleared-floor respawn rescan

**[decision taken]** Port rather than discard.

**Change:** the uncommitted fix from worktree `elegant-wu-84731d` was applied to `main` with `git apply`, and `src/engine/world/__tests__/clearedFloorRespawn.test.ts` was copied over.
- **Clean apply:** both target files are byte-identical between the worktree base `0339f1a` and HEAD (`git rev-parse` blobs match).
- **Protected files (§8.1):** neither `floorManager.ts` nor `spawner.ts` is protected.
- **Worktree:** left untouched, still dirty. Delete it yourself once you're satisfied with the port.
- **What the fix does:**
  - `map.lastRespawnTurn` is reset on every respawn attempt, not only a successful one.
  - An early return covers catalogs with no eligible definition.
  - `isEligibleDungeonMonster` is extracted from `selectDungeonMonsterDefinition`.
- **Docs:** no ARCHITECTURE.md change needed. It mentions floor respawn only in the P-06 non-isolated list.

**Verification:** the ported test, three mutations, and the sim before/after. Every mutation was restored from a byte backup with a matching sha256; `git checkout` would have destroyed the uncommitted port.

```
ported test on main:                       Tests  4 passed (4)
M10-true-revert (HEAD floorManager.ts):    × does not rescan the map every turn with an empty monster catalog → expected 7840 to be 784
                                           × does not rescan … no definition eligible for the floor           → expected 7840 to be 784
                                           × backs off for a full interval when every spawn is rejected       → expected +0 to be 10
                                           Tests  3 failed | 1 passed (4)
M10a (remove early lastRespawnTurn reset): Tests  2 failed | 2 passed (4)
M10b (remove no-eligible early return):    Tests  4 passed (4)   ← NOT caught (see note)
sim dormant(0) median: before 0.981 ms/turn (item 1 run) → after 0.094 ms/turn (final gates)
```

**Note on M10b.** The early return only skips one map scan per interval, which the `lastRespawnTurn` reset already caps. It's an optimization with no dedicated test, not a correctness guard, so the gap is acknowledged rather than fixed.

### 2026-09-15 — Item 11 (CLEANUP): orphaned remote-tracking ref

**Change:** `git update-ref -d refs/remotes/local-main/main`. It pointed at `7c9b9cf`, for a remote that no longer exists.

**Verification:**
```
after: []     git branch -a | grep -c local-main → 0
```

### 2026-09-15 — Item 12 (CLEANUP): merged competent-moore worktree

**Change:** `git worktree remove` (no `--force`, so git would refuse on a dirty tree) and `git branch -d claude/competent-moore-98198d` (`-d` refuses if unmerged).

Remote branch `origin/claude/competent-moore-98198d` was **not** deleted: that's outward-facing, so it's your call.

**Verification:**
```
worktree status: []      branch --merged main: claude/competent-moore-98198d
worktree removed
Deleted branch claude/competent-moore-98198d (was af4811a).
git worktree list → main + elegant-wu-84731d only
```

### 2026-09-15 — Item 13 (CLEANUP): stale Vitest exclude

**Change:** removed `'playwright/**'` from `vite.config.ts` `test.exclude`; that directory was deleted in `9b49aa9`.

**Verification:** `npm test` in the final gates collects 166 files (165 before, plus 1 new test from item 10). `**/.claude/**` and `e2e/**` are still excluded, so Vitest picks up no Playwright or worktree specs. `vite.config.ts` changed, so the final gates use `npm run build:all` per §7.1.

### 2026-09-15 — Item 14 (CLEANUP): stale P-24 sequencing sentence (X6)

**Change:** "independent of the other four" became "independent of all other planned items". The P-23 numbering gap is left as-is, because §0 says section and planned-item numbers are stable.

**Verification:** diff (1 line); `[Planned]` tag parity clean (item 6 output).

### 2026-09-15 — Item 15 (CLEANUP): unused atlas barrel

**Change:** deleted `src/rendering/atlas/index.ts`.

**Verification:**
- **No importers:** the importer scan across `src`, `tests`, `scripts`, `e2e` and root `.ts` files had one hit, `src/content/cotw/index.ts:7 import … from './atlas'`. That is the content pack's own `atlas.ts`, a different file.
- **Gates:** final lint (tsc) and `build:all` pass.
- **knip:** no longer lists the barrel.

### 2026-09-15 — Item 16 (CLEANUP): obsolete scaffold script

**Change:** deleted `scripts/scaffold-content.js`.

**Verification:** a reference grep across md/json/ts/js/cjs/yml (excluding node_modules, .git, .agents and worktrees) had one hit, the script's own usage string. knip no longer lists it.

### 2026-09-15 — Item 17 (CLEANUP): boot `console.log` — no change

**[decision taken]** Keep.

**Stage 0 correction:** the statement at `src/main.ts:1406` sits inside `if (import.meta.env?.DEV) { … }` (lines 1405-1407), so it never runs in production bundles. It is an intentional dev-only banner, not debugging residue. §0.2 missed the guard.

**Verification:**
```
$ sed -n '1405,1407p' src/main.ts
  if (import.meta.env?.DEV) {
    console.log('Castle of the Winds initialized with Main Menu & Settings.');
  }
```

### 2026-09-15 — Item 18 (CLEANUP): one-off benchmark scripts

**Change:**
- Deleted `run-bench.cjs` (crashed) and `run-bench-internal.ts` (it can only measure the post-revert scheduler).
- The ARCHITECTURE.md §6 historical note now says they were removed on 2026-09-15 and remain in git history (last committed in `3d71469`), instead of "the benchmark harness remains at the repo root".

**Verification:**
- A reference grep (excluding the §6 note and this report) found `[]` before deleting.
- Final `npm run sim` passes; `npm run sim` is the documented successor.
- knip no longer lists either file.

### 2026-09-15 — Item 19 (CLEANUP): malformed meta-retrospective-evolver skill (X7)

**Change:**
- The outer proposal fence is now four backticks (```` ````text ````), so the nested ```` ```diff ```` block can close inside it.
- Both fences are closed.
- The garbled line 53 now reads "<Why this is a systemic procedural change, not an ephemeral fact>".
- The `trigger: post-task-hook` frontmatter is left as-is; changing it could alter how Antigravity loads the skill.

**Verification:** fence balance.
```
49:````text   57:```diff   62:```   63:````
```

### 2026-09-15 — Item 20 (CLEANUP): audit-architecture command re-sync (X8)

**Change:** `.claude/commands/audit-architecture.md` rewritten.
- Sections are now labelled with ARCHITECTURE.md's own §2–§9.
- §5 points at `storage/*.ts` and `containerRegistry.ts`, not `scheduler.ts`.
- §7 runs all five gates including `check:engine-encapsulation` and `validate:schema`, and compares workflows to §7.2.
- A new §8–§9 step checks tag and register parity.
- The cross-check now includes CLAUDE.md and asks about contradictions or narrowing, replacing the settled "does rules.md reference ARCHITECTURE.md at all" question.

**Verification:** diff. The harness picked up the updated command as the `audit-architecture` skill.

### 2026-09-15 — Item 21 (CLEANUP): `core/turnScheduler.ts` alias shim

**Change:**
- `scheduler-guard.test.ts` now imports `{ EnergyScheduler, TurnScheduler }` from `../scheduler`, which exports `TurnScheduler` as an alias at line 120.
- Deleted `src/engine/core/turnScheduler.ts`, the only file in `src/engine/core/`.

**Verification:**
- A reference scan for `core/turnScheduler|engine/core` across src, scripts, tests, e2e, ARCHITECTURE.md, `.antigravity` and CLAUDE.md (excluding the edited test) returned `[]` before deleting.
- Final lint and `npm test` pass (scheduler-guard included in 166 files).

### 2026-09-15 — Item 22 (CLEANUP): Playwright scaffold → real smoke test

**[decision taken]** Promote, not delete: you added Playwright deliberately across two commits.

**Change:**
- **Deleted** `e2e/example.spec.ts`, which navigated to playwright.dev.
- **New `e2e/smoke.spec.ts`:** loads the built `dist/index.html` over `file://`. It asserts `#main-menu-screen` and `#btn-menu-new-game` are visible, `#game-canvas` is attached, and no `pageerror` fired. It fails with a clear message if `dist/` is missing.
- **`playwright.config.ts`:** the dotenv/webServer boilerplate is removed. The reporter is `list` plus `html` with `open: 'never'`, so a local failure can't block on the report server. All three browsers are kept.
- **`playwright.yml`:** new "Build single-file bundle" step (`npm run build`) before the tests.
- **ARCHITECTURE.md (§8.2 sync):** a §3 table row for `e2e/`, and the §7.2 line 201 wording from item 6.

**Verification:** baseline run, a mutation proof, an informational mutation, and a final clean run. `main.ts` and `vite.config.ts` were restored from sha256-checked backups.

```
baseline (npm run build; npx playwright test):  3 passed (4.1s)         [chromium, firefox, webkit]
M22a boot throw before mainMenu.show():         Error: expect(locator).toBeVisible() failed — locator('#main-menu-screen')   1 failed
final (npm run build; npx playwright test):     3 passed (2.5s)
test-results/, playwright-report/ → ignored by .gitignore:16-17
```

**Informational finding (M22b, no backlog change):**
- **Mutation:** disabled the `clean-script-for-file-protocol` rewrite in `vite.config.ts`.
- **Result:** the bundle kept `<script type="module" crossorigin>` (1 occurrence), and Chromium 1243 still booted to the main menu over `file://` (`1 passed`).
- **Implication:** ARCHITECTURE.md §2/§7.1 says the rewrite is needed "so bundles run under the `file://` protocol without CORS errors". That didn't reproduce in Chromium, plausibly because inlined module scripts are never fetched. It was not tested in Firefox or WebKit, or in older browsers where it may still matter. The doc and plugin were left as they are; worth a deliberate look before anyone removes the plugin.

### 2026-09-15 — Items 23–28 (INFORMATIONAL): acknowledged, no action

| # | Status |
|---|---|
| 23 | §0.4 density recorded. The extraction decision is deferred as instructed. |
| 24 | Revert-and-confirm now also covers item 10 (M10) and item 22 (M22a). The harness is still not persisted. |
| 25 | knip exports/types untouched. After this run, `knip --include files` lists one unused file: `.agents/skills/setup-ts-deep-modules/dependency-cruiser.config.cjs`, inside the untracked skill pack (item 26), not project code. All 4 project files from §0.2 are gone. |
| 26 | `.agents/`, `.claude/skills/` and `skills-lock.json` are still untracked; not assessed. |
| 27 | P-06, P-10 and P-19 unchanged. |
| 28 | No scheduler-partition residue. Re-confirmed: no code item touched scheduler logic (item 21 only moved an import). |

### 2026-09-15 — Final full gate run (covers items 10, 13, 15, 16, 18, 21, 22)

```
===== EXIT 0 (npm run lint)
✓ Headless Simulation Purity: 0 DOM/Canvas globals across 308 engine & content files.
✓ Engine Boundary Isolation: 0 reverse imports in engine source and test files.
✓ Content Boundary Isolation: 0 UI/Rendering imports across 32 content files.
✓ Public API Surface: 0 deep imports into engine internals across 79 UI/Rendering files.   ← 80 → 79: atlas barrel removed (item 15)
✓ Engine Encapsulation: 0 unsanctioned mutations of engine internals outside src/engine/.
===== EXIT 0 (npm test)
 Test Files  166 passed (166)
      Tests  975 passed (975)                                                              ← +1 file / +4 tests: clearedFloorRespawn (item 10)
===== EXIT 0 (npm run sim)
Data points: realistic=7 (median @1.0x), realistic-high=21 (max @1.5x), stress=105 (5x, not realistic)
dormant            0           0.094        0.108                0                         ← was 0.981 before item 10
dormant            7           0.107        0.115                7
dormant           21           0.100        0.125               21
dormant          105           0.253        0.326              105 [stress]
awake              7           0.092        0.093                7
awake             21           0.139        0.158               21
awake            105           0.376        0.388              105 [stress]
spells    1000 casts: median 1.6 ms total, max 3.2 ms
Pipeline Caught Errors: 0
✓ Headless simulation passed.
===== EXIT 0 (npm run validate:schema)
✅ Schema migration validation passed: v1 -> v9 verified.
===== EXIT 0 (npm run build:all)
dist/index.html     832.95 kB │ gzip: 222.64 kB
dist/cotw.html      832.95 kB │ gzip: 222.64 kB
dist/warcraft.html  801.83 kB │ gzip: 215.28 kB
```

Plus Playwright: `3 passed` on the final build (item 22).

**Working tree at the end (nothing committed):**
- **Modified (13):** `.antigravity/archetypes/guardian.md`, `ui-specialist.md`, `.antigravity/rules.md`, `.antigravity/skills/adversarial-audit.md`, `meta-retrospective-evolver.md`, `.claude/commands/audit-architecture.md`, `.github/workflows/playwright.yml`, `ARCHITECTURE.md`, `playwright.config.ts`, `src/engine/__tests__/scheduler-guard.test.ts`, `src/engine/dungeon/spawner.ts`, `src/engine/world/floorManager.ts`, `vite.config.ts`.
- **Deleted (6):** `e2e/example.spec.ts`, `run-bench-internal.ts`, `run-bench.cjs`, `scripts/scaffold-content.js`, `src/engine/core/turnScheduler.ts`, `src/rendering/atlas/index.ts`.
- **New (3):** `e2e/smoke.spec.ts`, `src/engine/world/__tests__/clearedFloorRespawn.test.ts`, this report.

**Still open for you:**
1. Review the drafted wording for items 7–9 against what you originally approved.
2. Commit.
3. Optionally delete remote branch `origin/claude/competent-moore-98198d`.
4. Delete the `elegant-wu-84731d` worktree once you're satisfied with the item 10 port.
5. Optionally look into the M22b finding about the file:// script rewrite.
