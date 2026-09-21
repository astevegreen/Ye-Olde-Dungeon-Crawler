# Project Rules & Invariants

`ARCHITECTURE.md` (repo root) is the authoritative architecture spec. This file summarizes it for enforcement; it does not replace it. Section numbers below (§N) refer to `ARCHITECTURE.md`. If this file, a skill, or an archetype ever disagrees with `ARCHITECTURE.md`, stop and flag the conflict to the user — do not silently pick a side.

## Before Editing Code
1. Read `ARCHITECTURE.md` in full before any structural change: new files, new dependencies between `src/engine/`, `src/content/`, `src/ui/`, `src/rendering/`, or `src/main/`, or edits to protected files. It is kept small on purpose and carries its own routing table — use it to find the right `docs/architecture/**` sub-doc for the area you're touching (content packs, storage/schema, simulation/input, or quality gates) before you start.
2. Respect status markers. Text tagged **[Planned: P-NN]** describes future work, not existing code. Never call APIs or rely on behavior it describes. Implement a planned item only when the task explicitly requests it (§8.3).
3. Do not widen the gap to a planned target. For example: no new deep engine imports from content, no new `Math.random()` in simulation code, and no new modals that bypass `ModalStackManager`.
4. No ephemeral task or prompt markdown at the repo root. Working prompts go in `/.prompts/` (gitignored) or outside the repo — the root holds exactly `ARCHITECTURE.md` and `CLAUDE.md`.

## Invariants
- **Headless purity by execution path (§2):** any code that runs inside the simulation — engine code, content hooks and handlers, injected callbacks — uses no DOM, Canvas, audio, or timing globals.
- **Dependency inversion (§3):** engine production source never imports `src/content/`, `src/ui/`, or `src/rendering/`. Colocated engine tests may import content packs as fixtures.
- **Public API (§2, §3):** `src/ui/`, `src/rendering/`, and `src/content/` import the engine only through `src/engine/index.ts`. `scripts/` and test files may deep-import.
- **Composition root (§3):** `src/main.ts` is the only source module that imports content packs.
- **Presentation tier (§3):** `src/rendering/` may import `src/ui/`; `src/ui/` may import `src/rendering/` types only.
- **No engine creep (§3):** campaign-specific mechanics, items, monsters, quests, and narrative belong in `src/content/`. Change `src/engine/` only to add a generic, reusable capability (primitive, hook point, registry, or manifest field) that content then uses.
- **Determinism (§7.2):** simulation randomness comes from `engine.prng` (`engine.rng` is its bound delegate). Never use `Math.random()` or `Date.now()` for simulation outcomes or IDs.
- **Save format (§5):** any breaking save-format change increments `CURRENT_SCHEMA_VERSION` and adds exactly one forward-only step in `migrator.ts`.
- **Protected files (§8.1):** modify `src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts`, and `src/engine/storage/migrator.ts` only for (1) a confirmed bug fix, (2) an additive migration step, or (3) an explicitly requested planned item. State which exception applies.
- **Documentation sync (§8.2):** if a change makes `ARCHITECTURE.md` inaccurate or completes a planned item, update `ARCHITECTURE.md` in the same change.
- **Encapsulation (§7.2):** code outside `src/engine/` (presentation and content alike) never writes engine object fields directly — no assignment, index write, write through an `as any` cast, or `Object.assign` onto an engine object. Presentation code (`src/ui/`, `src/rendering/`, `src/main.ts`) additionally changes engine state only through `GameEngine`, `Player`, and `Entity` methods or `engine.commandBus` — never by calling mutators on internal subsystems (`GameMap`, `Container`, `InventoryManager`, …) or Array/Map/Set mutators on engine members. That subsystem-mutator restriction does not apply to `src/content/` (§7.2). `check:engine-encapsulation` enforces all of this; add to its allowlist only with a stated reason.

## Verification Gates (§7.2)
Before reporting a change complete, run these and report the real output:
- `npm run lint` (type-check, `check:engine-purity`, and `check:engine-encapsulation`)
- `npm test`
- `npm run sim`
- `npm run validate:schema`
- `npm run build` — use `npm run build:all` when changing `vite.config.ts`, theme selection, or manifest wiring.

## Sub-Agent Persona Triggers
If a prompt starts with one of these tags, adopt that persona's rules from `.antigravity/archetypes/` or `.antigravity/skills/`. Persona files never override the invariants above.
- `[Auditor]` -> Adopt `.antigravity/skills/adversarial-audit.md`. Perform an adversarial critique, produce a prioritized plan, and await approval before modifying code.
- `[Designer]` -> Adopt `.antigravity/archetypes/designer.md`. Confine edits to `src/content/`; import the engine only via `src/engine/index.ts`.
- `[Guardian]` -> Adopt `.antigravity/archetypes/guardian.md`. Focus on execution-path headless purity (including content hooks), determinism, and Vitest coverage.
- `[UI]` -> Adopt `.antigravity/archetypes/ui-specialist.md`. Focus on Canvas rendering, `src/rendering/input-handler.ts`, `src/ui/input/chordBuffer.ts`, and DOM modals. Triage and inspection features (god mode, spawning, map reveal) go through `engine.diagnostics` methods (§2) — never implemented as direct engine-state writes from `src/ui/` or `src/rendering/`.
