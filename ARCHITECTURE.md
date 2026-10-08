# Architectural Specification & Engine Invariants

> Binding invariants, imported into every session by `CLAUDE.md`; code and agent files cite the section numbers, so never renumber.
> Sub-docs (`docs/architecture/**`) explain the design; ADRs (`docs/decisions/**`) record rejected designs; a **[Planned]** or **[Deferred]** tag marks work not yet built (§9).

### Routing Table — What Else To Read
| Touches... | Also read |
|---|---|
| `src/content/`, pack art and theme | [content-extensibility.md](docs/architecture/content-extensibility.md) |
| `src/engine/storage/` | [storage-and-schema.md](docs/architecture/storage-and-schema.md) |
| Scheduler, FOV, input, modals | [simulation-and-input.md](docs/architecture/simulation-and-input.md) |
| `scripts/check-*.ts`, CI, `.githooks/` | [quality-gates.md](docs/architecture/quality-gates.md) |
| Redoing a past design | [docs/decisions/](docs/decisions/) |

## 1. Game Concept & Core Simulation Loops
- **Vision & Genre:** a turn-based, grid-based roguelike dungeon crawler inspired by *Castle of the Winds*, whose campaigns and themes come as content packs. Shipping pack: `src/content/cotw/`. A new pack needs no engine change beyond generic capabilities (§3, No Engine Creep); the test-only `tests/fixtures/fixture-pack/` is the second pack that proves it, and the retired *WarCraft* pack is kept at git tag `warcraft-parked`.

## 2. System Boundaries & Tech Stack Invariants
- **Build Target:** TypeScript, Vite and `vite-plugin-singlefile`: one offline, zero-dependency HTML file per content pack, picked by Vite mode (`VITE_THEME`); a mode no pack's `id` matches throws at startup (§7.1).
- **Execution-Path Headless Simulation Purity:** anything run inside the simulation (engine, content, runtime-registered callbacks) touches no DOM, Canvas, audio or timing globals, and its outcomes are deterministic (§7.2).
- **Public API Surface Integrity:** `src/ui/`, `src/rendering/` and `src/content/` import the engine only through `src/engine/index.ts` (`check:engine-purity`); test files and `scripts/` may deep-import.
- **Diagnostic API Namespacing & Triage Access:** triage methods live under `engine.diagnostics`; presentation calls them and never writes engine state. The F2 triage menu is a deliberate player feature, always reachable.
- **Bug-Report Replay:** player actions are recorded after action-boundary checkpoints, and checkpoint + trail replay deterministically (`src/engine/debug/replay.ts`, [ADR-0007](docs/decisions/0007-bug-report-replay-and-triage-api.md)).

## 3. Directory Layout, Module Topology & Dependency Inversion
| Layer | Owns | Imports |
|---|---|---|
| `src/main.ts` | Composition root: picks the pack, builds presentation and engines, wires callbacks | Every layer; the **only** importer of content packs |
| `src/main/` | Composition-root helpers (`commandCatalog.ts`) | As presentation: never `src/content/` |
| `src/content/` | Content packs | The engine via its index; at runtime, only through `GameContentManifest` |
| `src/engine/` | Headless simulation | Never `src/content/`, `src/ui/`, `src/rendering/` or the browser (colocated tests may use content as fixtures) |
| `src/rendering/` | Canvas, effect playback (`fxRunner.ts`), keyboard dispatch (`input-handler.ts`) | The engine via its index; `src/ui/` |
| `src/ui/` | DOM HUD, modal stack, chord buffer, settings | The engine via its index; `src/rendering/` types only |
| `scripts/`, `tests/`, `e2e/` | Checks, tooling, Vitest suites, the fixture pack, Playwright | Not bundled; may deep-import the engine |
| `relay/` | F3 bug-report relay, a Cloudflare Worker (`relay/README.md`) | Nothing from `src/`; not bundled |

### Module Import Hierarchy
```
               src/main.ts (composition root: every layer)
               │                          │
               ▼                          ▼
   presentation (+ src/main/)        src/content/
   rendering ──► ui                       │
   ui ┄types┄► rendering                  │
               │ src/engine/index.ts only │
               ▼                          ▼
               src/engine/ (headless simulation)
```

### Content Extensibility Model
- **Declarative Manifests:** a pack exports a `GameContentManifest` (`src/engine/types/manifest.ts`), registered by the `GameEngine` constructor, and builds behavior from composable primitives.
- **Exactly two hook mechanisms:** (1) action hooks (`manifest.actionHooks`): priority-ordered `pre`/`post` around pipeline actions; a pre-hook may short-circuit with its own `ActionResult`. (2) Event hooks (`HookDispatcher`): `HookDescriptor` data on items and monsters, acting through a built-in `ActionPrimitive`. Status handlers, AI strategies and effect primitives are registries; there are no global hooks and no API to register a primitive.
- **Injected context, never the raw engine:** hook handlers receive `EngineContext`, widened one deliberate member at a time (each joins the content-facing contract). Status handlers and AI strategies receive `GameEngine`.
- **No Engine Creep:** campaign-specific mechanics, names and narrative live in `src/content/`; the engine changes only to gain a generic capability packs then use (§7.2).
- **Pack-Neutral Presentation:** `src/ui/`, `src/rendering/` and `src/main/**` name no pack. Wording, art, colors and fonts come from the manifest and the pack's theme tokens; presentation names roles (`var(--ui-accent)`), never hues.
  Its color literals only go down (§7.2). Sourcing and ADR-0011: [content-extensibility.md](docs/architecture/content-extensibility.md#pack-neutral-presentation).

## 4. Action Pipeline & Domain Event Contract
- **Contract of `actionPipeline.ts`:** `executeWithHooks(action, engine)` returns the `ActionResult` of `src/engine/types.ts`:
  ```typescript
  export interface ActionResult {
    success: boolean;
    cost: number; // energy spent; 0 when rejected
    message?: string;
    effects?: VisualEffectDescriptor[];
    events?: GameEvent[]; // emitted while it ran, in order
    pipelineError?: boolean; // an exception was caught and isolated
  }
  ```
  A player action advances the world exactly when it spends energy (`cost > 0`), success or not.
- **Pipeline Coverage:** player actions (`engine.handlePlayerAction()`, command-bus actions and rest steps included) and monster turns go through `executeWithHooks()`, so hooks fire for every actor; a monster action that is short-circuited or fails falls back to `WaitAction`. Sub-actions run inside the outer action's boundary; hooks match only the outer one. Outside it: a stunned hero's forced pass, bookkeeping commands, per-turn environmental updates.
- **Failure Isolation:** one failure never stops a turn. Each boundary catches, records (flight recorder, `recordIsolatedFailure`) and carries on:
  `executeWithHooks()` (always a valid `ActionResult`, `pipelineError: true`); each monster turn, its energy spent; each environmental and FOV update; each inline presentation callback.
  Backstop: `src/main.ts`'s `window` error handlers record and show the crash dialog.
  Presentation reports `pipelineError` through `DiagnosticModal.showError` without locking game state.
- **Domain Events (`GameEvent`):** a `GameEventBase` envelope (`type`, `turn`, optional IDs, a flat `data` bag) with scalar payloads only, so every event survives `JSON.stringify`. `type` is open: packs emit their own (`cotw:relic_attuned`) beside `BuiltInGameEventType`. `engine.emitGameEvent()` delivers via `engine.onGameEvent` and returns events on `ActionResult.events`.
- **Animation Gating:** tactical effects (`isTacticalEffect`: projectiles, beams, bursts) hold gameplay input while they play; ambient ones never do.
  The diagnostics toggle and open modals always receive input.

## 5. State Normalization, Storage & Schema Evolution
*History: [ADR-0002](docs/decisions/0002-v0-v11-migration-chain-deletion.md).*
- **Reference Invariant:** persistent state holds no live circular references; relationships use scalar IDs (`parentId`, `ownerId`).
- **Forward-Only Schema Migrations (`migrator.ts`, §8.1):** its `CURRENT_SCHEMA_VERSION` is authoritative. A breaking save-format change increments it and adds exactly one forward-only `N -> N+1` step; existing steps change only as a confirmed bug fix.
- **Version floor:** the current version is the oldest readable one: a save below it is refused (`migration-failed`), never mis-decoded. No path is added below the floor; deleting migration history needs §8.1 exception 4.
- **Load Failure Handling:** a failed load never yields a partly loaded engine nor overwrites the stored payload; `load*Result()` returns a typed `LoadOutcome`, not a throw.
- **Death Is Final for the Dead State:** a dead hero's state is never saved as loadable; death updates only the roster (`questStatus: 'fallen'`), and Continue never resumes a fallen run.
- **Autosave Never Erases Deeper Progress:** before overwriting, `AutosaveManager.autosave` moves an autosave that belongs to another hero, or is deeper, to a preserved slot.

## 6. Simulation Scoping & Input Architecture
*History: [ADR-0001](docs/decisions/0001-scheduler-partitioning-evaluated-not-adopted.md) (scheduler partitioning).*
- **Bounded Simulation Scoping:** only the active floor is simulated. Per-actor work (AI, pathfinding, combat, awakening and bestiary checks) is bounded by dormant-actor short-circuiting and bounded FOV; a lit floor (`GameMap.lit`) is seen to the line of sight, but wakes monsters only within the hero's own radius. `EnergyScheduler` stays linear in the floor's actor count: a partition was rejected on measured evidence.
- **Focus & Modal Isolation:** every open modal sits on the LIFO `ModalStackManager`: the top one gets every key, unhandled `Escape` pops it, and nothing reaches the simulation. A modal with a `focusRoot` keeps focus and Tab inside it; closing the last returns focus to where it was.
- **Input ownership:** `InputHandler` owns the `window` key and blur listeners, `ModalStackManager` and `ChordBuffer`.

## 7. Build Configuration & Automated Quality Gates

### 7.1 Single-File Bundling Architecture
Every asset is inlined into the one HTML file, and a post-build plugin rewrites module scripts to classic ones so bundles run under `file://`.
Deploys build with `SOURCEMAP=hidden`: maps never ship, and are kept as the `sourcemaps-<sha>` workflow artifact for `npm run map:stack`.

### 7.2 Automated Quality Gates
Every change passes the gates, with real output reported: `npm run lint` (`tsc`, the `check:*` scripts, `knip`), `npm test`, `npm run sim`, `npm run validate:schema`, `npm run build`. `pre-commit` runs lint and tests, `pre-push` the rest plus Playwright; CI repeats them.

**Invariants the gates enforce** (allowlist entries carry a reason; stale ones fail):
- **Engine encapsulation:** code outside `src/engine/` never writes engine object fields, casts included; presentation changes engine state only through `GameEngine`/`Player`/`Entity` methods or `engine.commandBus`.
- **No engine-creep literals / Pack-neutral presentation:** engine and presentation source (bar `src/main.ts`) name no pack-declared identifier; presentation holds no `'<packId>:` literal.
- **UI palette ratchet:** color-literal counts in presentation and `index.html` only go down.
- **PRNG discipline:** `engine.prng` is canonical, `engine.rng` its one delegate; simulation uses no `Math.random()`, `Date.now()`, `crypto` randomness or bare `new Date()`.

## 8. Change Control

### 8.1 Protected Files
`src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts` and `src/engine/storage/migrator.ts` change only under one of these exceptions, named in the commit message as `§8.1 exception N` (the `commit-msg` hook checks). Keep such diffs minimal and scoped.
1. **Confirmed bug fix:** a reproducible defect, shown by a failing test or a documented reproduction.
2. **Additive schema migration:** a new forward-only step plus a `CURRENT_SCHEMA_VERSION` increment (§5).
3. **Requested planned item:** a §9 item the task explicitly requests.
4. **Owner-authorized change:** the owner authorizes a named, narrowly scoped change in the task itself, and the commit quotes it. An agent never infers this.
5. **Stated reason (`engine.ts`, `actionPipeline.ts` only):** `§8.1 exception 5: <why it can't live outside the file>`. Never `migrator.ts`: a save-format change is the owner's product decision.

### 8.2 Documentation Synchronization
- This file changes with the invariant it states, in the same commit.
- Sub-docs describe the design and change with it, not when a feature lands.
- An ADR records a design built and rejected on evidence, or a choice a future agent would plausibly undo; nothing else.
- Where `CLAUDE.md` or `.agents/` disagree with this file, flag the conflict instead of picking a side.

### 8.3 Working With Planned Items
Implement a planned item (§9) only when the task names it; when one lands, delete its tags and §9 entry and retire its ID.

### 8.4 Agent Workflow
Claude Code alone writes here: it commits, and pushes when the owner asks. Antigravity is read-only; its reports (`.prompts/antigravity/`) are checked against the code before use.
- **Agent instructions:** `CLAUDE.md` (importing this file) for Claude Code; `.agents/rules/*.md` and `.agents/skills/*/SKILL.md` for Antigravity.
- **No Antigravity commits:** `commit-msg` rejects an `Agent: Antigravity` line (a tripwire: both tools commit as one git user).
- **Owner's request:** a commit doing what the owner asked carries `Requested: "<the ask>"`, quoting the owner; review treats requested behavior as intended.
- **One request per commit.** Hooks are bypassed only on the owner's explicit say-so.

### 8.5 Repository Files
- **Root markdown:** exactly `ARCHITECTURE.md` and `CLAUDE.md` (`docReferences.test.ts`). Scratch notes go in the gitignored `/.prompts/`.
- **LF line endings:** every text file, working tree included (`.gitattributes`); a CRLF hook breaks its `#!/bin/sh` line.

## 9. Planned Work Register
No planned work. A finished item's ID is retired, never reused: P-01–P-23, P-25, P-26. **Next free ID: P-28.** Deferred items are recorded, not planned; picking one up is the owner's call.

**P-24 — Radial Action Menu: gamepad invocation** — Deferred 2026-09-15
- The radial menu exists as the companion wheel (`src/rendering/radialMenu.ts`); gamepad support waits until the game is feature-complete.
- If revisited: a button-hold opens it and the stick picks a wedge, inside `src/rendering/`.

**P-27 — Locked doors: lockpicking and bashing** — Parked 2026-10-07
- `TileDefinition.locked`, the lockpick roll and `BashDoorAction` (`src/engine/actions/door.ts`) exist and are tested, but no door is ever locked.
- If revisited: a pack marks doors locked, input binds Bash, and a failed bash or lockpick is a turn (§4).
