---
description: Verify ARCHITECTURE.md against the actual codebase and Antigravity config, section by section
---

Read ARCHITECTURE.md in full. Then verify every concrete, checkable
claim against the actual code, section by section — do not treat any
claim as true because it's written down; find the file and line that
proves or disproves it.

1. System Boundaries & Tech Stack — verify vite.config.ts, package.json
   scripts match what's described.
2. Directory Layout & Dependency Inversion — verify the table and
   diagram against actual imports (grep for cross-layer imports that
   shouldn't exist, per each row's stated rule).
3. Action Pipeline & Domain Event Contract — verify ActionResult,
   GameEvent, and the failure-isolation behavior directly against
   actionPipeline.ts.
4. State Normalization, Storage & Schema Evolution — verify against
   scheduler.ts and storage/*.ts.
5. Simulation Scoping & Input Architecture — verify against
   scheduler.ts, behaviorTree.ts, chordBuffer.ts.
6. Build Configuration & Automated Quality Gates — actually run
   check:engine-purity, npm test, lint, build, sim, and paste the
   real output, not a description of expected output.

7. Cross-check the Antigravity configuration specifically: read
   .antigravity/rules.md and every file under .antigravity/skills/
   and .antigravity/archetypes/. Report whether rules.md references
   ARCHITECTURE.md at all, whether adversarial-audit.md already
   encodes a similar doc-vs-code verification process (and if so,
   whether it's consistent with this command), and whether any
   archetype file states an architectural assumption that conflicts
   with ARCHITECTURE.md's current content (e.g. anything describing
   the scheduler, content extensibility, or the engine/content
   dependency direction).

For every mismatch found in any of the above, show the actual
ARCHITECTURE.md text and the actual conflicting code or config side
by side. Note anything architecturally significant that exists in
code but isn't mentioned in the doc at all. Do not fix anything yet —
findings report only, organized by section, then stop.