---
description: Verify ARCHITECTURE.md against the actual codebase and Antigravity config, section by section
---

Read ARCHITECTURE.md (the core document) in full. It is deliberately
short and carries a routing table to four sub-docs under
`docs/architecture/**` and decision records under `docs/decisions/**`.
One of those four, `content-extensibility.md`, is itself a second-level
core doc with its own routing table to four topic docs
(`content-companions.md`, `content-rune-of-return.md`,
`content-progression-scaling.md`, `content-quests-and-triggers.md`) —
read all of them too. The core document's binding statements are the
ground truth, but a sub-doc or topic doc that drifts from them is
exactly the kind of rot this audit exists to catch. Then verify every concrete,
checkable claim against the actual code, section by section — do not
treat any claim as true because it's written down; find the file and
line that proves or disproves it. Section labels below are
ARCHITECTURE.md's own (§N). A claim tagged **[Planned: P-NN]** is a
known gap: confirm only that the gap still exists as §9 describes it.

§2 System Boundaries & Tech Stack — verify vite.config.ts and
   package.json scripts match what's described.
§3 Directory Layout & Dependency Inversion — verify the table and
   diagram against actual imports (grep for cross-layer imports that
   shouldn't exist, per each row's stated rule, including the
   `src/main/` row if that directory exists). For the Content
   Extensibility Model stub, cross-check `content-extensibility.md`
   against the actual manifest/hook code it describes, and confirm the
   stub's binding rules (manifest contract, the two hook mechanisms,
   injected context, content registries, no engine creep) aren't
   contradicted by it or by any of its four topic docs. Confirm
   `content-extensibility.md` itself stays ≤5 KB (it routes onward
   rather than restating topic detail) and that each topic doc under it
   has real `##` headings — a topic doc that regrows into one unheaded
   wall of text is the exact failure this split fixed.
§4 Action Pipeline & Domain Event Contract — verify ActionResult,
   GameEvent, and the failure-isolation behavior directly against
   actions/actionPipeline.ts and engine.ts (processMonsterAction).
§5 State Normalization, Storage & Schema Evolution — verify the core
   stub and `docs/architecture/storage-and-schema.md` against
   storage/*.ts (serializer, migrator, profile and autosave managers)
   and items/containerRegistry.ts. Confirm `docs/decisions/0002-*`
   still matches `migrator.ts`'s actual version floor.
§6 Simulation Scoping & Input Architecture — verify the core stub and
   `docs/architecture/simulation-and-input.md` against scheduler.ts,
   entities/monster.ts, ai/behaviorTree.ts, fov/,
   rendering/input-handler.ts, ui/input/chordBuffer.ts, and
   ui/modalStack.ts. Confirm `docs/decisions/0001-*` (scheduler
   partitioning) and `docs/decisions/0004-*` (HUD overhaul) still read
   as closed retrospectives, not active guidance.
§7 Build Configuration & Automated Quality Gates — actually run
   npm run lint (tsc, check:engine-purity, check:engine-encapsulation, knip),
   npm test, npm run sim, npm run validate:schema, and npm run build,
   and paste the real output, not a description of expected output.
   Also compare .github/workflows/ against the §7.2 stub and
   `docs/architecture/quality-gates.md`. Verify the widened `src/main/`
   scope: both check scripts must treat `src/main/**` as presentation
   scope while keeping content-pack import privilege on `src/main.ts`
   alone.
§8–§9 Change Control & Planned Work Register — confirm every
   [Planned: P-NN] tag has a §9 entry and vice versa, and that each
   entry's "Current:" line still describes the code. Confirm §8.2 is
   actually being honored: no binding statement should exist only in
   a `docs/architecture/**` sub-doc, and any design built-and-rejected
   since the last audit should have landed as a new ADR under
   `docs/decisions/**` rather than only in a commit message.

Cross-check the agent configuration specifically: read CLAUDE.md,
.antigravity/rules.md, and every file under .antigravity/skills/ and
.antigravity/archetypes/. Report any statement that contradicts or
narrows ARCHITECTURE.md's current content — e.g. headless-purity scope,
encapsulation scope, the engine/content dependency direction,
schema-migration triggers, or anything describing the scheduler — and
whether adversarial-audit.md's code-vs-doc process is still consistent
with this command. Confirm every §N reference in CLAUDE.md and
.antigravity/rules.md still resolves to the section it names.

For every mismatch found in any of the above, show the actual
ARCHITECTURE.md (or sub-doc) text and the actual conflicting code or
config side by side. Note anything architecturally significant that
exists in code but isn't mentioned in the doc or a sub-doc at all. Do
not fix anything yet — findings report only, organized by section,
then stop.
