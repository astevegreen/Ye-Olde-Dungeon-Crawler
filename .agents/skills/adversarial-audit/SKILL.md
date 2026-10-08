---
name: adversarial-audit
description: Adversarial architectural audit of the code against ARCHITECTURE.md, written as a prioritized report to .prompts/antigravity/. Use when asked for a codebase audit, architectural review, gap analysis, health critique, or whether the project is on track, or when a prompt starts with [Auditor]. Report only; never changes code.
---

# Skill: Adversarial Architectural Audit & Realignment

## Trigger Conditions
Invoke this skill whenever the user asks for a comprehensive codebase audit, architectural review, gap analysis, project health critique, or asks if the project is "on track."

## Scope Note
This skill audits the **code** against ARCHITECTURE.md's current-state claims. It does not check whether ARCHITECTURE.md itself is accurate, internally consistent, or in sync with `.agents/rules/` and `.agents/skills/` — that is the `architecture-audit` skill. Before flagging a mismatch as a violation, check whether ARCHITECTURE.md already tags that behavior **[Planned: P-NN]**; a planned item is a known gap, not a new finding. Likewise, re-propose a design recorded as rejected under `docs/decisions/` — notably ADR-0001, *Scheduler Partitioning* (splitting `EnergyScheduler` into active/dormant lists) — only with new evidence the recorded evaluation did not cover (for example, a measured `npm run sim` regression at realistic populations), and cite that evidence in the finding.

## Analysis Protocol
1. **Architectural Boundary Inspection:**
   - Scan `src/engine/` for DOM, `window`, `document`, Canvas, audio, or timing-global imports/usage (Headless Purity violation) — also scan all `src/content/` source, whether or not a file is registered as a manifest hook or handler, and any callback injected into the simulation at runtime, since purity is defined by execution path, not file location (ARCHITECTURE.md §2, §7.2).
   - Scan `src/ui/`, `src/rendering/`, and `src/content/` for deep imports into engine internals beyond `src/engine/index.ts`.
   - Verify `src/engine/` production source has zero imports from `src/content/`, `src/ui/`, or `src/rendering/`. Colocated engine tests (`src/engine/**/__tests__/`) are allowed to import content packs as fixtures — do not flag those.
   - Verify `src/main.ts` is the only source module importing content packs (confirming it as sole Composition Root).
   - Verify all random number generation in simulation code routes through `engine.prng`/`engine.rng`, not `Math.random()` or wall-clock IDs.
   - Do not report sanctioned dynamic wiring as a violation in itself:
     - writes listed with a reason in `scripts/engine-encapsulation-allowlist.json` (composition-root `engine.on*` callback slots; content AI strategies publishing `Monster.intent`), which `npm run check:engine-encapsulation` already verifies;
     - behavior registered at runtime through the `GameContentManifest` or engine registries (action hooks, event-hook descriptors on items and monsters, status handlers, AI strategies — ARCHITECTURE.md §3);
     - handlers acting on the engine through their injected context (§3), including content calling engine subsystem methods (§7.2 exempts content from the subsystem-mutator rule).
     Flag such code only when its body breaks an unmarked invariant (e.g. a DOM or timing global on the execution path), or when an allowlist entry has no stated reason.

2. **Game Systems & Codebase Health:**
   - Check if content additions violate the "No Engine Creep" policy (modifying action pipelines or adding campaign-specific logic to `src/engine/` instead of defining manifests in `src/content/`).
   - Audit action loop latency, garbage collection pressure (allocations inside `tick()`), and spatial index bounds.
   - Inspect save schema coverage: ensure every *breaking* save-format change increments `CURRENT_SCHEMA_VERSION` and registers exactly one new forward-only step in `migrator.ts` (ARCHITECTURE.md §5). Do not flag a new state model as missing a migration when it rides entirely on already-serialized structures (e.g. renown on `WorldState.counters`/`flags`, §3), which needs no step.

3. **Gates:** run `npm run lint`, `npm test`, `npm run sim` and `npm run validate:schema`, and paste the real output. A failing gate on a committed tree is itself a P0 finding.

4. **Deliverable - The Adversarial Audit Report:**
   Write it to `.prompts/antigravity/<YYYY-MM-DD>-adversarial-audit.md`, with the header and per-finding format in `project-rules.md` (date, HEAD short sha, scope; `path:line`, evidence, severity, suggested fix), grouped as:
   - **Critical Vulnerabilities:** Violations of ARCHITECTURE.md invariants (unmarked statements only — not gaps already tagged **[Planned]**).
   - **Architectural Debt & Smells:** Anti-patterns, leaky abstractions, or tightly coupled logic.
   - **Divergence from Core Vision:** Areas where gameplay or system flow deviates from the roguelike specification.
   - **Prioritized Remediation Plan:** Recommendations ordered by priority (P0, P1, P2). Cross-reference existing Planned Work items (§9) instead of duplicating them. Name the §8.1 exception any fix to a protected file would need.

5. **Stop.** Don't modify code. Tell the owner the report's path; Claude Code verifies the findings against the code and makes the fixes the owner approves.
