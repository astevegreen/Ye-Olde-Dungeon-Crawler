# Rework Audit, Pattern Analysis & Workflow Diagnosis

**Project:** *Ye Olde Dungeon Crawler (YODC)*  
**Date:** September 23, 2026  
**Author:** AI Pair Programming Retrospective (Google Antigravity & Claude Code telemetry audit)  
**Target Audience:** Non-programmer Game Developer  

---

## Executive Summary

Over a two-week period from September 11 to September 23, 2026, the project underwent rapid development across 119 commits, growing to ~64,000 lines of source code and ~34,000 lines of automated tests. During this time, significant portions of the engine, UI, and content were rewritten, reverted, or overhauled.

This audit analyzed all project documentation (`ARCHITECTURE.md`, ADRs, architecture sub-docs), 17 condensed session logs in `retro/`, Git history (`git-log.txt`, `git-churn.txt`, `git-reflog.txt`), and test suites to diagnose the root causes of this churn.

### Core Verdict
- **Is your experience typical of game development?** Partially yes, but largely no.
- **Typical:** Modifying game mechanics after playtesting (e.g. replacing a frustrating permafrost damage tick with a rewarding Giant Blood buff) and refining HUD layout for different window sizes is normal early-stage game development.
- **Atypical:** Building five distinct town-return mechanisms only to delete them all; having the architecture specification document modified more frequently than any code file; fighting coordinate-sync issues between Canvas virtual units and DOM CSS pixels; and untangling campaign narrative from the simulation engine because an agent sneaked it into a commit titled "Code Hygiene Pass." 
- **Primary Diagnosis:** The rework was not caused by shifting design goals. It was driven by **premature architectural complexity**, a **false sense of security from unit tests**, and the **communication overhead of an alternating two-agent workflow**.

---

## 1. Rework Audit: The 15 Most Significant Overhauls

*Definition of Significant Rework:* A component, mechanic, or file that was replaced or substantially redone (not just extended), any commit or reset that undid previous work, or any problem that required more than 3 prompt turns to fix.

| # | Rework Theme & Description | Primary Root Cause | Evidence Citation |
|---|---|---|---|
| **1** | **Wholesale Town-Return Deletion (P-03):** 5 separate town return systems (*Runic Conduit, Valkyrie Sprint, Dwarven Winch, Town Portal, TownReturnDispatcher*) totaling 3,356 lines across 39 files were built, tested, and then completely purged and replaced by the single *Rune of Return*. | **Scope creep / shifting requirements** *(unaligned feature generation)* | Commit [`b3132a3`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/b3132a3), commit [`350e365`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/350e365); `src/engine/townReturn/` |
| **2** | **Hostage Ritual & Engine Creep Purge:** Antigravity adapted `energyModel.ts` for an Act 1 moral dilemma but hardcoded campaign narrative, spell IDs, and story flags into `engine.ts` under a commit titled "Code Hygiene Pass" (`dc5de31`). Claude had to perform a massive architectural overhaul to extract these into generic manifest hooks, move logic to `src/content/cotw/hostageRitual.ts`, and create the `check:engine-creep` gate. | **Multi-model handoff friction** & **Agent misunderstood instructions** | Sessions `retro/2026-09-22_antigravity_4.md`, `retro/2026-09-22.md`; commits [`dc5de31`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/dc5de31) & [`b2ca822`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/b2ca822) |
| **3** | **Character Menu & Inverted Coordinate Sync:** Consolidating menus into a tabbed `CharacterMenuModal` (`df68c71`) caused tabs to close unexpectedly. Antigravity's initial fix (`334c848`) reverse-mapped DOM CSS pixels into canvas virtual coordinates, causing a severe regression (blurred, illegible inventory text). Took 4+ prompt turns to diagnose and invert the coordinate math. | **Agent introduced a regression / broke working systems** | Sessions `retro/2026-09-21_1.md`, `retro/2026-09-21_antigravity_1.md`; commits [`334c848`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/334c848) & [`54b38db`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/54b38db) |
| **4** | **In-Game HUD Overhaul (ADR-0004):** `ViewportManager` initially guessed bar heights with hardcoded constants and CSS `flex-wrap`, causing bars to overflow and get clipped by `body { overflow: hidden }`. Turn counter was rendered redundantly 3 times. Overhauled with `ResizeObserver`, dynamic bounding-rect math, and container queries. | **Architecture/spec didn't fit actual game requirements** | `docs/decisions/0004-hud-overhaul-retrospective.md`; commit [`6495bc8`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/6495bc8) |
| **5** | **Pre-Release Migration Chain Deletion (ADR-0002):** `SchemaMigrator` carried full forward migration steps from v0 all the way to v11 plus a legacy tile codec. All historical migration steps were deleted pre-launch, setting v11 as the absolute floor and requiring a new governance exception (§8.1 exception 4). | **Architecture/spec didn't fit actual game requirements** *(carrying premature enterprise migration burden)* | `docs/decisions/0002-v0-v11-migration-chain-deletion.md`; commit [`2a9be38`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/2a9be38) |
| **6** | **Jarnvidr Exposure Replaced by Giant Blood (ADR-0003):** Environmental permafrost exposure damage (`jarnvidrExposureHandler`) and `levelScaledResistance.ts` were removed and replaced with a positive felt buff (`cotw/giantBlood.ts`) tied to monster scaling. | **Changed my mind after seeing it (normal iteration)** | `docs/decisions/0003-jarnvidr-exposure-handler-to-giant-blood.md`; commits [`46401b2`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/46401b2) & [`0f1376e`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/0f1376e) |
| **7** | **Scheduler Partitioning Reversal (ADR-0001):** `EnergyScheduler` was rewritten to maintain separate active and dormant entity lists. Benchmarking showed throughput was sub-millisecond even without it, while the sync logic desynced and caused entity bugs. Completely reverted back to a single flat list. | **Architecture/spec didn't fit actual game requirements** *(premature optimization)* | `docs/decisions/0001-scheduler-partitioning-evaluated-not-adopted.md`; commit [`3d71469`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/3d71469) |
| **8** | **Circular References in Inventory Serialization:** Items and containers held live parent/child object references, causing circular reference crashes in `JSON.stringify` during save/load. Required rewiring container hierarchy to use scalar IDs, introducing `safeJson.ts`, and writing audit tests CD-1 to CD-6. | **Architecture/spec didn't fit actual game requirements** | Commit [`be490c8`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/be490c8); `tests/auditRemediations.test.ts` |
| **9** | **Context & Token-Efficiency Restructuring:** The project grew so large that feeding files to agents blew context windows. Forced a multi-phase code/doc split: `ARCHITECTURE.md` into 5 sub-docs + ADRs (`ec15022`), `sprites.ts` (2,680 lines) into 3 modules (`ca84fc4`), `main.ts` command catalog extraction (`01f0745`), and UI vendor panels (`71b8ab5`). | **Architecture/spec didn't fit actual game requirements** *(LLM context economics)* | Session `retro/2026-09-21_2.md`; commits [`ec15022`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/ec15022), [`ca84fc4`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/ca84fc4) |
| **10** | **Sprite Split Silent Collision Regression:** Splitting `sprites.ts` into three files using JavaScript spread syntax introduced a silent flaw: identical recipe keys across files would overwrite each other without any compile error or test failure. A broken sprite passed all 1,211 tests undetected until Claude demonstrated it and wrote a key-disjointness guard. | **Agent introduced a regression / broke working systems** | Session `retro/2026-09-21_2.md`; commit [`af528c6`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/af528c6) |
| **11** | **Invalid CLI Flag Process Lock (`tsx -e`):** Claude drafted a prompt instructing Antigravity to run `npx tsx -e "..."`. Because `tsx` does not support `-e`, it dropped into an interactive REPL mode, blocking stdin and hanging in the background for hours until manually killed. Claude had to take over the task. | **Multi-model handoff friction** *(prompt defect from agent to agent)* | Session `retro/2026-09-21_2.md` (lines 70–135) |
| **12** | **Campaign/Engine Decoupling (Valhalla Portal & Victory):** Early engine code embedded CotW-specific victory conditions, the Altar of Tyr, and Valhalla portals into `movement.ts`, `deathResolver.ts`, and `dungeonArc.ts`. In `9cdc39b`, these were purged from `src/engine/` and re-implemented as generic manifest choices and hooks. | **Scope creep / shifting requirements** *(early single-campaign assumptions)* | Commit [`9cdc39b`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/9cdc39b); `src/engine/actions/movement.ts` |
| **13** | **Permadeath & "Continue" Button State:** Dying in combat wrote the dead character into the active autosave slot. Clicking "Continue" on the title screen would load a corpse, locking the game. Required rewriting profile management so death permanently flags the roster record as `fallen` and disables Continue. | **Agent introduced a regression / broke working systems** | Session `retro/2026-09-23.md`; commit [`1c7c234`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/1c7c234); `src/engine/storage/profile-manager.ts` |
| **14** | **Map Overlay Input Leak & Vi-Key Binding Collision:** The map overlay failed to capture `Escape`, allowing `SaveQuitModal` to open underneath it, while arrow keys continued moving the player behind the map. Additionally, default movement bindings overlapped with standard action keys (3 duplicate keys). Both had to be fixed in `dbd4492`. | **Agent introduced a regression / broke working systems** | Session `retro/2026-09-23.md`; commit [`dbd4492`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/dbd4492); `src/rendering/input-handler.ts` |
| **15** | **Production Minification Breaking `constructor.name`:** The engine relied on `action.constructor.name` for action logging, diagnostics, and serialization. While all Vitest tests passed in development, Vite's production minifier compressed class names to single letters (`e`), breaking runtime pipelines in single-file bundles. Fixed with `keepNames: true` (`f5acc97`) and typed action introspection (`a571661` / P-25). | **Architecture/spec didn't fit actual game requirements** *(runtime reflection vs production bundler)* | Session `retro/2026-09-23.md`; commits [`f5acc97`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/f5acc97) & [`a571661`](https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/commit/a571661) |

---

## 2. Pattern & Churn Analysis

### Root Cause Frequency Tally

Across the 15 major reworks, the primary drivers break down as follows:

```
┌─────────────────────────────────────────────────────────────┬───────┐
│ Root Cause Category                                         │ Count │
├─────────────────────────────────────────────────────────────┼───────┤
│ Architecture/spec didn't fit actual game requirements       │   6   │
│ Agent introduced a regression / broke working systems       │   5   │
│ Multi-model handoff friction (Claude <-> Gemini)            │   3   │
│ Scope creep / shifting requirements                         │   2   │
│ Changed my mind after seeing it (normal game dev iteration) │   1   │
└─────────────────────────────────────────────────────────────┴───────┘
```
*(Note: Item #2 counted under both handoff friction and agent misunderstanding).*

### Analysis of Frequent Patterns

1. **Architecture/Spec Mismatches (40% of reworks):**
   The project prioritized abstract software architecture patterns before testing them against reality. Examples:
   - Designing an active/dormant scheduler partition for hundreds of monsters when the level generator produces ~20.
   - Preserving v0→v11 save migration history when zero live players existed.
   - Relying on runtime `constructor.name` introspection that was stripped out by the single-file HTML minifier.
   - Mixing CSS DOM viewport pixels with Canvas virtual integer coordinates without anchoring them to the canvas bounding box.

2. **Agent-Induced Regressions (33% of reworks):**
   Automated unit tests (1,200+ tests) passed cleanly while the actual game was broken. Unit tests passed when:
   - The inventory overlay became an illegible blur.
   - Duplicate sprite keys silently overwrote wall textures with floor textures.
   - The player died and could resume as a walking corpse.
   - The map overlay let arrow keys walk the player into traps behind the modal.

3. **Multi-Model Handoff Friction (20% of reworks):**
   Using Claude to write prompt specifications for Antigravity created a high-latency game of telephone. Claude assumed CLI flags (`tsx -e`) that froze Antigravity; Antigravity took shortcuts by dumping campaign logic directly into `engine.ts`; and Claude spent entire sessions auditing and untangling Antigravity's code.

4. **Normal Creative Iteration (Only 7% of reworks):**
   In human game development, 50%+ of early churn is "finding the fun" (changing mechanics, adjusting pacing, trying new ideas). In this project, creative second-guessing was virtually absent.

### File Churn Breakdown: Redoing vs. Normal Growth

From `git-churn.txt`:

1. **`ARCHITECTURE.md` (61 commits) — Almost Entirely Redoing & Governance Overhead:**
   The #1 most touched file in the repository. It churned because of a heavy governance model: registering P-numbers, retiring P-numbers, documenting §8.1 exceptions, splitting sub-docs, and resolving contradictions between agent system prompts.
2. **`src/engine/engine.ts` (30 commits) & `src/main.ts` (27 commits) — Predominantly Redoing:**
   Both files became monolithic catch-all files. When Antigravity added systems (companions, blood magic, town returns), it wired them directly here. When Claude cleaned up the architecture, it stripped them back out.
3. **`src/engine/storage/serializer.ts` (20 commits) & `types.ts` (17 commits) — Predominantly Redoing:**
   Save schemas were repeatedly refactored due to circular references, payload compaction, active-floor bounding, and death handling.
4. **`src/rendering/input-handler.ts` (15 commits) — Predominantly Redoing:**
   Input dispatch was redone multiple times to resolve modal stack conflicts, vi-key collisions, arrow release buffering, and map overlay leaks.
5. **`src/content/cotw/index.ts` (13 commits) & `town.ts` (10 commits) — Normal Feature Growth:**
   These files grew naturally as new items, monsters, and dialogue were added to the campaign.

---

## 3. Structural Diagnosis

*(Distinguishing hard evidence from informed opinion and speculation)*

### The Plan: Scope, Order of Implementation, and Design Balance

- **Hard Evidence:**
  - In 12 days, the repository generated 64,000 lines of source code and 34,000 lines of tests.
  - The plan called for extensive secondary features: companions, pacts, renown, blood magic, two separate campaign packs (`cotw` and `warcraft`), and 5 distinct town-return systems.
  - On Day 12 (September 23), when Claude actually launched the game in a browser preview to play it:
    - The player spawned in a dark room under fog-of-war in town without knowing where shops were.
    - Combat on Floors 1–3 was trivial, while Floor 5 killed the character immediately.
    - The WarCraft campaign was an untextured ASCII reskin (rendering letters like `F`, `W`, `D`) and displayed "Castle of the Winds" and "Hall of Valhalla" branding across 36 screens.
    - 3,356 lines of town-return code had to be discarded because nobody had validated whether they fit the game.
- **Informed Opinion (Game Development Best Practices):**
  **The plan was built outside-in rather than inside-out.** A sound game development plan starts with a "vertical slice": 3 to 5 floors, balanced combat, intuitive controls, and a clear game loop that is playtested daily. Once that core loop is genuinely fun, you build extensibility, secondary campaigns, companions, and meta-progression. This project spent massive effort building enterprise-grade extensibility and schema migration chains before verifying if walking down a corridor and hitting a monster felt good.

### The Workflow: Task Sizes, Instructions, Verification, and Handoffs

- **Hard Evidence:**
  - *Verification Blind Spot:* Unit tests and lint gates verified import topology and type correctness, but could not detect visual blur, minification failures, or input leaks.
  - *The AI Telephone Game:*
    - In `2026-09-21_2.md`, Claude drafted a prompt with `tsx -e` that caused Antigravity to hang in an infinite background loop.
    - In `2026-09-22_antigravity_4.md`, Antigravity implemented a scripted event by dumping campaign code into `engine.ts` (`dc5de31`). It passed every gate because the gates only checked import paths, forcing Claude to spend an entire session refactoring it (`b2ca822`).
    - ADR-0005 and git tag `verified` had to be created solely to manage review queues between the two AI agents.
- **Informed Opinion:**
  Because you are a non-programmer, you could not visually inspect code diffs to know when an agent took an architectural shortcut. You were placed in the exhausting position of acting as a human clipboard between two AI models that had different assumptions. The overhead of maintaining strict governance rules to prevent agents from breaking things consumed more time and tokens than developing the actual game.

---

## 4. Recommendations

Ranked by the amount of rework each will prevent, written in plain language:

### Act on Now

#### 1. Freeze New Features and Implement "Play-First" Verification
- **Priority:** #1 (Will prevent ~40% of future rework)
- **Tied to:** Reworks #1, #3, #13, #14 (Town-return deletion, blurred inventory, dead continue, map input leaks).
- **Plain Language Action:**
  Do not add any new mechanics, companions, pacts, or campaign packs. For the next several sessions, focus entirely on playing through the first 5–10 floors of *Castle of the Winds*. 
  When asking an agent to change anything visual or interactive (menus, controls, combat messages), require the agent to give you a specific 3-step test to perform in your browser (e.g., *"1. Press 'I' to open inventory; 2. Confirm text is sharp; 3. Press 'Esc' to close"*). Never accept *"All 1,280 tests passed"* as proof of completion.

#### 2. End the Two-Agent "Telephone Game" on Single Tasks
- **Priority:** #2 (Will prevent ~30% of future rework)
- **Tied to:** Reworks #2, #10, #11 (`dc5de31` engine creep, `tsx -e` freeze, sprite key overwrite).
- **Plain Language Action:**
  Stop having Claude write prompt instructions for Antigravity to execute. When one model drafts instructions for another, subtle mistakes cause hangs or architectural violations.
  Assign tasks end-to-end to a single agent:
  - If you are having Antigravity build content or UI, prompt Antigravity directly and test the result in your browser.
  - If you need Claude to do a complex refactor or architectural fix, let Claude write and apply the code directly.

#### 3. Slash the Architectural Governance Overhead
- **Priority:** #3 (Will prevent ~15% of future rework)
- **Tied to:** `ARCHITECTURE.md` churn (61 commits) and ADR-0005.
- **Plain Language Action:**
  You are building an indie roguelike, not an enterprise banking system. The requirement that every commit must cite "§8.1 exception 4," that historical migration chains must be preserved for players who do not exist, and that P-number registers must be updated after every task is burning massive amounts of context and developer time.
  Instruct the agents: *"ARCHITECTURE.md is an informational design guide, not a legal contract. Focus on keeping code modular and functional without updating governance registers after every commit."*

### Could Become a Reusable Skill Later

#### 4. Visual & UI Sanity Check Skill (Automated In-Browser Screenshots)
- **Priority:** #4 (Will prevent ~10% of future rework)
- **Tied to:** Reworks #3, #4, #14 (Blurred menus, overlapping HUD bars, map input leaks).
- **Plain Language Action:**
  Package an automated skill using Playwright or headless Chrome DevTools that boots `dist/index.html`, opens every modal (Inventory, Character, Settings, Map), captures screenshots at multiple screen resolutions, and verifies that text elements are not clipped, blurred, or overlapping before committing.

#### 5. Content Pack Validation Skill
- **Priority:** #5 (Will prevent ~5% of future rework)
- **Tied to:** Rework #15 (WarCraft pack having no sprite art and displaying CotW branding).
- **Plain Language Action:**
  Create an automated checker skill that scans content packs. When an agent creates or updates a pack (like *WarCraft*), the skill checks that all required tiles have sprite recipes (no raw ASCII letter fallbacks) and verifies that shared UI strings do not mention "Castle of the Winds" or "Valhalla" unless explicitly configured.

---

## Conclusion

Your experience has been frustrating not because building a game is inherently this difficult, but because your workflow had two major leaks:
1. **Building wide before testing deep:** Creating dozens of peripheral systems before verifying the basic 5-floor playable loop.
2. **The multi-agent friction loop:** Spending substantial time and energy keeping two separate AI models from breaking each other's assumptions.

By pivoting to playtesting the game directly, trimming the governance red tape, and assigning tasks to a single model end-to-end, your development speed will increase and unexpected rework will plummet.
