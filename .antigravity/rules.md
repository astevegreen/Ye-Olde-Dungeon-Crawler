# Project Rules & Invariants

`ARCHITECTURE.md` (repo root) is the authoritative architecture spec. This file summarizes it for enforcement; it does not replace it. Section numbers below (§N) refer to `ARCHITECTURE.md`. If this file, a skill, or an archetype ever disagrees with `ARCHITECTURE.md`, stop and flag the conflict to the user — do not silently pick a side.

## Before Editing Code
1. Read `ARCHITECTURE.md` in full before any structural change: new files, new dependencies between `src/engine/`, `src/content/`, `src/ui/`, `src/rendering/`, or `src/main/`, or edits to protected files. It is kept small on purpose and carries its own routing table — use it to find the right `docs/architecture/**` sub-doc for the area you're touching (content packs, storage/schema, simulation/input, or quality gates) before you start.
2. Respect status markers. Text tagged **[Planned: P-NN]** describes future work, not existing code. Never call APIs or rely on behavior it describes. Implement a planned item only when the task explicitly requests it (§8.3).
3. Do not widen the gap to a planned target. For example: no new deep engine imports from content, no new `Math.random()` in simulation code, and no new modals that bypass `ModalStackManager`.
4. No ephemeral task or prompt markdown at the repo root. Working prompts go in `/.prompts/` (gitignored) or outside the repo — the root holds exactly `ARCHITECTURE.md` and `CLAUDE.md`.

## Invariants
One line each; the cited section holds the full rule and its enforcement. The lint gate checks most of them, so a clean `npm run lint` is necessary but not sufficient.
- **Headless purity (§2):** code on the simulation path — engine, content hooks and handlers, injected callbacks — uses no DOM, Canvas, audio, or timing globals.
- **Imports (§2, §3):** the engine imports no other layer; `src/ui/`, `src/rendering/`, and `src/content/` reach the engine only through `src/engine/index.ts`; only `src/main.ts` imports content packs; `src/ui/` imports `src/rendering/` types only.
- **No engine creep (§3):** campaign mechanics, names, and narrative live in `src/content/`; `src/engine/` gains only generic capabilities (primitive, hook point, registry, manifest field).
- **Pack-neutral presentation (§3):** `src/ui/`, `src/rendering/`, and `src/main/**` name no pack; pack wording comes from the manifest (`name`, `description`, `town.name`, `branding`) and pack art from `spriteRecipes`.
- **Determinism (§7.2):** simulation randomness and IDs come from `engine.prng`/`engine.rng`, never `Math.random()` or `Date.now()`.
- **Encapsulation (§7.2):** outside `src/engine/`, change engine state through `GameEngine`/`Player`/`Entity` methods or `engine.commandBus`, never by writing engine fields; allowlist entries need a stated reason.
- **Save format (§5):** a breaking save-format change bumps `CURRENT_SCHEMA_VERSION` with exactly one forward-only step in `migrator.ts`; a dead player's state is never saved.
- **Protected files (§8.1):** `actionPipeline.ts`, `engine.ts`, and `migrator.ts` change only under a §8.1 exception, named in the commit message as `§8.1 exception N`. Exception 4 applies only when the owner's own words in the task authorize that specific change.
- **Documentation sync (§8.2):** a change that makes `ARCHITECTURE.md` or a `docs/architecture/**` sub-doc inaccurate updates that document in the same change. A new Planned Work item takes the "Next free ID" in §9.

## Workflow (§8.4)
- End every commit message with the trailer `Agent: Antigravity`.
- Commit changes to `src/content/`, `src/ui/`, `src/rendering/`, tests, and docs yourself.
- Leave any change to engine production source (`src/engine/` outside tests) uncommitted, and tell the owner it needs Claude Code review. This includes a new generic engine capability that content work needs.
- Describe the change in the commit subject: a feature is titled as a feature, a refactor as a refactor.

## Verification Gates (§7.2)
Before reporting a change complete, run these and report the real output:
- `npm run lint` (type-check, `check:engine-purity`, `check:engine-encapsulation`, `check:engine-creep`, and `knip` dead-code analysis)
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
