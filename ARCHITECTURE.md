# Architectural Specification & Engine Invariants

> **AI Context Instruction:** This document is the authoritative architecture spec for this repository. Read it in full before any structural change (new files, new dependencies between `src/engine/`, `src/content/`, `src/ui/`, `src/rendering/`, or edits to protected files). Prioritize these rules over general software patterns.
>
> **Status conventions:**
> - **Unmarked statements** describe the codebase as it exists today. Treat them as facts and enforceable invariants.
> - **[Planned: P-NN]** marks a guideline the codebase does not yet satisfy. The linked entry in §9 records the current state and the target. Do not write code that assumes a planned capability exists, and do not implement a planned item unless the task explicitly requests it (§8.3).
> - **[Deferred: P-NN]** marks work that is recorded but deliberately out of scope, with no schedule. The linked entry in §9's *Deferred* subsection records why. Treat it as not planned: do not implement it unless the task explicitly revives it.
> - Section numbers are stable and are cited by agent configuration files. Do not renumber sections.

---

## 1. Game Concept & Core Simulation Loops
- **Vision & Genre:** A turn-based, grid-based dungeon crawler and roguelike inspired by *Castle of the Winds*, built from modular systems that support variable narrative campaigns and thematic content packs. Shipping packs: `src/content/cotw/` (*Castle of the Winds*) and `src/content/warcraft/` (*WarCraft*). Future packs (e.g. *The Old Kingdom*) must be addable without engine changes beyond generic capabilities (§3, No Engine Creep).
- **Core Gameplay Loop:** Headless turn execution -> actor intent dispatch -> spatial calculation & collision resolution -> tactical bump combat / spellcasting / inventory management -> status & environmental propagation -> floor progression / level transitions.
- **Target Aesthetic:** Clean, retro tile-blitted presentation rendered via Canvas texture atlases, coupled with responsive modal dialogs, sliding-window chorded keyboard controls, and tactile visual effect feedback.

---

## 2. System Boundaries & Tech Stack Invariants
- **Language & Build Target:** TypeScript with Vite and `vite-plugin-singlefile`, configured with `assetsInlineLimit: 100000000` (100MB) and `cssCodeSplit: false`, compiling into offline-capable, zero-dependency, self-contained single-file HTML distributions.
- **Release Strategy:** One single-file bundle per content pack, selected at build time by Vite mode (or the `THEME` environment variable) and exposed to the app as `import.meta.env.VITE_THEME`:
  - `npm run build:cotw` (and plain `npm run build`, which defaults to the cotw theme) -> `dist/index.html` plus an identical `dist/cotw.html`.
  - `npm run build:warcraft` -> `dist/warcraft.html`.
  - `npm run build:all` builds both.
  - `emptyOutDir` is `false`, so bundles from earlier builds remain in `dist/`.
  - The `clean-script-for-file-protocol` post-build plugin in `vite.config.ts` rewrites `<script type="module" crossorigin>` to a classic `<script>`, so bundles run under the `file://` protocol without CORS errors.
- **Execution-Path Headless Simulation Purity:** Purity is defined by *execution path*, not file location. Any function, handler, hook, or callback that runs inside the simulation — whether authored in `src/engine/`, in `src/content/`, or registered at runtime — must not access DOM globals (`window`, `document`, `HTMLElement`), Canvas contexts (`CanvasRenderingContext2D`), audio APIs, or timing globals (`requestAnimationFrame`, `setTimeout`). Simulation outcomes must also be deterministic (§7.2).
- **Public API Surface Integrity:** `src/ui/`, `src/rendering/`, and `src/content/` import the engine only through `src/engine/index.ts`. Deep imports into engine internals (e.g. `src/engine/grid/*`, `src/engine/storage/*`, `src/engine/actions/*`) are barred for these layers.
  - Enforced today for `src/ui/` and `src/rendering/` by `npm run check:engine-purity`.
  - Content packs still contain deep imports. **[Planned: P-02]** removes them, and **[Planned: P-19]** adds enforcement.
  - `scripts/` and test files may deep-import engine internals.
- **Diagnostic API Namespacing & Triage Access:** Triage and inspection methods (`spawnMonster`, `spawnItem`, `toggleGodMode`, `revealFloorMap`) are namespaced under `engine.diagnostics`, keeping the primary engine API surface clean. The `[F2]`/backtick triage menu is a deliberate, always-reachable, in-game feature for players — not developer-only and not gated behind a build flag. `InputHandler` checks the toggle before the input lock, so it works during effect playback.
- **Deterministic Action Pipeline:** Player actions flow through `ActionPipeline.executeWithHooks()` in `src/engine/actions/actionPipeline.ts` and return a typed `ActionResult` (§4). Monster actions and environmental reactions do not yet use the pipeline. **[Planned: P-05]**
- **Bounded Simulation Scoping:** Only the active floor is simulated. Per-actor expensive work — AI decision-making, pathfinding, combat, awakening and bestiary checks — is limited to the player's vicinity through dormant-actor short-circuiting and bounded FOV (§6). Turn selection in `EnergyScheduler` deliberately stays linear in the active floor's actor count; see §6, *Scheduler Partitioning (Evaluated, Not Adopted)*.

---

## 3. Directory Layout, Module Topology & Dependency Inversion

| Layer / Directory | Primary Responsibility | Dependency & Import Rules |
| :--- | :--- | :--- |
| `src/main.ts` | **Composition Root.** Selects the content manifest and theme from `VITE_THEME`; creates presentation components; obtains `GameEngine` instances from the storage layer (`ProfileManager`, `AutosaveManager`); wires engine callbacks (`onGameEvent`, `onFloorChanged`, `onChoiceInteract`, …); mounts DOM listeners. | The **only** source module that imports content packs. May import every layer. All its engine imports resolve through `src/engine/index.ts`; `check:engine-purity` enforces this. |
| `src/content/` | Campaign content packs: item/monster catalogs, spells, status effects, encounter tables, vaults, towns, quest arcs, themes, and scripted behaviors. | Imports the engine (types *and* runtime values) only through `src/engine/index.ts`, never engine internals. **[Planned: P-02]** NEVER imports `src/ui/` or `src/rendering/`. Reaches the engine only through the `GameContentManifest` (§3, Content Extensibility Model). |
| `src/engine/` | Headless state coordinator, action pipeline, spatial grid, FOV, scheduler, AI behavior trees, storage and serialization, PRNG. | Zero browser/DOM/Canvas dependencies. Exposes its public API through `src/engine/index.ts`. Production source has **zero** imports from `src/content/`, `src/ui/`, or `src/rendering/` (Dependency Inversion). Colocated engine tests (`src/engine/**/__tests__/`) may import content packs as integration fixtures, never `src/ui/` or `src/rendering/`. |
| `src/rendering/` | Canvas texture atlases, sprite blitting, camera, canvas overlays, visual effect playback (`fxRunner.ts`), and keyboard dispatch (`input-handler.ts`, class `InputHandler`). | Engine via `src/engine/index.ts` only. May import `src/ui/` (presentation tier). Never imports `src/content/`. |
| `src/ui/` | DOM HUD, LIFO modal stack (`modalStack.ts`), chorded input buffer (`input/chordBuffer.ts`), settings & keybindings, diagnostic tools. | Engine via `src/engine/index.ts` only. May import `src/rendering/` **types only**. Never imports `src/content/`. |
| `scripts/` | Headless verification tooling, purity auditor, simulation benchmark, schema validator. | Developer automation only; may deep-import engine internals. Not bundled into the client build. |
| `tests/` | Top-level Vitest suites. Most suites are colocated in `src/**/__tests__/`. | Testing harness only. Not bundled into the client build. |
| `e2e/` | Playwright end-to-end smoke tests (config: `playwright.config.ts`) that load the built `dist/index.html` over `file://`. Requires `npm run build` first. | Testing harness only. Not bundled into the client build; excluded from Vitest. |

### Module Import Hierarchy
```
                              src/main.ts  (Composition Root: may import every layer)
                                   │
                 ┌─────────────────┴──────────────────┐
                 ▼                                    ▼
┌─────────────────────────────────┐          ┌──────────────────┐
│       Presentation tier         │          │   src/content/   │
│  src/rendering/ ──► src/ui/     │          │  (content packs) │
│  src/ui/ ┄┄types┄┄► rendering   │          └────────┬─────────┘
└────────────────┬────────────────┘                   │
                 │  via src/engine/index.ts only      │
                 ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               src/engine/  (headless simulation)                │
└─────────────────────────────────────────────────────────────────┘
```
- `src/engine/` never imports `src/content/`, `src/ui/`, or `src/rendering/`.
- At runtime, content reaches the engine only as data and callbacks inside the `GameContentManifest`. The storage layer passes the manifest to the `GameEngine` constructor when creating or loading a game.

### Content Extensibility Model
- **Declarative Manifests:** Each content pack exports a `GameContentManifest` (`src/engine/types/manifest.ts`). The `GameEngine` constructor registers its entries, for example: `monsters`, `spells`, `traps`, `statusEffects`/`statusHandlers`, `aiBehaviors`/`aiStrategies`, `actionCommands`, `actionHooks`, `affinityMatrix`, `pacts`, `progressionConfig`, `initialWorldState`, `quest`, and `theme`. Content assembles behavior from composable primitives: status afflictions, spawners, stat triggers, damage affinities, drop tables, and quest arcs.
- **Two Hook Mechanisms:**
  1. **Action hooks** (`manifest.actionHooks`, interface `ActionHook` in `actionPipeline.ts`): priority-ordered `pre`/`post` hooks around pipeline-executed actions. They receive `ActionHookContext` (`action`, `engine`, `actionType`, and `result` in the post phase). A pre-hook can short-circuit with its own `ActionResult`. Hooks currently fire only for player actions. **[Planned: P-05]**
  2. **Declarative event hooks** (`HookDispatcher` in `src/engine/hooks/hookDispatcher.ts`): `HookDescriptor` data (event, chance, predicate, primitive action) attached to items and monsters or registered globally. They receive `HookContext` (`engine`, `attacker`, `defender`, `damage`, …). Content can add new primitive types with `HookDispatcher.registerPrimitive`.
- **Injected Context:** Handlers get the live engine through an injected context object rather than importing engine runtime state. Both context types currently expose the raw `GameEngine` instance. **[Planned: P-04]** narrows them to a scoped `EngineContext` interface.
- **Milestone Renown Ledger:** `manifest.renownMilestones` (`RenownMilestoneDefinition[]`) declares per-category, cumulative renown milestones (one-time or repeatable); `manifest.renownTitles` declares title thresholds per category or across the total. `src/engine/renown/renownLedger.ts`'s `recordMilestone(engine, id)` is called at generic engine trigger points (`UncurseAction` on cleansing a curse, `SearchAction` on finding a secret door) — a no-op if no milestone with that ID is defined, the same "engine calls a generic hook, content may or may not react" pattern as `emitDiscovery`. Renown is per-character: it rides entirely on the existing `WorldState.counters`/`flags` (`renown:<category>` counters, `renown_milestone_earned:<id>` flags), which already serialize with the save — no `SaveData` field or migration step was needed. Vendor unlocks need no new predicate type either: `Predicate`'s existing `minCounter` variant, evaluated against a `renown:<category>` counter, already gates a `MerchantConfig`/`Item.predicate`-filtered stock item (see `Merchant.getAvailableStock`, now actually consulted by `ShopOverlay.getBuyableItems` — previously present but unused by the live UI). The active title is surfaced in the character header (`getActiveTitle(engine)`).
- **Tag-Filtered Radial Auras:** `MonsterDefinition.tags?: string[]` (wired through `createScaledMonster`/`Monster.createFromDefinition`) sets tags resolved at runtime via the pre-existing `Entity.tags`/`hasTag()` (which already also matches faction and entity type). `findTaggedEntitiesInRadius` (`src/engine/combat/radialAuraFilter.ts`) is the generic, reusable piece: a bounded-radius (§6-style, no unbounded scans), any-of-`tags` entity query, shared by two call sites — `HookDispatcher`'s `radialAuraFilter` `ActionPrimitive` (applies a nested primitive to every match; item/monster hooks) and `DrinkPotionAction`'s `radial_status` consumable effect (applies a status to every match; potions/deployables). Tag matching is a flat any-of-`tags` list, not a boolean `and`/`or`/`not` expression tree — simpler than originally designed and consistent with how `hasTag()` is already used elsewhere (e.g. `combat.ts`'s damage-affinity bonuses).
- **Companions & Pet Progression (`src/engine/entities/companion.ts`):** `Companion extends Monster`, with `faction: 'player'` so the existing generic `isHostileTo()` already treats it as an ally and hostile monsters as hostile to it — no changes to the hostility system. `manifest.companions` (`CompanionDefinition[]`) declares content-defined companions (stats, speed, pack-mule capacity), registered via `CompanionRegistry`. `GameEngine.summonCompanion()`/`dismissCompanion()` manage the single active companion (at most one at a time); it travels with the player across `changeFloor()` transitions, and persists as a top-level `SaveData.companion` field (schema v9) rather than as part of any one floor's monster list.
  - **Acquisition gate:** `summonCompanion()` refuses until `GameEngine.COMPANION_BONDED_FLAG` (`WorldState` flag) is set. `TrainerService.bondCompanion()` (a trainer-NPC-role `NpcRole`, e.g. town's "Ranvild the Hound-Warden") sets it for a one-time gold cost — a companion is quest/purchase-gated, not available from turn one.
  - **AI-targeting generalization (`ai/targetSelection.ts`):** `selectAttackTarget(engine, actor)` resolves a monster's attack/pathing target, defaulting to `engine.player` — behaviorally identical to the old hardcoded behavior — unless `Monster.targetingMode === 'nearest_hostile'` (`MonsterDefinition.targetingMode`, opt-in per monster, bounded-radius nearest-hostile search). No shipped monster's difficulty changes unless its content definition opts in; only `wolf` does today. This is the prerequisite that lets a companion actually draw aggro and "tank."
  - **Archetypes:** `Companion.archetype` (`'balanced' | 'bodyguard' | 'skirmisher'`) selects one of three `AIStrategy` implementations (`ai/aiRegistry.ts`): `companion_follow` (balanced, follow distance 2 — Phase 1's original behavior), `companion_bodyguard` (follow distance 1, stays tight to the player), `companion_skirmisher` (follow distance 5, proactively paths to a hostile within a 6-tile seek radius even before it's adjacent). `Companion.setArchetype()` switches both the archetype and its backing `aiRoutineId` together; `TrainerService.switchArchetype()` is the paid, trainer-gated entry point.
  - **Death & revival:** a dying companion is intercepted by `DeathResolver` (duck-typed via `companionDefinitionId`, not an `instanceof Companion` check, to avoid a value import into the `entities/monster.ts` circular-import cycle) before the generic `Monster` death pipeline (no XP, loot, or corpse) and kept as `engine.deadCompanionRecord` (session-only, not persisted) rather than discarded. `TrainerService.reviveCompanion()` heals and reattaches the same instance — pack contents intact — for a gold cost. A living companion is explicitly excluded from the floor-monster-count that triggers floor-clear, since it is player-aligned, not a hostile the floor needs cleared of.
  - **Active skills:** `Companion.unlockedSkills: string[]`, taught via `TrainerService.teachSkill()` (paid, trainer-gated) and invoked via the `use_companion_skill` command. One is wired today: `rally_howl` heals the companion and hastes the player.
  - **Inventory transfer:** the companion's own `InventoryManager`/pack accepts items via `transfer_to_companion` (`inventory-overlay.ts`'s `KeyG`, one-directional from that overlay) and `transfer_from_companion` (dispatchable, but has no browsing UI yet into the companion's pack contents). **[Planned: P-14]**
- **Process-Wide Registries:** Manifest registration writes to module-level registries shared by the whole process (`MonsterRegistry`, `StatusHandlerRegistry`, `AiBehaviorRegistry`, `AIRegistry`, `ActionRegistry`, the spell and trap registries, `HookDispatcher` global hooks, and the item container registry). Code that constructs engines with different manifests in one process (for example tests, or two simultaneous campaign runs) must account for this shared state; a second manifest's registrations can silently override or leak into the first engine's lookups. **[Planned: P-22]**
- **No Engine Creep:** Campaign-specific mechanics, items, monsters, quests, and narrative belong in `src/content/`. Change `src/engine/` only to add a *generic, reusable capability* — a primitive, hook point, registry, or manifest field — that content packs then use. Engine code must not gain new campaign-specific names or logic. Some existing engine code is campaign-specific. **[Planned: P-03]**

---

## 4. Action Pipeline & Domain Event Contract
- **Contract of `actionPipeline.ts`:** `ActionPipeline.executeWithHooks(action, engine)` (alias `execute`) returns the `ActionResult` defined in `src/engine/types.ts`:
  ```typescript
  export interface ActionResult {
    success: boolean;                   // Resolution status
    cost: number;                       // Energy cost consumed (0 for rejected actions)
    message?: string;                   // Narrative combat log string
    effects?: VisualEffectDescriptor[]; // Declarative visual effect primitives (projectiles, bursts, flashes)
    pipelineError?: boolean;            // True if an unexpected exception was caught and isolated
  }
  ```
  A typed `events?: GameEvent[]` field is planned. **[Planned: P-07]**
- **Pipeline Coverage:**
  - All player actions, including those issued through `EngineCommandBus`, go through `engine.handlePlayerAction()` -> `executeWithHooks()`.
  - Composite actions may perform sub-actions directly (e.g. a movement bump performs an attack). Sub-actions run inside the outer action's error boundary, and hooks match only the outer action.
  - Monster turns (`Monster.takeTurn` calls `action.perform`) and per-turn environmental updates (status, surface, substance, plane drift, wandering spawns) are invoked directly from `GameEngine`. **[Planned: P-05]**
- **Failure Isolation:**
  - `executeWithHooks()` wraps pre-hooks, `action.perform()`, and post-hooks in try/catch boundaries, inside a top-level boundary, and always returns a valid `ActionResult`: a hook that short-circuits or replaces the result without one, or a `perform()` that returns none, is treated as a failure.
  - A caught exception is recorded with `flightRecorder.recordError`, logged to the narrative log, counted (`caughtExceptionCount`, static `totalCaughtExceptions`), and returned as `{ success: false, cost: 0, message, pipelineError: true }`. A failed player action does not advance the world.
  - Monster turns run inside their own boundary (`GameEngine.processMonsterAction`). An exception from a monster's status ticks, AI, or action is recorded through the same counters (`ActionPipeline.recordIsolatedFailure`, phase `monster-turn`); the monster's turn energy is spent so the scheduler cannot reselect it in a loop; and the enclosing `handlePlayerAction()` result is marked `pipelineError: true`.
  - `HookDispatcher.dispatch` does not catch primitive exceptions; they propagate to the enclosing pipeline or monster-turn boundary, and its re-entrancy depth counter is restored either way.
  - Per-turn environmental updates invoked directly from `handlePlayerAction()` (player status ticks, surfaces, substances, plane drift, wandering spawns, floor respawn, town-return ticks) are not isolated; exceptions there still propagate. **[Planned: P-06]**
  - Current last-resort backstop: `src/main.ts` installs `window` `error`/`unhandledrejection` handlers that record to the flight recorder and show the crash dialog.
- **`pipelineError` Consumption:** After each player action, presentation code (currently `processVisualEffectsAndRender` in `src/main.ts`) checks `engine.lastActionResult.pipelineError` and notifies the player through `DiagnosticModal.showError` without locking game state.
- **Domain Events (`GameEvent`):**
  - **Current:** `GameEvent` in `src/engine/events.ts` is a closed union: `player_leveled_up`, `alignment_renown`, `chaotic_proc`, `uncurse`. Events are emitted with `engine.emitGameEvent()`, buffered in `engine.recentGameEvents`, and delivered through the `engine.onGameEvent` callback that `src/main.ts` wires. Payloads currently hold live `Player`/`Entity`/`Item` references. Treat them as read-only and never persist them.
  - **Target [Planned: P-07]:** state-transition events decoupled from UI/audio (e.g. `damage_dealt`, `entity_killed`, `tile_altered`, `status_applied`, `item_acquired`, `level_transition`); an extensible envelope that lets content packs emit campaign-specific events without editing `events.ts`; scalar-ID payloads; and events also returned on `ActionResult.events`.
- **Presentation Consumption & Animation Gating:**
  - Visual effects from player `ActionResult.effects` and monster turns accumulate in `engine.pendingVisualEffects`.
  - After each player action, `src/main.ts` drains them with `consumePendingVisualEffects()`. Unless `fxRunner.mode` is `'instant'`, it sets `InputHandler.isInputLocked = true` for the whole `fxRunner.playEffects()` run.
  - While locked, gameplay keys (including `ChordBuffer` moves) are ignored. The diagnostics toggle and any open modal still receive input.
  - **Target [Planned: P-08]:** only tactical effects that convey critical information (projectile paths, beam reflections, explosion bursts, chain lightning) lock input. Ambient effects (floating damage numbers, HUD pulses, ledger updates) play through a non-blocking queue. `fxRunner.playQueue()` is currently just an alias for `playEffects()`.

---

## 5. State Normalization, Storage & Schema Evolution
- **Reference Invariant:** Persistent game state contains no live circular object references. Relationships between entities, containers, and items use scalar IDs (`parentId`, `ownerId`).
- **Current State Representation:**
  - **Entities:** `GameMap` keeps a `Map<string, Entity>` keyed by ID, plus spatial indexes (§6).
  - **Tiles:** a dense `TileDefinition[][]` grid indexed `[y][x]`. Dense arrays are the intended representation for per-cell map data.
  - **Ground items:** `Map<string, Item[]>` keyed by plane-qualified coordinate (`planeId:x,y`).
  - **Items in containers:** containers hold `Item[]`. Each item carries scalar `parentId`/`ownerId` (schema v8), resolved at runtime through the module-level container registry (`src/engine/items/containerRegistry.ts`). Saves serialize containers as nested item trees carrying those IDs.
  - A flat ID-keyed item index as the single source of truth for item lookup is planned. **[Planned: P-09]**
- **Seeded PRNG Serialization:**
  - `PRNG` (`src/engine/dungeon/prng.ts`, exported alias `Mulberry32`) keeps a single 32-bit internal state. It is saved as `SaveData.prngState` via `getState()` and restored via `setState()` on load, so the random stream resumes exactly where it stopped.
  - Replay determinism holds only for code that draws from the engine PRNG (§7.2). Existing unseeded code paths break it. **[Planned: P-10]**
- **Persistence Architecture & Storage Tradeoffs:**
  - **`localStorage` Backend:** synchronous default for character saves (`ProfileManager`) and autosaves (`AutosaveManager`, periodic and on floor change). Both live in `src/engine/storage/` and accept a `Storage`-shaped adapter; in the browser, `src/main.ts` supplies `window.localStorage` through `getBrowserStorage()` in `src/ui/platform.ts`. At boot, `src/ui/persistenceInit.ts` requests persistent storage (`navigator.storage.persist()`).
  - **Quota Management:** map tiles and FOV exploration are run-length encoded (`compaction.ts`). A save currently includes every visited floor (`storedMaps`). A single-floor active cache policy to bound payload size is planned. **[Planned: P-11]**
  - **`IndexedDB` Backend:** asynchronous storage tier for large multi-floor dungeon states, bestiary records, and flight-recorder logs that exceed `localStorage` quotas. Not implemented. **[Planned: P-12]**
  - **Native File Export/Import:** `.cotw` file download via `Blob` (`src/ui/platform.ts`), file and drag-and-drop import (`src/ui/saveImporter.ts`), and Base64 save codes (`src/engine/storage/saveTransfer.ts`) provide zero-dependency offline backup, run sharing, and cross-browser transfer.
- **Forward-Only Schema Migrations (`src/engine/storage/migrator.ts`):**
  - Saves are wrapped in a `VersionedSaveEnvelope` (`schemaVersion`, `contentManifestId`, `timestamp`, `data`). `CURRENT_SCHEMA_VERSION` in `migrator.ts` is the authoritative current version. Do not restate its value in this document or elsewhere; read it from `migrator.ts`.
  - `SchemaMigrator.migrate()` applies registered `N -> N+1` steps in sequence. It throws when the payload is unparseable, newer than the engine, missing a step, or a step fails.
  - Every breaking save-format change increments `CURRENT_SCHEMA_VERSION` and registers exactly one new forward-only step. Existing steps are never rewritten except as a confirmed bug fix (§8.1).
- **Load Failure Handling:**
  - **Invariant:** a failed load never yields a partially-loaded engine and never overwrites the stored payload.
  - **Current:** `ProfileManager.loadCharacter()` and `AutosaveManager.loadAutosave()` catch migration and deserialization errors, log them, and return `null`. Callers cannot distinguish a missing save from a corrupt one. Some flows show a status message; the Continue flow silently falls back to the autosave or another profile.
  - **Target [Planned: P-13]:** a typed load result (missing / corrupt / newer-than-engine / migration-failed). Presentation code must notify the player with a modal or toast for every failure other than "missing".

---

## 6. Simulation Scoping & Input Architecture
- **Bounded Simulation Scoping:** Simulating multiple floors at once is prohibited. Visited floors other than the active one are stored (`engine.storedFloors`) and not simulated. Within the active floor, per-actor work is throttled:
  - **Dormant Actor Scheduling:** Every living actor on the active floor stays in `EnergyScheduler` and accrues energy. On a monster's turn, `Monster.takeTurn()` does the following, in order:
    1. Resolves status-effect ticks (`statusManager.tick()`), always, sleeping or not.
    2. Checks paralysis/stun.
    3. Calls `MonsterAI.decideAction()`. Inside it, any pending wind-up and the spell-cooldown decrement resolve first. A monster with `aiState === 'sleeping'` then wakes if it has line of sight to the player within Euclidean distance 8 or stands on a tile visible in the player's FOV. Otherwise it returns a `WaitAction` without pathfinding, item use, or combat resolution.
    - `GameEngine.updateFov()` also wakes sleeping monsters on visible tiles.
    - Companions (§3) never sleep (`aiState: 'hunting'` always) and are registered on `EnergyScheduler` like any other active-floor actor — no new scoping exception to this bounded-simulation model.
  - **Scheduler Partitioning (Evaluated, Not Adopted):** An active/dormant scheduler partition — splitting `EnergyScheduler`'s entity storage into separate active and dormant lists so turn-selection cost no longer depends on the dormant population — was implemented and benchmarked on 2026-09-13.
    - The throughput difference was well below human-perceptible thresholds: sub-millisecond per turn at every tested population up to 500. The "~30 per floor" figure then cited as realistic was not derived from the spawner; `npm run sim` now measures realistic populations from generated floors, and they fall below every population tested, so the conclusion stands.
    - That benchmark sampled each population once and measured only sleeping monsters. `npm run sim` supersedes it for population-anchored, multi-sample measurement and adds an awake-monster floor.
    - The added complexity was judged not worth it: six new call sites had to keep two lists in sync with `aiState`, and one of them desynced and produced a real bug.
    - The change was reverted; `EnergyScheduler` uses a single flat entity list. The one-off benchmark scripts from that evaluation (`run-bench.cjs`, `run-bench-internal.ts`) were removed on 2026-09-15: they could only measure the post-revert single-list scheduler, and `run-bench.cjs` no longer ran. They remain in git history (last committed in `3d71469`). Review project history around 2026-09-13 for the full data before re-attempting.
  - **Bounded FOV Awakenings:** `FovManager` computes visibility with recursive shadowcasting limited to the player's radius (default 8, adjusted by pact modifiers). Monster awakenings and bestiary records are checked only across the bounding box `[minX..maxX, minY..maxY]` of the player's vision. Each update currently resets previously visible tiles to explored by sweeping the whole map. **[Planned: P-15]**
  - **Perception-Radius Override:** any active status whose handler declares `StatusHandler.perceptionRadius` forces `updateFov()`'s radius to that value (the most restrictive wins if several are active) — a generic mechanism, not a hardcoded per-status check. `blindness` and `sensory_masked` both declare `perceptionRadius: 1` today.
  - **Sensory Masking & Echolocation:** the `sensory_masked` status (content-applied, e.g. a Bat Senses Potion) cripples FOV to radius 1 via the override above, and separately lets the renderer detect things beyond it: `getAudibleEntitiesInRadius`/`getAudibleTilesInRadius` (`src/engine/fov/echolocation.ts`, radius `ECHOLOCATION_HEARING_RADIUS` = 6) find non-dormant actors (a sleeping monster makes no noise) and noisy terrain (inherently audible tile types, or an active surface/gas/trap) within a bounded query. `CanvasRenderer.renderEcholocationView()` (`src/rendering/canvas-renderer.ts`) replaces the normal tile/entity pass while the status is active: a blank board, the player's own icon, and only audible actors (reusing the existing ESP-detected pulsing-indicator style) and terrain. The underlying FOV/awakening simulation is unchanged — only what gets drawn changes.
  - **Spatial Bucketing:** Entity lookups use constant-time coordinate bucket maps (`entityBuckets: Map<string, Entity[]>` keyed `"x,y"` in `GameMap`), so proximity and collision checks do not scale with total monster count.
  - **Modal Pause:** Pushing the first modal onto `ModalStackManager` sets `engine.isPaused`, and `advanceWorldUntilPlayerTurn()` does nothing while paused.
- **Input Architecture:** `InputHandler` (`src/rendering/input-handler.ts`) owns the `window` `keydown`/`keyup`/`blur` listeners, the `ModalStackManager`, and the `ChordBuffer`.
- **`ChordBuffer` Mechanics (`src/ui/input/chordBuffer.ts`):**
  - **Sliding-Window Arrow Chording:** When `arrowChordingEnabled` is on (the default), orthogonal arrow keypresses within the micro-debounce window (`arrowChordBufferMs`, default 40ms, clamped to 25–75ms) combine into a diagonal (e.g., Up + Right -> NorthEast). When it is off, arrows move cardinally with no buffering.
  - **Keyup Flush:** Releasing an arrow key before the debounce timer expires, without forming a chord, should immediately dispatch the pending cardinal step. Currently keyup only updates held-key state; the pending step waits for the timer, and `ChordBuffer.flush()` has no production caller. **[Planned: P-16]**
  - **Key-Repeat Bypass:** While an arrow key or an active diagonal chord is held and the browser sends repeat events (`KeyboardEvent.repeat`), the buffer skips the debounce timer and dispatches a move on each repeat.
  - **Opposing Direction Reversal:** Pressing the opposite key while a step is pending (e.g. Left while Right is pending) cancels the pending move and immediately honors the new direction.
  - **Focus Loss:** Window `blur` clears all held-key state.
  - **Multi-Scheme Directional Controls:** Default bindings live in `src/ui/settings/settingsManager.ts`. Only arrow keys go through `ChordBuffer`; the other schemes dispatch immediately:
    1. Arrow keys (chorded or instant cardinal mode).
    2. Roguelike Numpad 1–9: diagonals 7, 9, 1, 3; cardinals 8, 2, 4, 6; center 5 to wait.
    3. Classic Vi keys: HJKL + YUBN.
    4. WASD (cardinal directions).
- **Configurable Radial Action Menu (`src/rendering/radialMenu.ts`):** a hold-to-open canvas overlay bound to the configurable `radial_menu` action (default `KeyV`, remappable through the same `SettingsManager`/`ACTION_METADATA` keybind system as every other action). While held, the same directional-key vocabulary above (arrows/WASD/vi/numpad) selects one of 8 compass wedges instead of moving; releasing the trigger key confirms the hovered wedge, `Escape` cancels. Slots (`SettingsManager.radialMenuSlots`, keyed by the fixed 8-direction order) are `{ type: 'spell' }`, `{ type: 'command' }` (dispatched via `CommandPalette.getCommand`), or `{ type: 'item' }` (a potion or self-targeted scroll resolved via `InventoryManager.findItemById` — aimed items that need a target reticle, like wands, are not a fit for direct radial activation). It registers on `ModalStackManager` like other overlays. Gamepad invocation is not implemented and is deliberately out of scope. **[Deferred: P-24]**
- **Focus & Modal Isolation:**
  - **Rule:** every open modal registers on the LIFO `ModalStackManager` (`src/ui/modalStack.ts`).
  - **Stack behavior:** the top modal receives all keystrokes. If it does not handle `Escape`, the stack pops it. All other keys are trapped so they never reach the simulation. Modal handlers call `event.preventDefault()` for keys they consume, which prevents browser shortcut conflicts.
  - **Registered today:** inventory, targeting, spellbook, diagnostics, level-up, pacts (keyboard path), context help, compendium, and the radial menu.
  - **Not registered, gated by `InputHandler.enabled`:** Dwarven Winch, town-return, choice, save & quit, settings/keybinds, save-code, and pacts opened by click. **[Planned: P-17]**
  - **Not registered, intercepted inline by `InputHandler`:** the shop, map, and inspect overlays. `InputHandler` checks each one's `isOpen` before dispatching other keys, so they neither register on the stack nor toggle `enabled`. **[Planned: P-17]**
  - **Outside the in-game stack:** the save-slot and saga-share modals belong to the main-menu and game-over screens, where no simulation input is active.

---

## 7. Build Configuration & Automated Quality Gates

### 7.1 Single-File Bundling Architecture
- The build uses Vite with `vite-plugin-singlefile`.
- `assetsInlineLimit: 100000000` (100MB) inlines all spritesheets, audio, fonts, and stylesheets; `cssCodeSplit: false`; `rollupOptions.output.inlineDynamicImports: true`.
- A post-build plugin converts module scripts to classic scripts so bundles run offline under `file://` without CORS errors.

### 7.2 Automated Quality Gates
- **Requirement:** every change must pass the gates below before merging. Coding agents run the relevant gates locally and report real output.
- **Current CI:**
  - `.github/workflows/ci.yml` (*Quality Gates*) runs on every pull request to `main` and on manual dispatch: `npm run lint`, `npm test`, `npm run sim`, `npm run validate:schema`, then `npm run build:all`.
  - `.github/workflows/deploy.yml` runs the same gates on push to `main` (and manual dispatch), then deploys `dist/` to GitHub Pages.
  - `.github/workflows/playwright.yml` runs on pushes and pull requests to `main`: it builds the bundle and runs the Playwright smoke suite in `e2e/`.
- **Local pre-commit hook:** `.githooks/pre-commit` runs the fast gates — `npm run lint` and `npm test` — before every commit. The `prepare` npm script points git at it (`git config core.hooksPath .githooks`), so `npm install` wires it up; `SKIP_HOOKS=1` bypasses it deliberately. The slower gates (`npm run sim`, `npm run validate:schema`, `npm run build:all`) run in CI rather than on every commit.
- `.gitattributes` pins LF endings for `.githooks/**` and `*.sh`, because a CRLF `#!/bin/sh` line breaks the hook under `sh`.
- The Playwright smoke suite asserts the built `dist/index.html` boots to the main menu over `file://` with no uncaught errors, in Chromium, Firefox, and WebKit.

1. **Architectural Purity & Boundaries (`npm run check:engine-purity`, `scripts/check-engine-purity.ts`):**
   - Scans every `.ts` file under `src/engine/`, `src/content/`, `src/ui/`, and `src/rendering/`. Content source files are checked for DOM tokens regardless of whether they are registered as hooks, because file location never exempts simulation code (§2).
   - **DOM and browser tokens:** fails on `window.`, `document.`, `navigator.`, `localStorage`, `sessionStorage`, `HTMLElement`, `CanvasRenderingContext2D`, `HTMLCanvasElement`, or `ImageData` in engine and content source files (test and fixture files are exempt).
   - **Reverse imports:** fails on any `src/ui/` or `src/rendering/` import in `src/engine/` (tests included), and on `src/content/` imports in engine production source.
   - **Content isolation:** fails on `src/ui/` or `src/rendering/` imports in content source.
   - **Public API:** fails on any `engine/<path>` deep import in `src/ui/` or `src/rendering/` (tests included) or in `src/main.ts`, and on content imports in UI/rendering source. `src/main.ts` is checked for deep engine imports only — as the composition root it is the one module allowed to import content packs.
   - **Timing and audio globals:** fails on `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `requestAnimationFrame`, `cancelAnimationFrame`, `requestIdleCallback`, `performance.now`, `AudioContext`, `webkitAudioContext`, `HTMLAudioElement`, or `new Audio` in engine and content source files, on the same execution-path rule as DOM tokens (§2).
   - The success line reports how many engine and content **source** files were scanned and how many test/fixture files were exempt, rather than counting exempt files as covered.
   - Planned extensions: deep engine imports from content, and a `Math.random` check for simulation code. **[Planned: P-19]**
   - **Engine encapsulation (`npm run check:engine-encapsulation`, `scripts/check-engine-encapsulation.ts`):** complements the import checks by checking *mutation*. It uses the TypeScript type checker, so a write is matched by the declaring class of the member written, not by variable name.
     - In `src/ui/`, `src/rendering/`, `src/main.ts`, and `src/content/` (tests exempt), it fails on assignment, compound assignment, `++`/`--`, `delete`, or index writes to an engine class member; on writes through an `as any` cast of an engine object; and on `Object.assign` onto one.
     - In presentation code it also fails on mutator-named calls into internal engine subsystems (`GameMap`, `Container`, `InventoryManager`, `StatusManager`, `EnergyScheduler`, and similar) and on Array/Map/Set mutator calls against engine members. `GameEngine`, `Player`, and `Entity` methods and `engine.commandBus` are the sanctioned paths.
     - Sanctioned writes (composition-root wiring of `engine.on*` callback slots; content AI strategies publishing `Monster.intent`) are listed with reasons in `scripts/engine-encapsulation-allowlist.json`. A stale allowlist entry also fails the check.
     - Not traced: writes through a local alias of a member's value (e.g. `const qs = player.quickSpells; qs[0] = x`).
2. **Determinism & PRNG Discipline:**
   - All simulation randomness — dice, loot drops, spawns, combat rolls, AI choices, hook chance rolls, and generated entity/item IDs — must come from the engine's seeded PRNG.
   - `engine.prng` is the canonical accessor. `engine.rng` is an existing bound delegate (`() => engine.prng.next()`) for APIs that take a `() => number`. Do not introduce further aliases.
   - Simulation code must not use `Math.random()` or wall-clock time (`Date.now()`) to determine outcomes or IDs. Functions that accept an `rng` parameter must receive a seeded source from simulation callers.
   - The codebase does not yet satisfy this rule, and no automated check exists yet. **[Planned: P-10]**, **[Planned: P-19]**
3. **Schema Evolution Integrity (`npm run validate:schema`, `scripts/validate-schema.ts`):**
   - Migrates a minimal v1 envelope to `CURRENT_SCHEMA_VERSION` and asserts the final version.
   - Round-trips a live engine through `serializeGame` -> `JSON.stringify`/`JSON.parse` -> `deserializeGame`, asserting that surface cells (type, duration, potency), substance bitmasks, ground corpse items (class, archetype, decay counter), and PRNG state all survive. JSON is in the loop because saves persist as strings, so a value that cannot round-trip through JSON is as lost as one the serializer drops.
   - `PRNG.getState()` returns the raw internal state while `setState()` coerces to int32, so a restored generator reports an equivalent but differently-encoded state. The validator compares int32-normalized states and separately asserts the next draw matches.
   - Per-step migration assertions live in `src/engine/storage/__tests__/migrator.test.ts` (run by `npm test`).
4. **Headless Simulation (`npm run sim`, `scripts/headless-sim.ts`):**
   - **Population anchor:** generates CotW floors through `DungeonArc.generateFloor` across several floors, repeated generations, and the base and pact-boosted monster densities, then derives its data points from the measured counts (realistic median, realistic high, and a labeled stress multiple) instead of a hard-coded population. Monster placement still uses `Math.random` (P-10), so counts are sampled, not seeded.
   - **Scenarios:** a dormant floor (player moves; sleeping monsters outside FOV), an awake floor (hunting monsters path to and attack an invulnerable player), and a 1,000-cast spell workload. After a global JIT warmup, each data point runs a warmup plus repeated samples and reports median and max.
   - **Fails on:** any rejected action, any caught pipeline exception (including isolated monster-turn failures), or a wall-clock budget exceeded by a median at realistic populations. Wall-clock budgets live here, not in `npm test`. `--inject-error` demonstrates the failure path.
   - The long-running chaos/monkey simulation (random actions, save/reload cycles, invariant, deadlock, and NaN assertions) is `src/engine/__tests__/chaosSimulation.test.ts`, run by `npm test`.
   - **Invariant, NaN, and deadlock assertions:** at 100-turn checkpoints and once at scenario end, the sim asserts that player and entity scalars (hp, mana, position, energy, speed, carried weight, `turnCount`) are finite, that speeds are positive, that entities stay in bounds with unique ids, and that a living player has positive HP. A deadlock watch runs every turn: a successful player action that does not advance `turnCount` six times running is reported as a deadlock. Checkpoint scans are timed and subtracted from the scenario's elapsed time, so they never inflate the wall-clock budgets above.
   - Run lengths and results are whatever the latest output reports; this document intentionally does not restate them.
5. **Static Analysis & Build Verification (`npm test`, `npm run lint`, `npm run build`):**
   - `npm test`: runs all Vitest suites (`src/**/__tests__/` and `tests/`). Suite and test counts are whatever the run reports; this document intentionally does not restate them.
   - `npm run lint`: `tsc --noEmit` over the `tsconfig.json` `include` set (`src`, `tests`, `scripts`, `vite.config.ts`), then `npm run check:engine-purity` and `npm run check:engine-encapsulation`.
   - `npm run build`: `tsc && vite build`, verifying single-file production compilation (cotw theme) without type errors or bundler warnings. Use `npm run build:all` when changing `vite.config.ts`, theme selection, or manifest wiring.

---

## 8. Change Control

### 8.1 Protected Files
`src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts`, and `src/engine/storage/migrator.ts` may be modified only when one of these exceptions applies:
1. **Confirmed bug fix:** a reproducible defect, demonstrated by a failing test or a documented reproduction.
2. **Additive schema migration:** adding a new forward-only step and incrementing `CURRENT_SCHEMA_VERSION` (§5). Existing steps are changed only under exception 1.
3. **Requested planned item:** implementing a Planned Work item (§9) that the task explicitly requests.

Keep such diffs minimal and scoped, and state which exception applies in the change summary.

### 8.2 Documentation Synchronization
- `ARCHITECTURE.md` is authoritative. `.antigravity/rules.md`, `CLAUDE.md`, and the files under `.antigravity/skills/` and `.antigravity/archetypes/` summarize or apply it and must not contradict it. If they disagree, stop and flag the conflict to the user instead of picking a side.
- When a change makes an unmarked statement in this document untrue, update this document in the same change.
- When a change completes a planned item, remove its **[Planned]** tags, make the affected text describe the new current state, and delete the item from §9.

### 8.3 Working With Planned Items
- Do not write code that depends on a planned capability existing.
- Implement a planned item only when the task explicitly requests it (by ID or unambiguous scope).
- New work must not widen the gap to a planned target. For example: no new deep engine imports from content, no new `Math.random()` in simulation code, and no new modals that bypass `ModalStackManager`.

---

## 9. Planned Work Register
Each entry records the current state, the target, and whether the work is expected to touch protected files (§8.1). Work that is recorded but deliberately out of scope is listed under *Deferred* at the end of this section, and is not planned work.

**P-02 — Content packs use the engine barrel only** (§2, §3)
- Current: content files deep-import engine internals, including runtime values (`warcraft/ai.ts` action classes and `findPath`; `ItemFactory`, `Merchant`, `MonsterRegistry` in the cotw and warcraft `monsters.ts`/`town.ts`). Some needed types are not exported from the barrel (e.g. `VaultBlueprint` from `dungeon/vaultStamp.ts`).
- Target: every content import resolves through `src/engine/index.ts`, with the barrel exporting what content needs.
- Protected files: no.

**P-03 — Extract campaign-specific mechanics from the engine** (§1, §3)
- Current: the engine contains campaign-flavored logic, e.g. town-return fixtures in `src/engine/townReturn/` (Dwarven Winch, Valkyrie Sprint, Runic Conduit), named monster abilities in `ai/behaviorTree.ts`, and theme-specific tile types.
- Target: the engine provides generic primitives; campaign specifics live in content packs.
- Status: unscoped. Requires a design pass before implementation.
- Protected files: likely `engine.ts`.

**P-04 — Scoped `EngineContext` for handlers** (§3)
- Current: `ActionHookContext` and `HookContext` expose the raw `GameEngine`.
- Target: one narrower `EngineContext` interface exposing a scoped query/mutation surface.
- Protected files: `actionPipeline.ts`.

**P-05 — All actor actions and environmental reactions use the pipeline** (§2, §4)
- Current: only player actions use `executeWithHooks()`. Monster actions call `perform()` directly, and environmental updates are called directly from `GameEngine`.
- Target: monster actions (and environmental reactions where meaningful) execute through the pipeline, so action hooks fire for every actor.
- Protected files: `engine.ts`, possibly `actionPipeline.ts`.

**P-06 — Failure isolation for environmental updates** (§4)
- Current: player actions (`executeWithHooks()`) and monster turns (`GameEngine.processMonsterAction`) are isolated. Per-turn environmental updates called directly from `handlePlayerAction()` (player status ticks, surfaces, substances, plane drift, wandering spawns, floor respawn, town-return ticks) are not; an exception there propagates.
- Target: no exception escapes a turn. Environmental-update failures are isolated through `ActionPipeline.recordIsolatedFailure`, recorded to the flight recorder, and surfaced as `pipelineError`.
- Protected files: `engine.ts`.

**P-07 — Extensible, serializable domain events** (§4)
- Current: closed four-member `GameEvent` union with live-reference payloads, delivered only via `onGameEvent`.
- Target: state-transition events, an envelope that content packs can extend, scalar-ID payloads, and `ActionResult.events`.
- Protected files: `engine.ts`, possibly `actionPipeline.ts`.

**P-08 — Tactical vs. ambient effect queues** (§4)
- Current: every pending effect locks input for the whole playback; `playQueue()` is an alias for `playEffects()`.
- Target: only tactical effects lock input; ambient effects play through a non-blocking queue.
- Protected files: no.

**P-09 — Flat item index** (§5)
- Current: items live in per-container arrays with scalar parent/owner IDs.
- Target: a flat ID-keyed item index as the single source of truth for item lookup.
- Protected files: `migrator.ts` if the save format changes (exception 2).

**P-10 — Seeded determinism across simulation code** (§5, §7.2)
- Current: unseeded randomness and wall-clock IDs exist on simulation paths. Examples:
  - floor population and loot in `quest/dungeonArc.ts`, via `Math.random` defaults in `dungeon/spawner.ts` and `dungeon/lootSpawner.ts`
  - `Math.random` default parameters in `items/modifierRoller.ts` and `actions/search.ts`
  - `SearchAction` constructed with `Math.random` in `rendering/input-handler.ts` and `main.ts`
  - `warcraft/hooks.ts`, `warcraft/ai.ts`, and gold-drop generators in both packs' `monsters.ts`
  - `townReturn/runicConduit.ts` and `townReturn/valkyrieSprint.ts`
  - `engine ? engine.rng() : Math.random()` fallbacks
  - `Date.now()`-based IDs in item, loot, corpse, and vault code
- Target: §7.2 rule fully satisfied.
- Protected files: no, unless the engine PRNG accessors change.

**P-11 — Single-floor active cache policy** (§5)
- Current: saves include every visited floor.
- Target: a bounded payload policy for inactive floors, coordinated with P-12.
- Protected files: `migrator.ts` if the save format changes.

**P-12 — IndexedDB storage tier** (§5)
- Current: `localStorage` only.
- Target: an asynchronous IndexedDB backend for large multi-floor states, bestiary records, and flight-recorder logs.
- Protected files: no.

**P-13 — Typed load failures and player notification** (§5)
- Current: load failures return `null` and are sometimes silent.
- Target: a typed failure result, with presentation code notifying the player for every non-missing failure.
- Protected files: no.

**P-14 — Companion-pack browsing UI** (§3)
- Current: Companions & Pet Progression (§3) is otherwise complete: AI-targeting generalization, acquisition gating, archetypes, death/revival, and active skills all ship. Item transfer is one-directional from the player's side only — `inventory-overlay.ts`'s `KeyG` sends an item to the companion's pack (`transfer_to_companion`), and `transfer_from_companion` exists on the command bus, but no UI browses the companion's pack contents to select an item to take back.
- Target: extend `inventory-overlay.ts` (or a dedicated companion-pack view) to list the companion's pack contents and dispatch `transfer_from_companion` for a selected item.
- Protected files: no.

**P-15 — Bounded FOV fog-of-war update** (§6)
- Current: `FovManager.update()` sweeps the whole map to demote visible tiles.
- Target: demote only previously visible tiles.
- Protected files: no.

**P-16 — ChordBuffer keyup flush** (§6)
- Current: keyup does not flush a pending unchorded step.
- Target: releasing the key dispatches the pending cardinal step immediately.
- Protected files: no.

**P-17 — All modals on `ModalStackManager`** (§6)
- Current: Dwarven Winch, town-return, choice, save & quit, settings/keybinds, save-code, and click-opened pact modals toggle `InputHandler.enabled` instead. The shop, map, and inspect overlays neither register nor toggle it — `InputHandler` intercepts their keys inline (§6).
- Target: every modal registers on the stack.
- Protected files: no.

**P-19 — Boundary and static-check extensions** (§2, §7.2)
- Current: the purity checker misses content deep imports and `Math.random` in simulation code. Timing/audio globals are checked, the success line reports scanned-vs-exempt file counts accurately, and `scripts/` is type-checked (§7.2 items 1 and 5).
- Target: content deep imports and `Math.random` are checked too. The `Math.random` check depends on P-10, and the content deep-import check on P-02: enabling either before those land would fail CI on pre-existing violations.
- Protected files: no.

**P-22 — Per-engine content registries** (§3)
- Current: manifest registration (monsters, status handlers, AI behaviors/strategies, action commands, spells, traps, global hooks, item containers) writes to module-level registries shared by the whole process. Constructing two engines with different manifests in one process — concurrent campaign runs, or tests that don't isolate state — risks one manifest's registrations overriding or leaking into the other engine's lookups.
- Target: registrations are scoped per `GameEngine` instance (instance-owned registries, or a registry keyed by engine/manifest identity), so multiple engines with different content packs can coexist safely in one process.
- Status: unscoped. Requires a design pass — likely touches every registry class and their call sites in the `GameEngine` constructor.
- Protected files: `engine.ts`.

### Deferred (out of scope)
Entries here are recorded, not planned: no work is scheduled and none has been attempted. They keep their reserved IDs so numbering stays stable (§0). A deferred item is not a **[Planned]** item — do not pick one up as planned work; moving one back into the active register above is an explicit decision.

**P-24 — Configurable Radial Action Menu: gamepad invocation** (§6) — **Deferred 2026-09-15**
- Current: the radial menu itself is implemented (`src/rendering/radialMenu.ts`) — keyboard hold-to-open, directional wedge selection, spell/command/item slots. See §6 for the current-state description. Gamepad invocation is not implemented; `navigator.getGamepads()` is not referenced anywhere in `src/`.
- Reason: gamepad and controller support is intentionally out of scope until the game is feature-complete. It may be reconsidered afterwards.
- Not the same as *Evaluated, Not Adopted* (§6, Scheduler Partitioning): that design was built, benchmarked, and rejected on evidence. P-24 was never attempted, so deferral is a scheduling decision, not a verdict on the design.
- If revisited: gamepad button-hold opens the menu and stick angle selects a wedge, confined to `src/rendering/` (never on the simulation execution path, so it doesn't affect headless purity, §2). Protected files: none.
