# Skill: Adversarial Architectural Audit & Realignment

## Trigger Conditions
Invoke this skill whenever the user asks for a comprehensive codebase audit, architectural review, gap analysis, project health critique, or asks if the project is "on track."

## Scope Note
This skill audits the **code** against ARCHITECTURE.md's current-state claims. It does not check whether ARCHITECTURE.md itself is accurate, internally consistent, or in sync with `.antigravity/rules.md` and the files under `.antigravity/skills/`/`.antigravity/archetypes/` — that is a separate documentation audit. Before flagging a mismatch as a violation, check whether ARCHITECTURE.md already tags that behavior **[Planned: P-NN]**; a planned item is a known gap, not a new finding.

## Analysis Protocol (Phase 1: Read-Only Audit)
1. **Architectural Boundary Inspection:**
   - Scan `src/engine/` for DOM, `window`, `document`, Canvas, audio, or timing-global imports/usage (Headless Purity violation) — also scan any `src/content/` file registered as a manifest hook or handler, since purity is defined by execution path, not file location (ARCHITECTURE.md §2).
   - Scan `src/ui/`, `src/rendering/`, and `src/content/` for deep imports into engine internals beyond `src/engine/index.ts`.
   - Verify `src/engine/` production source has zero imports from `src/content/`, `src/ui/`, or `src/rendering/`. Colocated engine tests (`src/engine/**/__tests__/`) are allowed to import content packs as fixtures — do not flag those.
   - Verify `src/main.ts` is the only source module importing content packs (confirming it as sole Composition Root).
   - Verify all random number generation in simulation code routes through `engine.prng`/`engine.rng`, not `Math.random()` or wall-clock IDs.

2. **Game Systems & Codebase Health:**
   - Check if content additions violate the "No Engine Creep" policy (modifying action pipelines or adding campaign-specific logic to `src/engine/` instead of defining manifests in `src/content/`).
   - Audit action loop latency, garbage collection pressure (allocations inside `tick()`), and spatial index bounds.
   - Inspect save schema coverage: ensure new entity state models are tracked in `migrator.ts` with a new forward-only step and an incremented `CURRENT_SCHEMA_VERSION`.

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
