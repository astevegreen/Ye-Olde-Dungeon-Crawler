# Architectural Specification & Engine Invariants

> **AI Context Instruction:** This document defines the core architectural specification and hard invariants for the repository. When executing implementation tasks, prioritize these rules over general software patterns. Do not violate system boundaries, bypass the public API barrel, or introduce platform leaks.

---

## 1. Game Concept & Core Simulation Loops
- **Vision & Genre:** A turn-based, grid-based dungeon crawler and roguelike inspired by *Castle of the Winds*, featuring modular systems to support variable narrative campaigns and thematic content packs (e.g., *Castle of the Winds*, *WarCraft*, *The Old Kingdom*).
- **Core Gameplay Loop:** Headless turn execution -> actor intent dispatch -> spatial calculation & collision resolution -> tactical bump combat / spellcasting / inventory management -> status & environmental propagation -> floor progression / level transitions.
- **Target Aesthetic:** Clean, retro tile-blitted presentation rendered via Canvas texture atlases, coupled with responsive modal dialogs, sliding-window chorded keyboard controls, and tactile visual effect feedback.

---

## 2. System Boundaries & Tech Stack Invariants
- **Language & Build Target:** TypeScript with Vite and `vite-plugin-singlefile`, configured with `assetsInlineLimit: 100000000` (100MB) and `cssCodeSplit: false` to compile into 100% offline-capable, zero-dependency, self-contained single-file HTML distributions.
- **Release Strategy:** Compiles campaign packs into distinct single-file distribution bundles at build time (`npm run build:cotw` -> `dist/cotw.html`, additionally copied to `dist/index.html` as the default distributable; `npm run build:warcraft` -> `dist/warcraft.html`), or performs multi-bundle deployment via `npm run build:all`. Inlined scripts are post-processed to remove module CORS constraints, guaranteeing zero-CORS compatibility under the `file://` protocol.
- **Execution-Path Headless Simulation Purity:** Defined strictly by *execution path* rather than file location. All game state, spatial resolution, combat calculations, AI decision trees, and action pipelines execute in headless purity. Any function, handler, or hook executed within the simulation pipeline—regardless of whether it is authored in `src/engine/`, `src/content/`, or registered dynamically at runtime—is strictly prohibited from accessing DOM globals (`window`, `document`, `HTMLElement`), Canvas contexts (`CanvasRenderingContext2D`), audio APIs, or timing globals (`requestAnimationFrame`, `setTimeout`).
- **Public API Surface Integrity:** External layers (`src/ui/`, `src/rendering/`) interact with the engine exclusively through `src/engine/index.ts`. All deep imports into engine internals (`src/engine/grid/*`, `src/engine/storage/*`, `src/engine/actions/*`) are strictly barred by static boundary enforcement.
- **Diagnostic API Namespacing & Triage Access:** Triage and inspection methods (`spawnMonster`, `spawnItem`, `toggleGodMode`, `revealFloorMap`) are cleanly namespaced under `engine.diagnostics` to preserve the integrity of the primary engine API surface. The associated `[F2]`/backtick triage menu is a deliberate, always-reachable, in-game feature for players — not developer-only, not gated behind a build flag.
- **Deterministic Action Pipeline:** All turns, actor intents, and environmental reactions flow through `src/engine/actions/actionPipeline.ts`, returning typed domain results.
- **Bounded Simulation Scoping:** Simulation execution cost is capped at `O(K)` active cells around the player bubble using dormant actor states and bounded spatial indexing, eliminating global `O(N)` map-wide scaling bottlenecks.

---

## 3. Directory Layout, Module Topology & Dependency Inversion

| Layer / Directory | Primary Responsibility | Dependency & Import Rules |
| :--- | :--- | :--- |
| `src/main.ts` | **Composition Root.** Bootstraps theme selection, instantiates `GameEngine`, wires content manifests, configures presentation layers, and mounts DOM listeners. | The **sole module** authorized to import both `src/engine/` and `src/content/`, as well as `src/rendering/` and `src/ui/`. |
| `src/content/` | Campaign content packs, item/monster catalogs, encounter tables, floor templates, and quest arcs. | Implements engine type interfaces only (`src/engine/types/manifest.ts`, etc.) — a deliberate, narrow exception to the `index.ts`-only rule stated in Section 2, since type-only imports are erased at compile time and carry no runtime coupling. This exception never extends to engine internals. NEVER imports UI or rendering. `src/engine/` has **ZERO** imports from `src/content/` (Dependency Inversion). |
| `src/engine/` | Headless state coordinator, action pipeline, spatial grid, FOV, scheduler, AI behavior trees, storage serializers, and PRNG. | Zero browser/DOM/Canvas dependencies. Exposes its public API strictly through `src/engine/index.ts`. Zero imports from `src/content/`. |
| `src/rendering/` | Canvas texture atlas management, sprite blitting, camera transforms, visual effect pipelines (`fxRunner`). | Consumes `src/engine/index.ts`. Zero deep imports into engine internals. |
| `src/ui/` | DOM HUD, LIFO modal stack management, sliding-window chorded input, settings, diagnostic tools. | Consumes `src/engine/index.ts`. Zero deep imports into engine internals. |
| `scripts/` | Headless verification tooling, engine purity auditors, chaos simulation runners, schema migration validators. | Developer automation only. Not bundled into client build. |
| `tests/` | Vitest suites, deterministic regressions, invariant audits, long-duration chaos monkey tests (parameters live in `npm run sim`'s config, not restated here). | Testing harness only. Not bundled into client build. |

### Module Import Hierarchy
```
                       ┌─────────────────┐
                       │   src/main.ts   │  ◄── Composition Root (Theme bootstrap & wiring)
                       └────────┬────────┘
        ┌───────────────────────┼───────────────────────┬──────────────────────┐
        ▼                       ▼                       ▼                      │
┌──────────────┐        ┌──────────────┐        ┌──────────────┐               │  direct import —
│   src/ui/    │        │src/rendering/│        │ src/content/ │               │  instantiates
└───────┬──────┘        └───────┬──────┘        └───────┬──────┘               │  GameEngine /
        │                       │                       │                      │  Engine.initialize()
        │    Consumes Public API Barrel                 │  Implements Engine   │
        │   (src/engine/index.ts ONLY)                  │  Interfaces          │
        ▼                       ▼                       ▼                      ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 src/engine/                                       │  ◄── Headless Pure Simulation
└───────────────────────────────────────────────────────────────────────────────────┘
```
`src/main.ts` is the only module with a direct edge into `src/engine/` that bypasses the public-API-consumption path above — it calls `Engine.initialize(manifest)` once, at boot, to construct the engine and hand it the selected content pack. `src/ui/` and `src/rendering/` never get this direct edge; they only ever consume the already-running engine through `src/engine/index.ts`.

### Content Extensibility Model
- **Declarative Primitives:** Content packs (`src/content/cotw/`, `src/content/warcraft/`) define declarative manifests assembled from composable effect primitives: status afflictions, procedural spawners, stat triggers, damage affinities, drop tables, and quest arcs.
- **Dynamic Handlers:** Scripted behaviors, hooks, or dynamic event handlers register via manifest properties (e.g. `manifest.actionHooks`) during `GameEngine` construction, conforming strictly to engine interface contracts without polluting the headless engine core. Handlers never import engine runtime code directly; the engine instead calls them with an injected context object (`ActionHookContext` in `actionPipeline.ts`, `HookContext` in `hookDispatcher.ts`) exposing `engine` plus relevant participants (e.g. `attacker`, `defender`) — preserving the type-only import boundary from Section 3 while still letting content read and mutate live simulation state. **Planned hardening:** both context types currently expose the raw `GameEngine` instance rather than a scoped query/mutation surface; consolidating them into one narrower `EngineContext` interface is a follow-up, not yet implemented.

---

## 4. Action Pipeline & Domain Event Contract
- **Contract of `actionPipeline.ts`:**
  Every player action, monster action, and environmental interaction executed via `actionPipeline.executeWithHooks()` returns a strongly typed, deterministic result:
  ```typescript
  export interface ActionResult {
    success: boolean;                   // Boolean resolution status
    cost: number;                      // Energy/tick cost consumed (0 for rejected actions)
    message?: string;                  // Narrative combat log string
    effects?: VisualEffectDescriptor[]; // Declarative visual effect primitives (projectiles, bursts, flashes)
    events?: GameEvent[];              // Typed domain events for state transition auditing
    pipelineError?: boolean;           // True if an unexpected exception was caught and isolated
  }
  ```
- **Failure-Isolation:**
  - `actionPipeline.executeWithHooks()` implements a comprehensive try/catch boundary surrounding pre-hooks, core action logic, and post-hooks.
  - Uncaught exceptions do not propagate to the main event loop. Instead, they are caught, isolated, recorded to the flight recorder telemetry, and returned gracefully as `{ success: false, cost: 0, pipelineError: true }`.
  - The UI layer intercepts `pipelineError` to safely notify the player via a diagnostic modal without locking the game state.
- **Domain Event Extensibility (`GameEvent`):**
  - Captures state transitions decoupled from UI/audio concerns: e.g., `damage_dealt`, `entity_killed`, `tile_altered`, `status_applied`, `item_acquired`, `level_transition`.
  - Structured with extensible payload envelopes so modular content packs can emit custom campaign-specific events without altering engine core.
- **Presentation Layer Consumption & Animation Gating:**
  - Presentation layers (`src/rendering/`, `src/ui/`) subscribe to domain events and visual effect descriptors.
  - **Tactical Turn Gating:** Visual effects that convey critical tactical information (projectile flight paths, beam reflections, explosion bursts, chain lightning) enter `fxRunner` and activate an input lock (`InputHandler.isInputLocked = true`). This temporarily gates player turn inputs until visual resolution finishes, preventing desynchronized turn stepping.
  - **Asynchronous Queuing:** Ambient and non-blocking effects (floating damage numbers, HUD badge pulses, ledger updates) process asynchronously through decoupled queues without impeding turn dispatch.

---

## 5. State Normalization, Storage & Schema Evolution
- **Normalized Flat Entity Storage:**
  - Game state is strictly normalized: entities, items, and map cells are stored in flat, ID-keyed lookup tables (`Map<string, Entity>`, `Map<string, ItemInstance>`, coordinate-keyed tile dictionaries).
  - Eliminates live circular object references across actor containers, equipment slots, and world floor grids. Entity relationships and container contents reference scalar unique IDs (`itemId`, `ownerId`).
- **Seeded PRNG Serialization:**
  - Mulberry32 32-bit PRNG state (initial seed and current step counter) is directly serialized into `SaveData.prngState`.
  - Hydration restores exact PRNG counter state, guaranteeing deterministic replayability and scum-proof save/load cycles.
- **Persistence Architecture & Storage Tradeoffs:**
  - **`localStorage` Backend:** Default synchronous browser sandbox backend for quick-save and auto-save. Bound by 5MB–10MB quota constraints, addressed via delta compaction (`compaction.ts`) and single-floor active cache policies.
  - **`IndexedDB` Backend:** Asynchronous persistent storage tier designated for large multi-floor dungeon states, comprehensive bestiary records, and flight recorder black-box logs exceeding quota limits.
  - **Native File Export/Import:** Base64/JSON file export via `Blob`/`File` API enables zero-dependency offline backup, run sharing, and cross-browser transfer.
- **Forward-Only Schema Migrations (`src/engine/storage/migrator.ts`):**
  - Saves carry a numeric `schemaVersion` (currently v5). Every breaking change increments this version and registers an isolated, forward-only transform step in `migrator.ts`.
- **Graceful Failure & UI Reset Notification:**
  - In the event of schema deserialization failure, version mismatch beyond migration range, or payload corruption, the engine falls back cleanly to a pristine baseline state.
  - The **UI layer bears explicit responsibility** for intercepting corrupted load events and notifying the user via a modal alert or diagnostic toast, preventing silent data loss or corrupted overwrites.

---

## 6. Simulation Scoping & Input Architecture
- **Bounded Simulation Scoping:**
  Simulating entire multi-floor dungeons simultaneously is prohibited. Simulation execution is strictly bounded to the active floor, and within the active floor, actor processing is spatially throttled:
  - **Dormant Actor Scheduling:** Monsters outside the player's active sensory radius remain in `aiState === 'sleeping'`. Each scheduler turn, a line-of-sight check determines whether they wake; if not, they execute a lightweight `WaitAction` (`O(1)` pass-turn) that consumes energy without triggering AI decision-making, A* pathfinding, or combat resolution. Status-effect ticks (e.g. poison, regeneration) bypass this short-circuit and resolve on schedule regardless of visibility — `statusManager.tick()` runs before AI decision-making on every actor's turn, sleeping or not. **Planned, not yet implemented:** player-owned pets/companions are intended to retain full autonomous AI outside the player's sensory radius once pets exist in the engine.
  - **Scheduler Partitioning (Evaluated, Not Adopted):** An active/dormant scheduler partition (splitting `EnergyScheduler`'s entity storage into separate active/dormant lists to decouple turn-selection cost from dormant population) was implemented and benchmarked on 2026-09-13. At realistic per-floor dormant populations (~30, per `dungeon/spawner.ts`), the measured throughput difference was well under human-perceptible thresholds (sub-millisecond per turn at any tested population up to 500), and the added complexity — six new call sites keeping two lists in sync with `aiState`, one of which was found to desync and produce a real bug — was judged not worth it. Reverted; `EnergyScheduler` uses a single flat entity list. See project history around this date for the full benchmark data before re-attempting this.
  - **Bounded FOV Awakenings:** The FOV manager computes visibility strictly within a bounded radius; monster awakenings and bestiary records evaluate only across the bounding box `[minX..maxX, minY..maxY]` of the player's vision.
  - **Spatial Bucketing:** Entity lookups utilize `O(1)` coordinate bucket maps (`entityBuckets: Map<string, Entity[]>`), guaranteeing constant-time proximity and collision checks regardless of total monster counts.
- **Input Architecture & `ChordBuffer` Mechanics (`src/ui/input/chordBuffer.ts`):**
  - **Sliding-Window Arrow Chording:** Combines orthogonal arrow keypresses within a configurable micro-debounce window (`arrowChordBufferMs`, default ~40ms) into diagonal movement vectors (e.g., Up + Right -> NorthEast).
  - **Keyup-Flush Mechanism:** When an arrow key is released before the debounce timer expires without forming a chord, the buffer immediately flushes the pending cardinal step, eliminating sluggish input latency.
  - **Key-Repeat Bypass:** When an arrow key or active diagonal chord is held down and browser `isRepeat` events fire, the buffer bypasses the micro-debounce timer completely, dispatching continuous movement ticks at the native keyboard repeat rate.
  - **Opposing Direction Reversal:** Pressing opposing keys (e.g., Left while Right is pending) immediately clears the pending move and honors the new vector without dropping keystrokes.
  - **Multi-Scheme Directional Controls:** Built-in first-class support for:
    1. Arrow keys (with micro-debounce chording or instant cardinal mode),
    2. Roguelike Numpad 1-9 (including diagonal keys 7, 9, 1, 3, cardinal keys 8, 2, 4, 6, and center 5 for wait),
    3. Classic Vi keys (HJKL + YUBN),
    4. WASD directional scheme.
  - **Focus & Modal Isolation:** All open modals (inventory, targeting, spellbook, pacts, diagnostics) register on a LIFO `ModalStackManager`. Modal keydown listeners invoke `event.preventDefault()`, preventing keystrokes from bleeding into the game simulation or triggering browser shortcut conflicts.

---

## 7. Build Configuration & Automated Quality Gates
- **Single-File Bundling Architecture:**
  - Build pipeline uses Vite with `vite-plugin-singlefile`.
  - Configured with `assetsInlineLimit: 100000000` (100MB) to inline all spritesheets, audio, fonts, and stylesheets.
  - Post-build plugin transforms module scripts to classic scripts, ensuring zero-CORS offline execution via the `file://` protocol.
- **Automated Quality Gates:**
  Every pull request and local commit must pass automated verification checks before merging:
  1. **Architectural Purity & Boundaries (`npm run check:engine-purity`):**
     - Scans all files across engine, UI, rendering, and content.
     - Enforces zero DOM/Canvas globals (`window`, `document`, `HTMLElement`, `CanvasRenderingContext2D`, `localStorage`, etc.) anywhere reachable from the simulation execution path — `src/engine/**`, plus any `src/content/**` module registered as a handler or hook via the Composition Root (e.g. `src/content/*/hooks.ts`). File location alone does not exempt a module from this check.
     - Enforces zero reverse imports from `src/ui/`, `src/rendering/`, or `src/content/` into `src/engine/**`.
     - Enforces public API integrity: zero deep imports into engine internals from `src/ui/` and `src/rendering/` (all imports must resolve through `src/engine/index.ts`).
  2. **Determinism & PRNG Linting:**
     - Automated static checks enforce that all simulation dice, loot drops, combat calculations, and AI decision trees route through the engine's seeded PRNG (`engine.prng` — the sole canonical accessor; do not introduce alternate names for this). Unseeded `Math.random()` in simulation hot-paths fails CI.
  3. **Schema Evolution Integrity (`npm run validate:schema`):**
     - Automated test harness verifies sequential migrations from schema v1 to current schema (v5), verifying backward compatibility, surface grids, substance grids, corpse items, and PRNG state serialization.
  4. **Headless Chaos Simulation (`npm run sim`):**
     - Executes long-duration headless chaos / monkey runs under pure Node.js, asserting zero invariant violations, zero deadlock conditions, and zero NaN values. Current run lengths and results are whatever `npm run sim`'s latest output reports; this document intentionally does not restate them.
  5. **Static Analysis & Build Verification (`npm test`, `npm run lint`, `npm run build`):**
     - `npm test`: Executes all unit, integration, and chaos test suites. Current suite/test counts are whatever `npm test` reports when run; this document intentionally does not restate them.
     - `npm run lint`: Enforces TypeScript compilation (`tsc --noEmit`) and engine boundary verification (`npm run check:engine-purity`).
     - `npm run build`: Verifies single-file production compilation without type errors or bundler warnings.