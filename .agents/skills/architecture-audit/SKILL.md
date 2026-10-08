---
name: architecture-audit
description: Verify ARCHITECTURE.md, its sub-docs and the agent instructions against the actual codebase, section by section, and write the findings as a report to .prompts/antigravity/. Use when asked whether the architecture docs are accurate, for a documentation audit, or for doc drift.
---

# Skill: Architecture Audit

Report only: never change a file outside `.prompts/antigravity/`.

## Scope
Read ARCHITECTURE.md (the core document) in full. It is deliberately short and carries a routing table to four sub-docs under `docs/architecture/**` and decision records under `docs/decisions/**`. One of those four, `content-extensibility.md`, is itself a second-level core doc with its own routing table to six topic docs (`content-companions.md`, `content-rune-of-return.md`, `content-progression-scaling.md`, `content-quests-and-triggers.md`, `content-magic.md`, `content-items-and-art.md`). Read all of them too, and confirm that list still matches every `content-*.md` under `docs/architecture/`.

The core document's binding statements are the ground truth, but a sub-doc or topic doc that drifts from them is exactly the kind of rot this audit exists to catch. Verify every concrete, checkable claim against the actual code, section by section. Don't treat any claim as true because it's written down: find the file and line that proves or disproves it. Section labels below are ARCHITECTURE.md's own (§N). A claim tagged **[Planned: P-NN]** is a known gap: confirm only that the gap still exists as §9 describes it.

The commit range for the §8 checks: from the HEAD sha in the newest earlier `architecture-audit` report in `.prompts/antigravity/` to HEAD; if there is none, the last 100 commits.

## Per section
- **§2 System Boundaries & Tech Stack:** verify `vite.config.ts` and the `package.json` scripts match what's described.
- **§3 Directory Layout & Dependency Inversion:** verify the table and diagram against actual imports (grep for cross-layer imports that shouldn't exist, per each row's stated rule, including the `src/main/` row). For the Content Extensibility Model stub, cross-check `content-extensibility.md` against the manifest and hook code it describes, and confirm the stub's binding rules (manifest contract, the two hook mechanisms, injected context, content registries, no engine creep) aren't contradicted by it or by any of its six topic docs. Confirm `content-extensibility.md` stays ≤5 KB (it routes onward rather than restating topic detail) and that each topic doc under it has real `##` headings.
- **§4 Action Pipeline & Domain Event Contract:** verify `ActionResult`, `GameEvent`, and the failure-isolation behavior directly against `actions/actionPipeline.ts` and `engine.ts` (`processMonsterAction`).
- **§5 State Normalization, Storage & Schema Evolution:** verify the core stub and `docs/architecture/storage-and-schema.md` against `storage/*.ts` (serializer, migrator, profile and autosave managers) and `items/containerRegistry.ts`. Confirm `docs/decisions/0002-*` still matches `migrator.ts`'s actual version floor.
- **§6 Simulation Scoping & Input Architecture:** verify the core stub and `docs/architecture/simulation-and-input.md` against `scheduler.ts`, `entities/monster.ts`, `ai/behaviorTree.ts`, `fov/`, `rendering/input-handler.ts`, `ui/input/chordBuffer.ts`, and `ui/modalStack.ts`. Confirm `docs/decisions/0001-*` (scheduler partitioning) and `docs/decisions/0004-*` (HUD overhaul) still read as closed retrospectives, not active guidance.
- **§7 Build Configuration & Automated Quality Gates:** run `npm run lint`, `npm test`, `npm run sim`, `npm run validate:schema` and `npm run build`, and paste the real output. Compare `.github/workflows/` against the §7.2 stub and `docs/architecture/quality-gates.md`. Verify the `src/main/` scope: both check scripts treat `src/main/**` as presentation scope while keeping the content-pack import privilege on `src/main.ts` alone. Confirm every `scripts/engine-creep-allowlist.json` entry's reason still holds, and that the `.githooks/commit-msg` protected-file list matches §8.1.
- **§8–§9 Change Control & Planned Work Register:** confirm every **[Planned: P-NN]** tag has a §9 entry and vice versa, and that each entry's "Current:" line still describes the code. Confirm §8.2 is honored: no binding statement exists only in a `docs/architecture/**` sub-doc, and any design built and rejected in the range landed as a new ADR under `docs/decisions/**` rather than only in a commit message. Confirm every protected-file commit in the range names its §8.1 exception, every exception-4 change has its ADR, and owner-requested behavior carries a `Requested:` trailer.

## Agent instructions
Read `CLAUDE.md`, every file under `.agents/rules/` and `.agents/skills/`, and every `.claude/skills/*/SKILL.md`. Confirm `project-rules.md` and `cli-safety.md` are `trigger: always_on`. Report any statement that contradicts or narrows ARCHITECTURE.md's current content (headless-purity scope, encapsulation scope, the engine/content dependency direction, schema-migration triggers, anything describing the scheduler), and whether `adversarial-audit`'s code-vs-doc process is still consistent with this skill. Confirm every §N reference in `CLAUDE.md` and `.agents/rules/project-rules.md` still resolves to the section it names.

## Report
Write `.prompts/antigravity/<YYYY-MM-DD>-architecture-audit.md` with the header in `project-rules.md` (date, HEAD short sha, scope). For every mismatch, show the actual ARCHITECTURE.md (or sub-doc) text and the actual conflicting code or config side by side, with `path:line`, severity and a suggested fix. Note anything architecturally significant that exists in code but isn't mentioned in the doc or a sub-doc at all. Organize findings by section, then stop. Don't fix anything.
