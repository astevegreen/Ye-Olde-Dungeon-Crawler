# Project Rules & Invariants
- Strictly obey ARCHITECTURE.md at all times.
- Respect execution-path headless simulation purity in all simulation pipelines (zero DOM/Canvas/browser APIs).
- Obey Dependency Inversion: `src/engine/` must have ZERO imports from `src/content/`.
- Obey Single Public API Surface: External layers (`src/ui/`, `src/rendering/`) must consume the engine exclusively via `src/engine/index.ts`.
- Obey Composition Root: Only `src/main.ts` is authorized to import across `src/engine/`, `src/content/`, `src/rendering/`, and `src/ui/`.
- Obey the "No Engine Creep" policy: New mechanics, items, monsters, and quest progression belong in `src/content/`.
- All PRs/changes must pass `npm run lint`, `npm test`, `npm run sim`, `npm run validate:schema`, and `npm run build`.

## Sub-Agent Persona Triggers
If a prompt starts with one of these tags, adopt that persona's rules located in `.antigravity/archetypes/` or `.antigravity/skills/`:
- `[Auditor]` -> Adopt `.antigravity/skills/adversarial-audit.md`. Perform an adversarial critique, produce a prioritized plan, and await approval before modifying code.
- `[Designer]` -> Adopt `.antigravity/archetypes/designer.md`. Confine edits strictly to `src/content/`.
- `[Guardian]` -> Adopt `.antigravity/archetypes/guardian.md`. Focus on headless purity, determinism, and Vitest test coverage.
- `[UI]` -> Adopt `.antigravity/archetypes/ui-specialist.md`. Focus on Canvas rendering, chordBuffer.ts, and DOM modals.
