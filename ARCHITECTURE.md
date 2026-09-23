# Architectural Specification & Engine Invariants

> **AI Context Instruction:** Authoritative architecture spec, kept small enough to read in full every session before any structural change (new files, new cross-layer dependencies, edits to protected files). Prioritize these rules over general patterns. `docs/architecture/**` holds explanatory sub-docs; `docs/decisions/**` holds ADRs for rejected/superseded designs. Every **binding** statement lives here, never only in a sub-doc — reading only this file is fully compliant, just less informed on *why*. Consult a sub-doc per the table below, or for the reasoning.
>
> **Status:** unmarked = current fact/invariant. **[Planned: P-NN]** = not yet built (§9) — never assume it exists; implement only if explicitly requested (§8.3). **[Deferred: P-NN]** = recorded, out of scope, no schedule. Section numbers are stable and cited by agent config files — do not renumber.

### Routing Table — What Else To Read
| Touches... | Also read |
|---|---|
| `src/content/` (packs, manifests, hooks, registries) | [content-extensibility.md](docs/architecture/content-extensibility.md) |
| `src/engine/storage/` (saves, migrations, persistence) | [storage-and-schema.md](docs/architecture/storage-and-schema.md) |
| Scheduler, FOV, input-handler, `chordBuffer.ts`, `modalStack.ts`, modals | [simulation-and-input.md](docs/architecture/simulation-and-input.md) |
| `scripts/check-*.ts`, CI, `.githooks/` | [quality-gates.md](docs/architecture/quality-gates.md) |
| A §8.1 protected file | §8.1 below only |
| Redoing a past design | [docs/decisions/](docs/decisions/) — check it wasn't already rejected |

---

## 1. Game Concept & Core Simulation Loops
- **Vision & Genre:** A turn-based, grid-based dungeon crawler and roguelike inspired by *Castle of the Winds*, built from modular systems that support variable narrative campaigns and thematic content packs. Shipping packs: `src/content/cotw/` (*Castle of the Winds*) and `src/content/warcraft/` (*WarCraft*). Future packs (e.g. *The Old Kingdom*) must be addable without engine changes beyond generic capabilities (§3, No Engine Creep).
- **Core Gameplay Loop:** Headless turn execution -> actor intent dispatch -> spatial calculation & collision resolution -> tactical bump combat / spellcasting / inventory management -> status & environmental propagation -> floor progression / level transitions.
- **Target Aesthetic:** Clean, retro tile-blitted presentation rendered via Canvas texture atlases, coupled with responsive modal dialogs, sliding-window chorded keyboard controls, and tactile visual effect feedback.

---

## 2. System Boundaries & Tech Stack Invariants
- **Language & Build Target:** TypeScript with Vite and `vite-plugin-singlefile` (`assetsInlineLimit: 100000000` (100MB), `cssCodeSplit: false`), compiling into offline-capable, zero-dependency, self-contained single-file HTML distributions.
- **Release Strategy:** One single-file bundle per content pack, selected at build time by Vite mode (or `THEME` env var), exposed as `import.meta.env.VITE_THEME`:
  - `npm run build:cotw` (and plain `npm run build`, cotw default) -> `dist/index.html` + identical `dist/cotw.html`. `npm run build:warcraft` -> `dist/warcraft.html`. `npm run build:all` builds both.
  - `emptyOutDir` is `false`, so bundles from earlier builds remain in `dist/`.
  - A post-build plugin rewrites `<script type="module" crossorigin>` to classic `<script>`, so bundles run under `file://` without CORS errors.
- **Execution-Path Headless Simulation Purity:** purity is defined by *execution path*, not file location. Any function/handler/hook/callback running inside the simulation — in `src/engine/`, `src/content/`, or registered at runtime — must not touch DOM globals (`window`, `document`, `HTMLElement`), Canvas contexts, audio APIs, or timing globals (`requestAnimationFrame`, `setTimeout`). Outcomes must also be deterministic (§7.2).
- **Public API Surface Integrity:** `src/ui/`, `src/rendering/`, and `src/content/` import the engine only through `src/engine/index.ts` — deep imports into engine internals are barred. Enforced by `check:engine-purity` for all three (content's test files may still deep-import). `scripts/` and test files may deep-import engine internals generally.
- **Diagnostic API Namespacing & Triage Access:** triage/inspection methods (`spawnMonster`, `spawnItem`, `toggleGodMode`, `revealFloorMap`) are namespaced under `engine.diagnostics`. The `[F2]`/backtick triage menu is a deliberate, always-reachable player feature, not gated behind a build flag; `InputHandler` checks the toggle before the input lock, so it works during effect playback.
- **Deterministic Action Pipeline:** player actions flow through `ActionPipeline.executeWithHooks()` (`src/engine/actions/actionPipeline.ts`) and return a typed `ActionResult` (§4); monster actions flow through the same call, so hooks and the failure boundary apply to every actor. Per-turn environmental updates are not actions and are invoked directly (§4).
- **Bounded Simulation Scoping:** only the active floor is simulated. Per-actor expensive work (AI, pathfinding, combat, awakening/bestiary checks) is limited to the player's vicinity via dormant-actor short-circuiting and bounded FOV (§6); `EnergyScheduler` turn selection deliberately stays linear in the active floor's actor count.

---

## 3. Directory Layout, Module Topology & Dependency Inversion

| Layer / Directory | Primary Responsibility | Dependency & Import Rules |
| :--- | :--- | :--- |
| `src/main.ts` | **Composition Root.** Selects manifest/theme from `VITE_THEME`; creates presentation components; obtains `GameEngine` instances (`ProfileManager`, `AutosaveManager`); wires engine callbacks; mounts DOM listeners. | The **only** source module, anywhere — including `src/main/` below — that imports content packs. May import every layer. Engine imports resolve through `src/engine/index.ts`; `check:engine-purity` enforces this. |
| `src/main/` | Composition-root helpers extracted from `src/main.ts` — today, `commandCatalog.ts` (pure data, zero closures). `execute` callbacks stay in `src/main.ts`, which owns the mutable session state they close over. | Same rules as `src/ui/`/`src/rendering/` (presentation scope) — **may not** import `src/content/`; only `src/main.ts` keeps that privilege. Enforced by `check:engine-purity`/`check:engine-encapsulation` (§7.2). |
| `src/content/` | Campaign content packs: item/monster catalogs, spells, status effects, encounter tables, vaults, towns, quest arcs, themes, scripted behaviors. | Imports the engine (types and runtime values) only through `src/engine/index.ts`; `check:engine-purity` enforces this. Never imports `src/ui/`/`src/rendering/`. Reaches the engine only through `GameContentManifest` (Content Extensibility Model, above). |
| `src/engine/` | Headless state coordinator, action pipeline, spatial grid, FOV, scheduler, AI behavior trees, storage/serialization, PRNG. | Zero browser/DOM/Canvas deps. Public API via `src/engine/index.ts`. **Zero** imports from `src/content/`/`src/ui/`/`src/rendering/`. Colocated engine tests may import content as fixtures only. |
| `src/rendering/` | Canvas atlases, sprite blitting, camera, overlays, effect playback (`fxRunner.ts`), keyboard dispatch (`input-handler.ts`). | Engine via `src/engine/index.ts` only. May import `src/ui/`. Never `src/content/`. |
| `src/ui/` | DOM HUD, LIFO modal stack (`modalStack.ts`), chorded input buffer (`input/chordBuffer.ts`), settings/keybindings, diagnostics. | Engine via `src/engine/index.ts` only. May import `src/rendering/` **types only**. Never `src/content/`. |
| `scripts/` | Headless verification tooling, purity auditor, sim benchmark, schema validator. | Dev automation only; may deep-import engine. Not bundled. |
| `tests/` | Top-level Vitest suites; most colocated in `src/**/__tests__/`. | Testing harness only. Not bundled. |
| `e2e/` | Playwright smoke tests loading built `dist/index.html` over `file://`; needs `npm run build` first. | Testing harness only. Not bundled; excluded from Vitest. |

### Module Import Hierarchy
```
                              src/main.ts  (Composition Root: may import every layer)
                                   │
                 ┌─────────────────┴──────────────────┐
                 ▼                                    ▼
┌─────────────────────────────────┐          ┌──────────────────┐
│   Presentation tier (+main/)    │          │   src/content/   │
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
- At runtime, content reaches the engine only as data/callbacks inside `GameContentManifest`, passed to the `GameEngine` constructor on create/load.
- `src/main/` is presentation tier for imports — it does **not** carry `src/main.ts`'s content-pack privilege.

### Content Extensibility Model
*Details: [content-extensibility.md](docs/architecture/content-extensibility.md).*

**Binding rules:**
- **Declarative Manifests:** each content pack exports a `GameContentManifest` (`src/engine/types/manifest.ts`); the `GameEngine` constructor registers its entries. Content assembles behavior from composable primitives — no bespoke engine code (No Engine Creep, below).
- **Exactly two hook mechanisms:** (1) **Action hooks** (`manifest.actionHooks`, `ActionHook` in `actionPipeline.ts`) — priority-ordered `pre`/`post` hooks around pipeline-executed actions, `ActionHookContext`; a pre-hook can short-circuit with its own `ActionResult`. (2) **Declarative event hooks** (`HookDispatcher`, `src/engine/hooks/hookDispatcher.ts`) — `HookDescriptor` data attached to items/monsters or global, `HookContext`; new primitives register via `HookDispatcher.registerPrimitive`.
- **Injected context, never the raw engine:** handlers receive `EngineContext` (`src/engine/types/engineContext.ts`), not `GameEngine` itself. Widening it is deliberate, one member at a time — each addition becomes part of the content-facing contract.
- **No Engine Creep:** campaign-specific mechanics, items, monsters, quests, and narrative belong in `src/content/`. Change `src/engine/` only to add a *generic, reusable capability* that content packs then use. Engine code must not gain new campaign-specific names or logic.

---

## 4. Action Pipeline & Domain Event Contract
- **Contract of `actionPipeline.ts`:** `ActionPipeline.executeWithHooks(action, engine)` (alias `execute`) returns the `ActionResult` defined in `src/engine/types.ts`:
  ```typescript
  export interface ActionResult {
    success: boolean;                   // Resolution status
    cost: number;                       // Energy cost consumed (0 for rejected actions)
    message?: string;                   // Narrative combat log string
    effects?: VisualEffectDescriptor[]; // Declarative visual effect primitives (projectiles, bursts, flashes)
    events?: GameEvent[];              // Domain events emitted while the action ran (scalar payloads)
    pipelineError?: boolean;            // True if an unexpected exception was caught and isolated
  }
  ```
  `events` carries the domain events the action emitted, in order.
- **Pipeline Coverage:**
  - All player actions, including those issued through `EngineCommandBus`, go through `engine.handlePlayerAction()` -> `executeWithHooks()`.
  - Composite actions may perform sub-actions directly (e.g. a movement bump performs an attack); sub-actions run inside the outer action's error boundary, and hooks match only the outer action.
  - Monster turns run their AI-chosen action through `executeWithHooks()` too, so hooks fire for every actor. A monster action a pre-hook short-circuits, or that fails, falls back to `WaitAction` so the scheduler cannot reselect it in a loop.
  - Per-turn environmental updates (status, surface, substance, plane drift, wandering spawns) stay outside the pipeline deliberately — they aren't `Action` objects and have no actor. Each runs inside its own failure boundary instead (Failure Isolation, below).
- **Failure Isolation:**
  - `executeWithHooks()` wraps pre-hooks, `action.perform()`, and post-hooks in try/catch inside a top-level boundary, and always returns a valid `ActionResult`: a hook or `perform()` that produces none is treated as a failure.
  - A caught exception is recorded (`flightRecorder.recordError`, logged, counted via `caughtExceptionCount`/`totalCaughtExceptions`) and returned as `{ success: false, cost: 0, message, pipelineError: true }`. A failed player action does not advance the world.
  - Monster turns run inside their own boundary (`GameEngine.processMonsterAction`); an exception is recorded through the same counters (`recordIsolatedFailure`, phase `monster-turn`), the monster's turn energy is spent so the scheduler can't reselect it, and the enclosing result is marked `pipelineError: true`.
  - `HookDispatcher.dispatch` does not catch primitive exceptions; they propagate to the enclosing boundary, and its re-entrancy depth counter is restored either way.
  - Per-turn environmental updates each run through `GameEngine.runEnvironmentalUpdate`, which catches, records (`recordIsolatedFailure`, phase `environmental-update`), and continues with the rest — a throwing surface tick must not skip substances, spawns, or the town-return timer.
  - No exception now escapes a turn: player actions, monster turns, and environmental updates are each isolated. Last-resort backstop: `src/main.ts` installs `window` `error`/`unhandledrejection` handlers that record to the flight recorder and show the crash dialog.
- **`pipelineError` Consumption:** after each player action, presentation code (`processVisualEffectsAndRender` in `src/main.ts`) checks `engine.lastActionResult.pipelineError` and notifies via `DiagnosticModal.showError` without locking game state.
- **Domain Events (`GameEvent`):**
  - **Envelope:** every event extends `GameEventBase` — `type`, `turn`, optional `actorId`/`targetId`/`itemId`, and a flat scalar `data` bag. `type` is a plain string, so content packs emit their own (e.g. `cotw:relic_attuned`) without editing `events.ts`; `BuiltInGameEventType` lists the engine's own.
  - **Scalar payloads:** events carry IDs and numbers, never live `Player`/`Entity`/`Item` references — a live reference can't be serialized, so every event survives `JSON.stringify`.
  - **Built-ins:** `player_leveled_up`, `alignment_renown`, `chaotic_proc`, `uncurse`, `damage_dealt`, `entity_killed`, `level_transition`.
  - **Delivery:** `engine.emitGameEvent()` buffers into `engine.recentGameEvents`, delivers via `engine.onGameEvent`, and returns on `ActionResult.events`. `ActionPipeline` keeps a capture stack so a composite action's sub-actions attribute correctly.
  - **Narrowing:** `isGameEvent(event, 'entity_killed')` narrows the open `type` union to a built-in.
- **Presentation Consumption & Animation Gating:**
  - Visual effects from `ActionResult.effects` and monster turns accumulate in `engine.pendingVisualEffects`; `main.ts` drains them each player action via `consumePendingVisualEffects()`/`fxRunner.playQueue()`, which splits by priority.
  - **Tactical effects gate input; ambient effects do not.** `isTacticalEffect` (`src/engine/types/effects.ts`) classifies positional cues the player needs before acting (projectile paths, beam reflections, bursts, chain lightning) as tactical; screen pulses and similar are ambient. `priority` can override either way.
  - Ambient effects skip the runner's track queue (never join the promise chain `playEffects` resolves). `main.ts` sets `InputHandler.isInputLocked` only when the batch contains a tactical effect, so a screen flash never blocks the next keypress.
  - While locked, gameplay keys (including `ChordBuffer` moves) are ignored; the diagnostics toggle and any open modal still receive input.

---

## 5. State Normalization, Storage & Schema Evolution
*Details: [storage-and-schema.md](docs/architecture/storage-and-schema.md). History: [ADR-0002](docs/decisions/0002-v0-v11-migration-chain-deletion.md).*

**Binding rules:**
- **Reference Invariant:** persistent state has no live circular object references — relationships use scalar IDs (`parentId`, `ownerId`).
- **Forward-Only Schema Migrations (`migrator.ts`, §8.1 protected):** `CURRENT_SCHEMA_VERSION` there is authoritative. Every breaking save-format change increments it and adds exactly one forward-only `N -> N+1` step; existing steps are rewritten only as a confirmed bug fix (§8.1).
- **Version floor:** the current version is also the oldest readable one — a save below it is refused (`migration-failed`), never silently mis-decoded.
- **Load Failure Handling:** a failed load never yields a partially-loaded engine and never overwrites the stored payload — `load*Result()` methods return a typed `LoadOutcome`, not a throw.

---

## 6. Simulation Scoping & Input Architecture
*Details: [simulation-and-input.md](docs/architecture/simulation-and-input.md). History: [ADR-0001](docs/decisions/0001-scheduler-partitioning-evaluated-not-adopted.md) (scheduler partitioning), [ADR-0004](docs/decisions/0004-hud-overhaul-retrospective.md) (HUD overhaul).*

**Binding rules:**
- **Bounded Simulation Scoping:** only the active floor is simulated; other visited floors are stored, not simulated. Per-actor work (AI, pathfinding, combat, awakening/bestiary checks) is bounded via dormant-actor short-circuiting and bounded FOV. `EnergyScheduler` turn selection deliberately stays linear in the active floor's actor count — read ADR-0001 before proposing a partition; rejected on measured evidence.
- **Focus & Modal Isolation:** every open modal registers on the LIFO `ModalStackManager`. The top modal gets all keystrokes; unhandled `Escape` pops it; every other key is trapped before reaching the simulation.
- **Input ownership:** `InputHandler` owns the `window` `keydown`/`keyup`/`blur` listeners, `ModalStackManager`, and `ChordBuffer`.

---

## 7. Build Configuration & Automated Quality Gates

### 7.1 Single-File Bundling Architecture
Build tooling per §2's Language & Build Target. `assetsInlineLimit` inlines all spritesheets/audio/fonts/stylesheets; `rollupOptions.output.inlineDynamicImports: true`. The post-build plugin converts module scripts to classic scripts so bundles run under `file://` without CORS errors.

### 7.2 Automated Quality Gates
*Details: [quality-gates.md](docs/architecture/quality-gates.md).*

**Requirement:** every change must pass the gates below before merging; run them locally and report real output — "should pass" is not "does pass."

**Gate commands:**
- `npm run lint` — `tsc --noEmit`, `check:engine-purity`, `check:engine-encapsulation`, `knip` (dead files, exports, and dependencies; don't invoke the sub-checks separately).
- `npm test` — all Vitest suites.
- `npm run sim` — headless population/throughput sim; fails on any rejected action, caught pipeline exception, or wall-clock overrun.
- `npm run validate:schema` — migrates a v1 envelope to `CURRENT_SCHEMA_VERSION`, round-trips a live engine through serialize/JSON/deserialize.
- `npm run build` (`build:all` when changing `vite.config.ts`, theme selection, or manifest wiring).

**Binding invariants the gates enforce (stated here only):**
- **Engine encapsulation:** code outside `src/engine/` never writes engine object fields directly — no assignment, index write, `as any`-cast write, or `Object.assign` onto an engine object. Presentation code (`src/ui/`, `src/rendering/`, `src/main.ts`, `src/main/**`) additionally changes engine state only via `GameEngine`/`Player`/`Entity` methods or `engine.commandBus` — never subsystem mutators (`GameMap`, `Container`, `InventoryManager`, …) or Array/Map/Set mutators on engine members. `src/content/` is exempt from the subsystem-mutator restriction. Allowlist additions (`scripts/engine-encapsulation-allowlist.json`) need a stated reason; stale entries fail the check.
- **Composition-root scope:** `src/main.ts` alone — never `src/main/**` — may import content packs; `check:engine-purity` enforces this against both.
- **PRNG discipline:** `engine.prng` is canonical; `engine.rng` is its bound delegate — no further aliases. Simulation code must not use `Math.random()`/`Date.now()` for outcomes or IDs.

---

## 8. Change Control

### 8.1 Protected Files
`src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts`, and `src/engine/storage/migrator.ts` may be modified only when one of these exceptions applies:
1. **Confirmed bug fix:** a reproducible defect, demonstrated by a failing test or a documented reproduction.
2. **Additive schema migration:** adding a new forward-only step and incrementing `CURRENT_SCHEMA_VERSION` (§5). Existing steps are changed only under exception 1.
3. **Requested planned item:** implementing a Planned Work item (§9) that the task explicitly requests.

Keep such diffs minimal and scoped, and state which exception applies in the change summary.

### 8.2 Documentation Synchronization
- This core document is authoritative, together with `docs/architecture/**` and `docs/decisions/**`. `.antigravity/rules.md`, `CLAUDE.md`, and `.antigravity/skills/`/`.antigravity/archetypes/` summarize or apply it and must not contradict it. If they disagree, stop and flag the conflict instead of picking a side.
- When a change makes an unmarked statement untrue — here or in a `docs/architecture/**` sub-doc — update that document in the same change. A binding statement is updated here; explanatory detail is updated in its sub-doc.
- When a design is built and rejected on evidence (not merely deferred), record it as a new ADR under `docs/decisions/**` rather than leaving the rationale in a commit message, and reference it from the relevant stub.
- When a change completes a planned item, remove its **[Planned]** tags, describe the new current state, and delete the item from §9.

### 8.3 Working With Planned Items
- Do not write code that depends on a planned capability existing.
- Implement a planned item only when the task explicitly requests it (by ID or unambiguous scope).
- New work must not widen the gap to a planned target. For example: no new deep engine imports from content, no new `Math.random()` in simulation code, and no new modals that bypass `ModalStackManager`.

---

## 9. Planned Work Register
Each entry records the current state, the target, and whether the work touches protected files (§8.1). Work recorded but deliberately out of scope is listed under *Deferred* below, and is not planned work.

**P-25 — Typed action introspection in the pipeline** (§4)
- Current: `ActionPipeline` and `GameEngine.handlePlayerAction` read an action's hook-matching name (`actionType`/`type`) and its acting entity (`entity`/`attacker`/`actor`/`player`) through 11 `as any` casts, because the `Action` interface (`src/engine/actions/action.ts`) declares only `perform()`.
- Target: `Action` declares those members as optional, typed properties, and the casts are removed. String matching, the actor fallback order (`entity` → `attacker` → `actor` → `player` → `engine.player`), and failure attribution behave exactly as before.
- Protected files: `src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts`.


### Deferred (out of scope)
Entries here are recorded, not planned: no work is scheduled, none attempted. They keep reserved IDs so numbering stays stable. A deferred item is not **[Planned]** — do not pick one up as planned work; moving one back into the register above is an explicit decision.

**P-24 — Radial Action Menu: gamepad invocation** (§6) — **Deferred 2026-09-15**
- Current: the radial menu itself is implemented (`src/rendering/radialMenu.ts`) — see `docs/architecture/simulation-and-input.md`. Gamepad invocation is not implemented; `navigator.getGamepads()` is unreferenced in `src/`.
- Reason: gamepad/controller support is intentionally out of scope until the game is feature-complete; may be reconsidered afterwards.
- Not the same as an *Evaluated, Not Adopted* design (e.g. [ADR-0001](docs/decisions/0001-scheduler-partitioning-evaluated-not-adopted.md)) — that was built and rejected on evidence. P-24 was never attempted; deferral is scheduling, not a verdict.
- If revisited: gamepad button-hold opens the menu and stick angle selects a wedge, confined to `src/rendering/` (never on the simulation execution path, so it doesn't affect headless purity, §2). Protected files: none.
