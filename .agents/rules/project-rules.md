---
trigger: always_on
---

# Project Rules & Invariants

`ARCHITECTURE.md` (repo root) is the authoritative architecture spec. This file summarizes it for enforcement; it does not replace it. Section numbers below (§N) refer to `ARCHITECTURE.md`. If this file, a skill, or a persona rule ever disagrees with `ARCHITECTURE.md`, stop and flag the conflict to the user — do not silently pick a side.

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
You commit — and push when the owner asks — on your own; Claude Code reviews every commit after the fact. So each commit must say who wrote it, what the owner asked for, and nothing else:
- **Attribution:** end every commit message with the trailer `Agent: Antigravity`. The `commit-msg` hook rejects a commit without one.
- **Owner's request:** when the owner asked for the change, add a trailer quoting the ask, e.g. `Requested: "rename coins to Gold Coins, show stacks as (5x)"`. The reviewer treats requested behavior as intended and checks only that it is done correctly; an unrequested behavior change gets flagged. Changes you chose yourself (a fix you found, a refactor) carry no `Requested:` trailer.
- **One request per commit:** a separate commit for each distinct request or fix. Never bundle unrelated work, transcripts, or generated notes into a feature commit.
- **Engine source** (`src/engine/` outside tests) may be committed like any other code. The three §8.1 protected files still need `§8.1 exception N` in the message (hook-enforced).
- **Push** when the owner asks. The `pre-push` hook runs the full gates; never bypass hooks (`--no-verify`, `SKIP_HOOKS=1`) unless the owner explicitly says to for that push.
- **Never move the `verified` tag** — it marks what Claude Code has reviewed.
- Describe the change in the commit subject: a feature is titled as a feature, a refactor as a refactor.

## Verification Gates (§7.2)
Before reporting a change complete, run these and report the real output:
- `npm run lint` (type-check, `check:engine-purity`, `check:engine-encapsulation`, `check:engine-creep`, and `knip` dead-code analysis)
- `npm test`
- `npm run sim`
- `npm run validate:schema`
- `npm run build` — use `npm run build:all` when changing `vite.config.ts`, theme selection, or manifest wiring.

## Personas & Skills
Persona rules live in `.agents/rules/persona-*.md`; skills in `.agents/skills/<name>/SKILL.md`. When a prompt starts with a tag, adopt that file. Neither ever overrides the invariants above.
- `[Auditor]` -> skill `adversarial-audit`: adversarial critique, a prioritized plan, and approval before modifying code.
- `[Designer]` -> `persona-designer.md`: confine edits to `src/content/`; import the engine only via `src/engine/index.ts`.
- `[Guardian]` -> `persona-guardian.md`: execution-path headless purity (including content hooks), determinism, and Vitest coverage.
- `[UI]` -> `persona-ui-specialist.md`: Canvas rendering, `src/rendering/input-handler.ts`, `src/ui/input/chordBuffer.ts`, and DOM modals. Triage and inspection features (god mode, spawning, map reveal) go through `engine.diagnostics` methods (§2) — never direct engine-state writes from `src/ui/` or `src/rendering/`.
