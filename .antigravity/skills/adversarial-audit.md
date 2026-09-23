# Skill: Adversarial Architectural Audit & Realignment

## Trigger Conditions
Invoke this skill whenever the user asks for a comprehensive codebase audit, architectural review, gap analysis, project health critique, or asks if the project is "on track."

## Scope Note
This skill audits the **code** against ARCHITECTURE.md's current-state claims. It does not check whether ARCHITECTURE.md itself is accurate, internally consistent, or in sync with `.antigravity/rules.md` and the files under `.antigravity/skills/`/`.antigravity/archetypes/` — that is a separate documentation audit. Before flagging a mismatch as a violation, check whether ARCHITECTURE.md already tags that behavior **[Planned: P-NN]**; a planned item is a known gap, not a new finding. Likewise, re-propose a design recorded as rejected under `docs/decisions/` — notably ADR-0001, *Scheduler Partitioning* (splitting `EnergyScheduler` into active/dormant lists) — only with new evidence the recorded evaluation did not cover (for example, a measured `npm run sim` regression at realistic populations), and cite that evidence in the finding.

## Analysis Protocol (Phase 1: Read-Only Audit)
1. **Architectural Boundary Inspection:**
   - Scan `src/engine/` for DOM, `window`, `document`, Canvas, audio, or timing-global imports/usage (Headless Purity violation) — also scan all `src/content/` source, whether or not a file is registered as a manifest hook or handler, and any callback injected into the simulation at runtime, since purity is defined by execution path, not file location (ARCHITECTURE.md §2, §7.2).
   - Scan `src/ui/`, `src/rendering/`, and `src/content/` for deep imports into engine internals beyond `src/engine/index.ts`.
   - Verify `src/engine/` production source has zero imports from `src/content/`, `src/ui/`, or `src/rendering/`. Colocated engine tests (`src/engine/**/__tests__/`) are allowed to import content packs as fixtures — do not flag those.
   - Verify `src/main.ts` is the only source module importing content packs (confirming it as sole Composition Root).
   - Verify all random number generation in simulation code routes through `engine.prng`/`engine.rng`, not `Math.random()` or wall-clock IDs.
   - Do not report sanctioned dynamic wiring as a violation in itself:
     - writes listed with a reason in `scripts/engine-encapsulation-allowlist.json` (composition-root `engine.on*` callback slots; content AI strategies publishing `Monster.intent`), which `npm run check:engine-encapsulation` already verifies;
     - behavior registered at runtime through the `GameContentManifest` or engine registries (action hooks, `HookDispatcher.registerPrimitive` primitives, status handlers, AI strategies — ARCHITECTURE.md §3);
     - handlers acting on the engine through their injected context (§3), including content calling engine subsystem methods (§7.2 exempts content from the subsystem-mutator rule).
     Flag such code only when its body breaks an unmarked invariant (e.g. a DOM or timing global on the execution path), or when an allowlist entry has no stated reason.

2. **Game Systems & Codebase Health:**
   - Check if content additions violate the "No Engine Creep" policy (modifying action pipelines or adding campaign-specific logic to `src/engine/` instead of defining manifests in `src/content/`).
   - Audit action loop latency, garbage collection pressure (allocations inside `tick()`), and spatial index bounds.
   - Inspect save schema coverage: ensure every *breaking* save-format change increments `CURRENT_SCHEMA_VERSION` and registers exactly one new forward-only step in `migrator.ts` (ARCHITECTURE.md §5). Do not flag a new state model as missing a migration when it rides entirely on already-serialized structures (e.g. renown on `WorldState.counters`/`flags`, §3), which needs no step.

3. **Deliverable - The Adversarial Audit Report:**
   Output a structured critique formatted into:
   - **Critical Vulnerabilities:** Violations of ARCHITECTURE.md invariants (unmarked statements only — not gaps already tagged **[Planned]**).
   - **Architectural Debt & Smells:** Anti-patterns, leaky abstractions, or tightly coupled logic.
   - **Divergence from Core Vision:** Areas where gameplay or system flow deviates from the roguelike specification.
   - **Itemized Remediation Plan:** A step-by-step proposal ordered by priority (P0, P1, P2). Cross-reference existing Planned Work items (§9) instead of duplicating them.

4. **Hard Stopping Gate:**
   - **DO NOT MODIFY CODE IN THIS PHASE.**
   - Conclude Phase 1 with: *"Awaiting explicit approval to execute this remediation plan. Confirm to proceed or specify adjustments."*

## Execution Protocol (Phase 2: Remediation & Verification)
Only proceed after the user explicitly approves the remediation plan:
1. Implement fixes incrementally according to the approved plan. Respect ARCHITECTURE.md §8.1 (protected files) and §8.3 (working with planned items) throughout.
2. Run validation gates after changes:
   - `npm run lint` (Typechecking & static boundary verification)
   - `npm test` (Unit, integration, and chaos regression pass)
   - `npm run sim` (Headless turn loop pass)
   - `npm run validate:schema` (Forward schema migration pass)
   - `npm run build` (Single-file offline bundle verification) — use `npm run build:all` if the change touched `vite.config.ts`, theme selection, or manifest wiring.
3. If any remediation completed a Planned Work item, update ARCHITECTURE.md in the same change: remove its **[Planned]** tags and delete it from §9 (§8.2).
4. Report final diff summary and test results back to the user.
