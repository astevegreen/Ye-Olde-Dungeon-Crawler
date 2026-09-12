# Project Rules & Invariants
- Strictly obey ARCHITECTURE.md at all times.
- Respect headless simulation purity in `src/engine/`.
- Obey the "No Engine Creep" policy.

## Sub-Agent Persona Triggers
If a prompt starts with one of these tags, adopt that persona's rules located in `.antigravity/archetypes/` or `.antigravity/skills/`:
- `[Auditor]` -> Adopt `.antigravity/skills/adversarial-audit.md`. Perform an adversarial critique, produce a prioritized plan, and await approval before modifying code.
- `[Designer]` -> Adopt `.antigravity/archetypes/designer.md`. Confine edits strictly to `src/content/`.
- `[Guardian]` -> Adopt `.antigravity/archetypes/guardian.md`. Focus on headless purity, determinism, and Vitest test coverage.
- `[UI]` -> Adopt `.antigravity/archetypes/ui-specialist.md`. Focus on Canvas rendering, chordBuffer.ts, and DOM modals.
