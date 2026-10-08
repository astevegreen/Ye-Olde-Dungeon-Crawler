# Automated Quality Gates

> What each gate checks, and why it is shaped so; [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §7.2 holds the rules and wins any disagreement, and the scripts win over this file (flag it, §8.2). Run counts and timings are whatever the latest output says.

## Where the Gates Run
- **`npm run gates`:** lint, tests, sim, schema, build, then Playwright (Chromium), stopping at the first failure, and stamps lint and tests. Agents rarely push, so without it Playwright would first run at the owner's push.
- **CI:** `ci.yml` runs lint, tests, sim, schema and build on pull requests to `main`; `deploy.yml` runs the same on a push to `main`, then deploys `dist/` to GitHub Pages; `playwright.yml` builds and runs `e2e/` on pushes and pull requests.
- **Local pre-commit hook:** `.githooks/pre-commit` runs lint and the tests. `npm install` wires the hooks (`prepare` sets `core.hooksPath`); `SKIP_HOOKS=1` bypasses any of them, on the owner's say-so only (§8.4).
  - **Gate stamps** (`scripts/gate-stamp.ts`): the hook skips a gate that already passed on this exact tree; a third of hooked commits had rerun both on a tree where they had just passed. A stamp lives in `.git/gate-stamps/<hash>.json` (per clone, newest 40 kept); the hash covers every tracked and untracked, not-ignored file's content plus the Node version, so any edit, addition or deletion misses.
  - **A stamp caches a pass; it is never an authority.** A tree that can't be fingerprinted runs every gate; a stamp is written only for a pass on a tree byte-identical before and after. `npm run gate-stamp -- run lint test` and `npm run gates` write stamps; a bare `npm run lint` or `npm test` writes none, since a filtered run proves nothing about the tree. `GATE_STAMP=off` ignores stamps. The slow gates are never stamped.
- **Local pre-push hook:** sim, schema, build and Playwright in all three browsers (`PW_ALL_BROWSERS=1`). Commits go straight to `main`, `ci.yml` runs only on pull requests and `deploy.yml` after the push, so without it the slow gates would first run after the code landed.
- **Local commit-msg hook:** rejects a commit staging a protected file unless the message names `§8.1 exception N` (exception 5 needs its reason on the line and never covers `migrator.ts`), and rejects an `Agent: Antigravity` line (§8.4). It warns, never blocks, on a large commit spanning several areas.
- **Line endings:** `.gitattributes` pins LF in the repository and the working tree whatever `core.autocrlf` says, and names `.githooks/**` and `*.sh` explicitly: a CRLF `#!/bin/sh` line breaks the hook, and a mixed tree once made scripts matching `"\n"` silently miss files.

## Playwright
The suite plays the built `dist/index.html` over `file://`. A local run is Chromium only; `CI` or `PW_ALL_BROWSERS` adds Firefox and WebKit, since browser-specific breakage is rarer than logic breakage. Workers are a quarter of the logical cores: at half, Firefox timed out. Specs that start a hero call `e2e/newHero.ts`'s `pastTheOpening`, which ends the opening through the F2 triage API.
- **Gate specs:** `smoke`, `gameplay` (moving, saving, HUD layout, modal focus, the mouse), `exhaustive-playtest` (one hero through most systems), `feedback-and-diagnostics` (F2/F3), `whole-run` (Chromium; three runs to their endings, scenes set by the triage API) and `prologue` (Chromium).
- **Opt-in**, outside every gate (`testIgnore`): `campaign-flow` (`npm run test:campaign`), `gameplay-record` (`npm run test:record`, a video) and `soak` (`SOAK=1`; the `soak` skill, `.claude/skills/soak/SKILL.md`, runs and reads it).

## Static Gates
Each static gate fails when it inspects no files, so a wrong working directory never passes silently. No test writes into `src/`: suites walk it in parallel, and a file deleted mid-walk fails them. A gate's regression test plants its violation in a temp directory and passes `--overlay <tree-path>=<file>` (`scripts/lib/gate-overlays.ts`), which scans the file as though it sat at that path.

### 1. Architectural Purity & Boundaries
`npm run check:engine-purity` (`scripts/check-engine-purity.ts`) scans `src/engine/`, `src/content/`, `src/ui/` and `src/rendering/`.
- **Simulation purity (§2):** engine and content source (tests exempt) names no DOM, browser, timing or audio global (the script lists them), whether or not it registers hooks.
- **Imports (§3):** an import is any specifier a file names (`import`, `export … from`, side-effect, dynamic or type-position `import()`, `require`); a specifier computed at run time is invisible. The engine imports no presentation, and its production source no content; content imports no presentation and no engine deep path; presentation, `src/main.ts` and `src/main/**` import the engine only through its index, and only `src/main.ts` may import a pack. `purityGatePatterns.test.ts` and `mainScopeGateWidening.test.ts` plant each form.
- **Randomness and the clock (§7.2):** fails on `Math.random`, `crypto` randomness, `Date.now()` and an argument-less `new Date()` in engine and content source. Presentation may jitter particles (`fxRunner.ts`). A `// purity-allow: <reason>` pragma marks an entropy-boundary line; timestamps are allowlisted per file in `scripts/purity-clock-allowlist.json`.

**Engine encapsulation** (`npm run check:engine-encapsulation`): the type checker matches a write by the class declaring the member, not by variable name.
- In presentation, `src/main/**` and content (tests exempt): no assignment, `++`/`--`, `delete` or index write to an engine class member, including through a cast or a local alias the cast initialises, and no `Object.assign`, `Reflect.set` or `Object.defineProperty` onto one; no write into a plain object reached through an engine member (`NESTED_WRITE`).
- In presentation only: no call into an internal subsystem (`GameMap`, `Container`, `StatusManager`, …) unless its name reads as a query (`get`, `is`, `has`, `find`, …). Deny by default: a list of mutator verbs missed `consolidateCoins` and `triggerDeath`.
- Sanctioned writes carry reasons in `scripts/engine-encapsulation-allowlist.json`. Not traced: a write through a local alias of a member's value.

**Engine creep** (`npm run check:engine-creep`): loads every pack's `index.ts`, collects every id, NPC name, quest reference and `…flag` string it declares, and fails when engine production source or presentation names one as a literal, template segment, object key or, for an underscored id, inside a longer string. Presentation also fails on a `'<packId>:` prefix. Engine-enum vocabulary a pack restates is not collected; overlaps carry reasons in `scripts/engine-creep-allowlist.json`.

**UI palette ratchet** (`npm run check:ui-palette`): each presentation file's and `index.html`'s net color-literal count against `scripts/ui-palette-baseline.json`. A rise fails, and so does a fall until `-- --update` lowers the baseline, so it only turns down.

Every allowlist fails on a stale entry.

### 2. Determinism & PRNG Discipline
Outcomes and generated ids (`GameEngine.nextSimulationId`) draw from `engine.prng`, and `rng` parameters are required, never defaulted, so a seed replays exactly. The clock is read once per run, outside the simulation: `ProfileManager.createCharacter` seeds the run PRNG (`options.seed` when given) for the starting kit and the engine. Save timestamps and profile ids stay on the clock: seeded profile ids would collide for two heroes made from one seed.

### 3. Schema Evolution Integrity
`npm run validate:schema` (`scripts/validate-schema.ts`) passes a current-version save through unmigrated, checks a save below the floor is refused, and runs a probe `N -> N+1` step so the migration machinery stays exercised (§5). It round-trips a live engine through `serializeGame`, `JSON.stringify`/`parse` and `deserializeGame`, since saves persist as strings, and checks surfaces, ground items and PRNG state survive; PRNG states compare int32-normalized, plus the next draw. Per-step assertions live in `migrator.test.ts`.

### 4. Headless Simulation
`npm run sim` (`scripts/headless-sim.ts`) takes its populations from real generated cotw floors (several floors and seeds, base and pact-boosted densities), not a hard-coded count, then runs a dormant floor, an awake floor and a 1,000-cast workload. It fails on a rejected action, a caught pipeline exception, a broken actor invariant at its 100-turn checkpoints (a non-finite scalar, an actor out of bounds, a duplicate id), a deadlock (six successful player actions that don't advance the turn) or a median over its wall-clock budget; budgets live here, never in `npm test`. `--inject-error` shows the failure path. The long chaos simulation is `chaosSimulation.test.ts`, under `npm test`.

### 5. Static Analysis & Build
- **`npm test`:** every Vitest suite, including `docReferences.test.ts`: a cited `§N` or `P-NN` that doesn't exist, a `[Planned: P-NN]` with no §9 entry, a relative doc link to a missing file, and root markdown other than `ARCHITECTURE.md` and `CLAUDE.md` all fail.
  - **One module graph per worker** (`isolate: false`, half the wall time): a file puts back the process state it changes, and `tests/setup/sharedState.ts` fails one that leaves fixtures in the default registries. `npx vitest run --isolate` tells a leak from a real failure.
- **`npm run lint`:** `tsc` over the main include set, then over `e2e/` with its own tsconfig (Playwright strips types without checking them), then the `check:*` scripts above and `knip`. knip's entries are `src/main.ts`, the scripts, the relay and the tests, so an export nothing reaches fails, dead engine API included; `npx knip --production` lists exports only tests use, which should be deliberate seams. knip doesn't see unused class members.
- **`npm run build`:** `tsc && vite build`, the cotw single file, with no type errors or bundler warnings.
