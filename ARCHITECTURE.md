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
- **Vision & Genre:** A turn-based, grid-based dungeon crawler and roguelike inspired by *Castle of the Winds*, built from modular systems that support variable narrative campaigns and thematic content packs. Shipping pack: `src/content/cotw/` (*Castle of the Winds*). `src/content/warcraft/` (*WarCraft*) is **parked** until the cotw sequel is complete ([ADR-0010](docs/decisions/0010-warcraft-pack-parked.md)): it is not built, released, extended or designed for, and is kept only compiling and as the second-pack test fixture — fix it minimally when a shared change breaks it. Future packs (e.g. *The Old Kingdom*) must be addable without engine changes beyond generic capabilities (§3, No Engine Creep).
- **Core Gameplay Loop:** Headless turn execution -> actor intent dispatch -> spatial calculation & collision resolution -> tactical bump combat / spellcasting / inventory management -> status & environmental propagation -> floor progression / level transitions.
- **Target Aesthetic:** Clean, retro tile-blitted presentation rendered via Canvas texture atlases, coupled with responsive modal dialogs, sliding-window chorded keyboard controls, and tactile visual effect feedback.

---

## 2. System Boundaries & Tech Stack Invariants
- **Language & Build Target:** TypeScript with Vite and `vite-plugin-singlefile` (`assetsInlineLimit: 100000000` (100MB), `cssCodeSplit: false`), compiling into offline-capable, zero-dependency, self-contained single-file HTML distributions.
- **Release Strategy:** One single-file bundle per content pack, selected at build time by Vite mode (or `THEME` env var), exposed as `import.meta.env.VITE_THEME`:
  - `npm run build:cotw` (and plain `npm run build`, cotw default) -> `dist/index.html` + identical `dist/cotw.html`. `npm run build:warcraft` -> `dist/warcraft.html` exists for unparking the pack; no gate or workflow runs it (ADR-0010).
  - `emptyOutDir` is `false`, so bundles from earlier builds remain in `dist/`.
  - A post-build plugin rewrites `<script type="module" crossorigin>` to classic `<script>`, so bundles run under `file://` without CORS errors.
- **Execution-Path Headless Simulation Purity:** purity is defined by *execution path*, not file location. Any function/handler/hook/callback running inside the simulation — in `src/engine/`, `src/content/`, or registered at runtime — must not touch DOM globals (`window`, `document`, `HTMLElement`), Canvas contexts, audio APIs, or timing globals (`requestAnimationFrame`, `setTimeout`). Outcomes must also be deterministic (§7.2).
- **Public API Surface Integrity:** `src/ui/`, `src/rendering/`, and `src/content/` import the engine only through `src/engine/index.ts` — deep imports into engine internals are barred. Enforced by `check:engine-purity` for all three (content's test files may still deep-import). `scripts/` and test files may deep-import engine internals generally.
- **Diagnostic API Namespacing & Triage Access:** triage/inspection methods are namespaced under `engine.diagnostics`: the core four (`spawnMonster`, `spawnItem`, `toggleGodMode`, `revealFloorMap`) in `engine.ts`, the rest (`TriageAPI`: vitals, statuses, secrets, stairs, floor jumps, ending a prologue, kills, levels, identification, PRNG state, an outfit for a floor) in `src/engine/debug/triage.ts`. Presentation triage code calls these, never writes engine state itself. The `[F2]`/backtick triage menu is a deliberate, always-reachable player feature, not gated behind a build flag; `InputHandler` checks the toggle before the input lock, so it works during effect playback.
- **Bug-Report Replay:** `handlePlayerAction` records every player action with its scalar parameters into the flight recorder's trail, after a checkpoint save taken at an action boundary (first action on an engine, floor entry, every 250 actions, after a dialog choice or a command-bus command that changes state without a player action (a trade, a sort, a split, a pact, a town service, a companion call), and after any `engine.diagnostics` call; one already due is taken when the replay data is read; it also carries F2 god mode, which no save does). Checkpoint + trail replay deterministically through `loadReplayState()`/`replayActionTrail()` (`src/engine/debug/replay.ts`), from F2 or headlessly with `npm run replay:report -- <file>`. Every game input first persists the replay data to `localStorage` (`src/ui/sessionGuard.ts`) and a clean exit clears it, so a session that hung is offered as a pre-filled report on the next launch; level-up allocation and mastery-perk picks change state outside both and are not replayed, and a dialog choice is kept out of the trail, its outcome carried by the checkpoint taken after it. Every action the game issues has a replay builder or is monster-only (`replayBuilders.test.ts`). See [ADR-0007](docs/decisions/0007-bug-report-replay-and-triage-api.md).
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
| `relay/` | Bug-report relay: a Cloudflare Worker that files GitHub issues for the F3 reporter, holding a token scoped to this repo's issues. Deployed separately (`relay/README.md`); the game reaches it only over HTTP at the build-time `REPORT_RELAY_URL`, and falls back to GitHub's new-issue page without it. | Imports nothing from `src/`; not bundled into the game. Its logic (`relay/src/relay.ts`) runs under `npm test`. |
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
- **Exactly two hook mechanisms** (status handlers, AI strategies and effect primitives are registries, not hooks): (1) **Action hooks** (`manifest.actionHooks`, `ActionHook` in `actionPipeline.ts`) — priority-ordered `pre`/`post` hooks around pipeline-executed actions, `ActionHookContext`; a pre-hook can short-circuit with its own `ActionResult`. (2) **Declarative event hooks** (`HookDispatcher`, `src/engine/hooks/hookDispatcher.ts`) — `HookDescriptor` data attached to items and monsters, `HookContext`; a descriptor's action is one of the engine's built-in primitives (`ActionPrimitive`). There are no global hooks and no API to register a primitive: a new one is a generic engine capability (No Engine Creep, below).
- **Injected context, never the raw engine:** hook handlers (action hooks, event hooks, hook primitives) receive `EngineContext` (`src/engine/types/engineContext.ts`), not `GameEngine` itself — a type-level narrowing (the object is the engine). Widening it is deliberate, one member at a time — each addition becomes part of the content-facing contract. Status handlers and AI strategies receive `GameEngine`.
- **No Engine Creep:** campaign-specific mechanics, items, monsters, quests, and narrative belong in `src/content/`. Change `src/engine/` only to add a *generic, reusable capability* that content packs then use. Engine code must not gain new campaign-specific names or logic; `check:engine-creep` fails on any pack-declared identifier in engine source (§7.2).
- **Pack-Neutral Presentation:** player-facing text and sprite choice in `src/ui/`, `src/rendering/`, and `src/main/**` name no content pack. A pack's title, tagline, town, and flavor come from the manifest (`name`, `description`, `town.name`, `branding`), and its art from `spriteRecipes` — a recipe keyed by a monster or item definition ID, or by an NPC's id, is that entity's sprite, and one keyed `ui~<name>` is that UI icon (the vocabulary is `src/ui/icons.ts`: DOM shows it as `ui-icon` elements baked at startup by `installUiIcons`, canvas overlays through `canvasIcons.ts`; an icon the pack doesn't draw doesn't show), and one keyed `spell~<spellId>`, else `spell~<elementId>`, is a spell's rune (`src/ui/spellRunes.ts`, baked with the icons; a spell's color is its element's in `affinityMatrix`, else its own `visual.color`). Presentation, the F2 developer diagnostics included, shows these icons, not emoji. Neighbour-aware terrain (tile variants, 3/4 walls, blended liquids and pits, props), torchlight and remembered-cell styling come from `atlas.terrain` (`TerrainArtConfig`, recipes keyed `<base>[_<zone>]~<part>`); `src/rendering/` applies them generically and names no zone or floor band. What covers a cell, its ground surface and gas, is drawn each frame by the pack's `atlas.overlays` art (`CellOverlayArt`, keyed `surface~<type>`/`gas~<type>`); a type the pack draws no art for shows as a neutral wash in role colors, never as nothing. Color, type, radius and fonts come from the semantic role tokens of the pack's `ThemeTokens` (`resolveThemeTokens`/`applyThemeTokens` in `src/rendering/theme.ts` write them as `--ui-*` variables; the static type, space, layer and motion scales are in `src/ui/styles/tokens.css`; [ADR-0011](docs/decisions/0011-menus-and-visual-system-direction.md)): presentation names roles (`var(--ui-accent)`, `theme.textMuted`), never hues, and canvas UI text is sized with `uiFont()`, which holds the 11px floor at every window size (map-tile glyphs and cell badges scale with the cell instead). The player's UI scale (`src/ui/uiScale.ts`, Auto by default) multiplies both: it zooms the interface's DOM roots (never the map canvas, which fits to what they leave) and `uiFont()`'s sizes alike (ADR-0011, 2026-10-04 amendment).

---

## 4. Action Pipeline & Domain Event Contract
- **Contract of `actionPipeline.ts`:** `ActionPipeline.executeWithHooks(action, engine)` returns the `ActionResult` defined in `src/engine/types.ts`:
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
  - All player actions, including those issued through `EngineCommandBus`, go through `engine.handlePlayerAction()` -> `executeWithHooks()`; each step of a rest is one (`RestTurnAction`). Two exceptions: a paralysed or stunned hero's forced pass runs a `WaitAction` directly inside `handlePlayerAction`, and the bus's bookkeeping commands (a sort, a split, a junk mark, a town service) are not actions; they request a checkpoint instead (§2).
  - Composite actions may perform sub-actions directly (e.g. a movement bump performs an attack); sub-actions run inside the outer action's error boundary, and hooks match only the outer action.
  - Monster turns run their AI-chosen action through `executeWithHooks()` too, so hooks fire for every actor. A monster action a pre-hook short-circuits, or that fails, falls back to `WaitAction` so the scheduler cannot reselect it in a loop.
  - Per-turn environmental updates (status, surface, wandering spawns, floor respawn, timed events) stay outside the pipeline deliberately — they aren't `Action` objects and have no actor. Each runs inside its own failure boundary instead (Failure Isolation, below).
- **Failure Isolation:**
  - `executeWithHooks()` wraps pre-hooks, `action.perform()`, and post-hooks in try/catch inside a top-level boundary, and always returns a valid `ActionResult`: a hook or `perform()` that produces none is treated as a failure.
  - A caught exception is recorded (`flightRecorder.recordError`, logged, counted in the pipeline's `caughtExceptionCount`) and returned as `{ success: false, cost: 0, message, pipelineError: true }` — except a post-hook's: the action has already happened, so its own result stands, marked `pipelineError: true`. A player action advances the world exactly when it spends energy (`cost > 0`), success or not: a failed disarm is a turn; a refused action, or one that crashed before acting, is none.
  - Monster turns run inside their own boundary (`GameEngine.processMonsterAction`); an exception is recorded through the same counters (`recordIsolatedFailure`, phase `monster-turn`), the monster's turn energy is spent so the scheduler can't reselect it, and the enclosing result is marked `pipelineError: true`.
  - `HookDispatcher.dispatch` does not catch primitive exceptions; they propagate to the enclosing boundary, and its re-entrancy depth counter is restored either way.
  - Per-turn environmental updates each run through `GameEngine.runEnvironmentalUpdate`, which catches, records (`recordIsolatedFailure`, phase `environmental-update`), and continues with the rest — a throwing surface tick must not skip wandering spawns, floor respawn, or timed events. (Planes and reactive substances, once two more of these updates, were removed: [ADR-0015](docs/decisions/0015-planes-and-substances-removed.md).)
  - Player actions, monster turns, and environmental updates are each isolated; so are a stunned hero's forced pass and the turn's FOV updates (through `runEnvironmentalUpdate`) and every presentation callback the engine calls inline (`onGameEvent`, `onFloorChanged`, `onNpcInteract`, `onChoiceInteract`, and `GameStateManager.onStateChanged` at a death or victory, through `GameEngine.notifyPresentation`, phase `presentation-callback`), so a broken subscriber can't stop a death halfway. What still reaches the backstop: presentation code's own handlers and anything the engine runs outside a turn. Last-resort backstop: `src/main.ts` installs `window` `error`/`unhandledrejection` handlers that record to the flight recorder and show the crash dialog — except for two messages with no error object that are only recorded as warnings: a browser-opaque `"Script error."` (cross-origin or injected script) and the browser's benign `"ResizeObserver loop …"` notice (`src/ui/opaqueScriptError.ts`).
- **`pipelineError` Consumption:** after each player action, presentation code (`processVisualEffectsAndRender` in `src/main.ts`) checks `engine.lastActionResult.pipelineError` and notifies via `DiagnosticModal.showError` without locking game state.
- **Domain Events (`GameEvent`):**
  - **Envelope:** every event extends `GameEventBase` — `type`, `turn`, optional `actorId`/`targetId`/`itemId`, and a flat scalar `data` bag. `type` is a plain string, so content packs emit their own (e.g. `cotw:relic_attuned`) without editing `events.ts`; `BuiltInGameEventType` lists the engine's own.
  - **Scalar payloads:** events carry IDs and numbers, never live `Player`/`Entity`/`Item` references — a live reference can't be serialized, so every event survives `JSON.stringify`.
  - **Built-ins:** `player_leveled_up`, `chaotic_proc`, `uncurse`, `damage_dealt`, `entity_killed`, `level_transition`, `rune_of_return_discovered`, `mastery_unlocked`, `mastery_perk_selected`, `kill_rite_performed`, `altar_reached`, `altar_rite_performed`.
  - **Delivery:** `engine.emitGameEvent()` buffers into `engine.recentGameEvents`, delivers via `engine.onGameEvent`, and returns on `ActionResult.events`. `ActionPipeline` keeps a capture stack so a composite action's sub-actions attribute correctly.
  - **Narrowing:** `isGameEvent(event, 'entity_killed')` narrows the open `type` union to a built-in.
- **Presentation Consumption & Animation Gating:**
  - Visual effects from `ActionResult.effects` and monster turns accumulate in `engine.pendingVisualEffects`; `main.ts` drains them each player action via `consumePendingVisualEffects()`/`fxRunner.playQueue()`, which splits by priority.
  - **Tactical effects gate input; ambient effects do not.** `isTacticalEffect` (`src/engine/types/effects.ts`) classifies positional cues the player needs before acting (projectile paths, beam reflections, bursts, chain lightning) as tactical; screen pulses and similar are ambient. `priority` can override either way.
  - Ambient effects skip the runner's track queue (never join the promise chain `playEffects` resolves). `main.ts` holds input (`InputHandler.holdInput()`, read as `isInputLocked`) only while a batch containing a tactical effect plays, so a screen flash never blocks the next keypress; overlapping batches each hold their own, and the runners survive a frame that throws.
  - While locked, gameplay keys (including `ChordBuffer` moves) are ignored; the diagnostics toggle and any open modal still receive input.

---

## 5. State Normalization, Storage & Schema Evolution
*Details: [storage-and-schema.md](docs/architecture/storage-and-schema.md). History: [ADR-0002](docs/decisions/0002-v0-v11-migration-chain-deletion.md).*

**Binding rules:**
- **Reference Invariant:** persistent state has no live circular object references — relationships use scalar IDs (`parentId`, `ownerId`).
- **Forward-Only Schema Migrations (`migrator.ts`, §8.1 protected):** `CURRENT_SCHEMA_VERSION` there is authoritative. Every breaking save-format change increments it and adds exactly one forward-only `N -> N+1` step; existing steps are rewritten only as a confirmed bug fix (§8.1).
- **Version floor:** the current version is also the oldest readable one — a save below it is refused (`migration-failed`), never silently mis-decoded. No migration path is ever added below the floor, and deleting existing migration history needs §8.1 exception 4 ([ADR-0002](docs/decisions/0002-v0-v11-migration-chain-deletion.md)).
- **Load Failure Handling:** a failed load never yields a partially-loaded engine and never overwrites the stored payload — `load*Result()` methods return a typed `LoadOutcome`, not a throw.
- **Death Is Final for the Dead State:** a dead player's state is never written as a loadable save — character slot or autosave. Death updates only the roster record (`questStatus: 'fallen'`); earlier saves stay loadable through Load Saved Game, but Continue never resumes a fallen run (`resolveContinueTarget`).
- **Autosave Never Erases Deeper Progress:** the autosave is one rolling slot, so `AutosaveManager.autosave` first moves the current autosave to a preserved slot when it belongs to another hero or is deeper than the incoming one. Load Saved Game offers both; Continue uses only the rolling slot.

---

## 6. Simulation Scoping & Input Architecture
*Details: [simulation-and-input.md](docs/architecture/simulation-and-input.md). History: [ADR-0001](docs/decisions/0001-scheduler-partitioning-evaluated-not-adopted.md) (scheduler partitioning), [ADR-0004](docs/decisions/0004-hud-overhaul-retrospective.md) (HUD overhaul).*

**Binding rules:**
- **Bounded Simulation Scoping:** only the active floor is simulated; other visited floors are stored, not simulated. Per-actor work (AI, pathfinding, combat, awakening/bestiary checks) is bounded via dormant-actor short-circuiting and bounded FOV. A lit floor (`GameMap.lit`, the town by day) is seen as far as line of sight goes, but its awakening and bestiary checks stay within the hero's own radius. `EnergyScheduler` turn selection deliberately stays linear in the active floor's actor count — read ADR-0001 before proposing a partition; rejected on measured evidence.
- **Focus & Modal Isolation:** every open modal registers on the LIFO `ModalStackManager`. The top modal gets all keystrokes; unhandled `Escape` pops it; every other key is trapped before reaching the simulation. Tab never moves focus out of the top modal. A modal that names its element (`UIModal.focusRoot`) holds keyboard focus: the stack moves focus into it on open and cycles Tab within it, and when the last modal closes, focus goes back to what had it before.
- **Input ownership:** `InputHandler` owns the `window` `keydown`/`keyup`/`blur` listeners, `ModalStackManager`, and `ChordBuffer`.

---

## 7. Build Configuration & Automated Quality Gates

### 7.1 Single-File Bundling Architecture
Build tooling per §2's Language & Build Target. `assetsInlineLimit` inlines all spritesheets/audio/fonts/stylesheets; `rollupOptions.output.inlineDynamicImports: true`. The post-build plugin converts module scripts to classic scripts so bundles run under `file://` without CORS errors. The deploy workflow builds with `SOURCEMAP=hidden`: maps never ship, and are kept (with the HTML they map) as the `sourcemaps-<sha>` workflow artifact for `npm run map:stack` to resolve bug-report stack traces.

### 7.2 Automated Quality Gates
*Details: [quality-gates.md](docs/architecture/quality-gates.md).*

**Requirement:** every change must pass the gates below before merging; run them locally and report real output — "should pass" is not "does pass." Work is committed directly to `main`, so the git hooks are the pre-merge gate: `pre-commit` runs lint and tests (skipping a gate that already passed on the identical working tree, by a content-hash stamp: any doubt runs it), `pre-push` runs the sim, schema validation, the cotw build, and the Playwright smoke suite; CI repeats them after the push.

**Gate commands:**
- `npm run lint` — `tsc --noEmit`, then again over the Playwright specs (`-p e2e/tsconfig.json`), `check:engine-purity`, `check:engine-encapsulation`, `check:engine-creep`, `check:ui-palette`, `knip` (dead files, exports, and dependencies; don't invoke the sub-checks separately).
- `npm test` — all Vitest suites.
- `npm run sim` — headless population/throughput sim; fails on any rejected action, caught pipeline exception, or wall-clock overrun.
- `npm run validate:schema` — passes a current-version save through, asserts a save below the version floor is refused, runs a probe N -> N+1 migration step, and round-trips a live engine through serialize/JSON/deserialize.
- `npm run build` — the cotw bundle; the parked WarCraft pack is not built (ADR-0010).

**Binding invariants the gates enforce (stated here only):**
- **Engine encapsulation:** code outside `src/engine/` never writes engine object fields directly — no assignment, index write, write through a cast (`as any`, `as unknown as`, inline or through a local alias of the cast), or `Object.assign` onto an engine object, including a plain object reached through an engine member (`engine.lastActionResult.pipelineError`). Presentation code (`src/ui/`, `src/rendering/`, `src/main.ts`, `src/main/**`) additionally changes engine state only via `GameEngine`/`Player`/`Entity` methods or `engine.commandBus` — never subsystem mutators (`GameMap`, `Container`, `InventoryManager`, …) or Array/Map/Set mutators on engine members. `src/content/` is exempt from the subsystem-mutator restriction. Allowlist additions (`scripts/engine-encapsulation-allowlist.json`) need a stated reason; stale entries fail the check.
- **Composition-root scope:** `src/main.ts` alone — never `src/main/**` — may import content packs; `check:engine-purity` enforces this against both.
- **No engine-creep literals / Pack-neutral presentation:** engine production source names no identifier a content pack declares (monster, item, spell, pact, companion, trainer skill, vault, choice, NPC, quest reference, or story flag). Presentation production source (`src/ui/`, `src/rendering/`, `src/main/**`, excluding composition root `src/main.ts`) likewise names no content pack-declared identifier and no string literal with a pack namespace prefix (`'<packId>:`). Legitimate overlaps are listed with a reason in `scripts/engine-creep-allowlist.json`; stale entries fail the check.
- **UI palette ratchet:** color literals (hex of 3/4/6/8 digits, `0xRRGGBB`, `rgb()`/`hsl()`, and the CSS Color 4 functions `oklch()`/`oklab()`/`lch()`/`lab()`/`hwb()`/`color()`; pure black and white excepted, named colors not counted) in `src/ui/`, `src/rendering/`, `src/main.ts`, `src/main/**` and `index.html` may only go down: `check:ui-palette` fails a file whose count rises above `scripts/ui-palette-baseline.json`, and one whose count falls until the baseline is lowered (`npm run check:ui-palette -- --update`). The token modules (`src/rendering/theme.ts`, `src/ui/styles/tokens.css`) are exempt.
- **PRNG discipline:** `engine.prng` is canonical; `engine.rng` is its bound delegate — no further aliases. Simulation code must not use `Math.random()`/`Date.now()` for outcomes or IDs. `check:engine-purity` fails on both in engine and content source, and likewise on `crypto` randomness and an argument-less `new Date()`; wall-clock timestamps are allowlisted per file with a reason in `scripts/purity-clock-allowlist.json` (stale entries fail), and a line may be exempted from either check by a reasoned inline `// purity-allow:` pragma (today the profile-id entropy boundary).

---

## 8. Change Control

### 8.1 Protected Files
`src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts`, and `src/engine/storage/migrator.ts` may be modified only when one of these exceptions applies:
1. **Confirmed bug fix:** a reproducible defect, demonstrated by a failing test or a documented reproduction.
2. **Additive schema migration:** adding a new forward-only step and incrementing `CURRENT_SCHEMA_VERSION` (§5). Existing steps are changed only under exception 1.
3. **Requested planned item:** implementing a Planned Work item (§9) that the task explicitly requests.
4. **Owner-authorized change:** the owner explicitly authorizes a named, narrowly scoped protected-file change in the task itself. An agent never infers this authorization. Record it as an ADR under `docs/decisions/` naming the authorization and scope ([ADR-0005](docs/decisions/0005-owner-authorized-exception-and-agent-workflow.md)).

Keep such diffs minimal and scoped, and state which exception applies in the commit message as `§8.1 exception N`; the `commit-msg` hook rejects a commit that stages a protected file without one.

### 8.2 Documentation Synchronization
- This core document is authoritative, together with `docs/architecture/**` and `docs/decisions/**`. `CLAUDE.md` and Antigravity's `.agents/rules/` and `.agents/skills/` summarize or apply it and must not contradict it. If they disagree, stop and flag the conflict instead of picking a side.
- When a change makes an unmarked statement untrue — here or in a `docs/architecture/**` sub-doc — update that document in the same change. A binding statement is updated here; explanatory detail is updated in its sub-doc.
- When a design is built and rejected on evidence (not merely deferred), record it as a new ADR under `docs/decisions/**` rather than leaving the rationale in a commit message, and reference it from the relevant stub.
- When a change completes a planned item, remove its **[Planned]** tags, describe the new current state, and delete the item from §9.

### 8.3 Working With Planned Items
- Do not write code that depends on a planned capability existing.
- Implement a planned item only when the task explicitly requests it (by ID or unambiguous scope).
- New work must not widen the gap to a planned target. For example: no new deep engine imports from content, no new `Math.random()` in simulation code, and no new modals that bypass `ModalStackManager`.

### 8.4 Agent Workflow
Claude Code is the only agent that writes to this repository: it commits, and pushes when the owner asks. Antigravity is read-only: it reads the code and writes reports and recommendations into the gitignored `.prompts/antigravity/`, input that is verified against the code before anyone acts on it. Review happens **after** commit: Claude Code reviews what landed without its own trailer. [ADR-0005](docs/decisions/0005-owner-authorized-exception-and-agent-workflow.md) set up the original two-writer workflow; [ADR-0006](docs/decisions/0006-review-after-commit-and-loaded-agent-rules.md) moved review after commit.
- **Agent instructions:** Claude Code loads `CLAUDE.md`; Antigravity loads `.agents/rules/*.md` (`project-rules.md` and `cli-safety.md`, both `trigger: always_on`) and `.agents/skills/<name>/SKILL.md`. Instructions anywhere else are not loaded automatically.
- **No Antigravity commits:** the `commit-msg` hook rejects a message with an `Agent: Antigravity` line. It is a tripwire, not enforcement: both tools commit as the same git user, so the guards are Antigravity's own rules and the git status every session starts with.
- **Owner's request:** a commit implementing something the owner asked for carries a `Requested: "<the ask>"` trailer. Review treats requested behavior as intended and checks its correctness; unrequested behavior changes are flagged.
- **One request per commit:** unrelated work is not bundled; the `commit-msg` hook warns on large commits spanning several areas.
- **Protected files and gates still bind:** §8.1 is enforced by `commit-msg`; `pre-commit` runs lint and the unit tests, and `pre-push` runs the sim, schema validation, the cotw build and the Playwright smoke suite (§7.2). Hooks are bypassed only on the owner's explicit say-so.
- **Review marker:** the local git tag `verified` marks the last commit Claude Code has reviewed; only Claude Code moves it. Each Claude Code session reviews every commit in `verified..HEAD` without its own trailer — against this document, with the gates run — then moves the tag to `HEAD`.

### 8.5 Repository Files
- **No ephemeral markdown at the root:** the repo root holds exactly two markdown files, `ARCHITECTURE.md` and `CLAUDE.md`. Prompts, task notes, research and other scratch markdown for a single piece of work go in the gitignored `/.prompts/` or outside the repo; lasting docs go under `docs/architecture/**` or `docs/decisions/**`.
- **LF line endings:** every text file is LF, in the repository and in the working tree, whatever the checkout's `core.autocrlf` (`.gitattributes`). A CRLF hook or shell script breaks its `#!/bin/sh` line under `sh`.

---

## 9. Planned Work Register
Each entry records the current state, the target, and whether the work touches protected files (§8.1). Work recorded but deliberately out of scope is listed under *Deferred* below, and is not planned work.

*There are currently no active planned work items.*


### Retired IDs
A completed item is deleted from this register, but its ID is retired, never reused, and code comments may still cite it. Retired: P-01–P-23 and P-25–P-26. **Next free ID: P-28.** Where the commonly cited ones now live:

| ID | Feature | Documented in |
|---|---|---|
| P-03 | Campaign content moved into packs; Rune of Return | [content-extensibility.md](docs/architecture/content-extensibility.md), [content-rune-of-return.md](docs/architecture/content-rune-of-return.md) |
| P-05, P-06 | Hooks for every actor; turn failure isolation | §4 |
| P-14 | Companions | [content-companions.md](docs/architecture/content-companions.md) |
| P-22 | Per-engine registries | [content-extensibility.md](docs/architecture/content-extensibility.md) (Content Registries) |
| P-23 | Milestone renown ledger | [content-progression-scaling.md](docs/architecture/content-progression-scaling.md) |
| P-25 | Assigned twice in error: tag-filtered radial auras ([content-progression-scaling.md](docs/architecture/content-progression-scaling.md); their hook primitive was removed 2026-10-07, the `radial_status` effect remains), and on 2026-09-23 typed action introspection (§4) | — |
| P-26 | Sensory masking & echolocation | [simulation-and-input.md](docs/architecture/simulation-and-input.md) |

### Deferred (out of scope)
Entries here are recorded, not planned: no work is scheduled, none attempted. They keep reserved IDs so numbering stays stable. A deferred item is not **[Planned]** — do not pick one up as planned work; moving one back into the register above is an explicit decision.

**P-24 — Radial Action Menu: gamepad invocation** (§6) — **Deferred 2026-09-15**
- Current: the radial menu itself is implemented, dedicated to the companion as the companion wheel (`src/rendering/radialMenu.ts`, `src/ui/companionWheel.ts`) — see `docs/architecture/simulation-and-input.md`. Gamepad invocation is not implemented; `navigator.getGamepads()` is unreferenced in `src/`.
- Reason: gamepad/controller support is intentionally out of scope until the game is feature-complete; may be reconsidered afterwards.
- Not the same as an *Evaluated, Not Adopted* design (e.g. [ADR-0001](docs/decisions/0001-scheduler-partitioning-evaluated-not-adopted.md)) — that was built and rejected on evidence. P-24 was never attempted; deferral is scheduling, not a verdict.
- If revisited: gamepad button-hold opens the menu and stick angle selects a wedge, confined to `src/rendering/` (never on the simulation execution path, so it doesn't affect headless purity, §2). Protected files: none.

**P-27 — Locked doors: lockpicking and bashing** — **Parked 2026-10-07** (owner kept it rather than deleting it)
- Current: `TileDefinition.locked`/`lockDifficulty`, the lockpick roll in `OpenDoorAction` and `BashDoorAction` (`src/engine/actions/door.ts`, its recoil resolved through `harm`) exist and are tested, but no generator or pack makes a door locked and no key or menu issues a bash, so none of it runs in play. Monster pathing already treats a locked door as a wall.
- If revisited: a pack marks doors locked (a vault gate, a key-and-door quest), the input layer binds Bash, and a failed bash or lockpick is a turn (it spends energy, §4).
