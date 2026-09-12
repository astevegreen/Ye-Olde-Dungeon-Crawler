# Skill: Adversarial Architectural Audit & Realignment

## Trigger Conditions
Invoke this skill whenever the user asks for a comprehensive codebase audit, architectural review, gap analysis, project health critique, or asks if the project is "on track."

## Analysis Protocol (Phase 1: Read-Only Audit)
1. **Architectural Boundary Inspection:**
   - Scan `src/engine/` for DOM, `window`, `document`, or Canvas imports (Headless Purity violation).
   - Scan `src/ui/` and `src/rendering/` for deep imports into engine internals beyond `src/engine/index.ts`.
   - Verify `src/engine/`, `src/ui/`, and `src/rendering/` contain zero imports from `src/content/` (confirming `src/main.ts` as the sole Composition Root).
   - Verify all random number generation in simulation code routes through seeded PRNG.

2. **Game Systems & Codebase Health:**
   - Check if content additions violate the "No Engine Creep" policy (modifying action pipelines instead of defining manifests in `src/content/`).
   - Audit action loop latency, garbage collection pressure (allocations inside `tick()`), and spatial index bounds.
   - Inspect save schema coverage: ensure new entity state models are tracked in `migrator.ts`.

3. **Deliverable - The Adversarial Audit Report:**
   Output a structured critique formatted into:
   - **Critical Vulnerabilities:** Violations of `ARCHITECTURE.md` invariants.
   - **Architectural Debt & Smells:** Anti-patterns, leaky abstractions, or tightly coupled logic.
   - **Divergence from Core Vision:** Areas where gameplay or system flow deviates from the roguelike specification.
   - **Itemized Remediation Plan:** A step-by-step proposal ordered by priority (P0, P1, P2).

4. **Hard Stopping Gate:**
   - **DO NOT MODIFY CODE IN THIS PHASE.**
   - Conclude Phase 1 with: *"Awaiting explicit approval to execute this remediation plan. Confirm to proceed or specify adjustments."*

## Execution Protocol (Phase 2: Remediation & Verification)
Only proceed after the user explicitly approves the remediation plan:
1. Implement fixes incrementally according to the approved plan.
2. Run validation gates after changes:
   - `npm run lint` (Typechecking & static boundary verification)
   - `npm test` (Unit, integration, and chaos regression pass)
   - `npm run sim` (Headless turn loop pass)
   - `npm run validate:schema` (Forward schema migration pass)
   - `npm run build` (Single-file offline bundle verification)
3. Report final diff summary and test results back to the user.
