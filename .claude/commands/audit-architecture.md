---
description: Verify ARCHITECTURE.md against the actual codebase and Antigravity config, section by section
---

Read ARCHITECTURE.md in full. Then verify every concrete, checkable
claim against the actual code, section by section — do not treat any
claim as true because it's written down; find the file and line that
proves or disproves it. Section labels below are ARCHITECTURE.md's own
(§N). A claim tagged **[Planned: P-NN]** is a known gap: confirm only
that the gap still exists as §9 describes it.

§2 System Boundaries & Tech Stack — verify vite.config.ts and
   package.json scripts match what's described.
§3 Directory Layout & Dependency Inversion — verify the table and
   diagram against actual imports (grep for cross-layer imports that
   shouldn't exist, per each row's stated rule).
§4 Action Pipeline & Domain Event Contract — verify ActionResult,
   GameEvent, and the failure-isolation behavior directly against
   actions/actionPipeline.ts and engine.ts (processMonsterAction).
§5 State Normalization, Storage & Schema Evolution — verify against
   storage/*.ts (serializer, migrator, profile and autosave managers)
   and items/containerRegistry.ts.
§6 Simulation Scoping & Input Architecture — verify against
   scheduler.ts, entities/monster.ts, ai/behaviorTree.ts, fov/,
   rendering/input-handler.ts, ui/input/chordBuffer.ts, and
   ui/modalStack.ts.
§7 Build Configuration & Automated Quality Gates — actually run
   npm run lint (tsc, check:engine-purity, check:engine-encapsulation),
   npm test, npm run sim, npm run validate:schema, and npm run build,
   and paste the real output, not a description of expected output.
   Also compare .github/workflows/ against §7.2's CI description.
§8–§9 Change Control & Planned Work Register — confirm every
   [Planned: P-NN] tag has a §9 entry and vice versa, and that each
   entry's "Current:" line still describes the code.

Cross-check the agent configuration specifically: read CLAUDE.md,
.antigravity/rules.md, and every file under .antigravity/skills/ and
.antigravity/archetypes/. Report any statement that contradicts or
narrows ARCHITECTURE.md's current content — e.g. headless-purity scope,
encapsulation scope, the engine/content dependency direction,
schema-migration triggers, or anything describing the scheduler — and
whether adversarial-audit.md's code-vs-doc process is still consistent
with this command.

For every mismatch found in any of the above, show the actual
ARCHITECTURE.md text and the actual conflicting code or config side
by side. Note anything architecturally significant that exists in
code but isn't mentioned in the doc at all. Do not fix anything yet —
findings report only, organized by section, then stop.
