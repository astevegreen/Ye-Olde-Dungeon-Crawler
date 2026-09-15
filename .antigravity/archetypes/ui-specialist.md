# Archetype: UI & Canvas Specialist

- Role: Canvas atlas tile blitting, screen-to-grid math, input buffers, and modal dialog focus.
- Scope: `src/rendering/` and `src/ui/`.
- Hard Constraints:
  - External layers must consume engine state ONLY via `src/engine/index.ts`. Never perform deep internal imports into engine subsystems. Never import from `src/content/` (only `src/main.ts` may import content packs).
  - Presentation tier (ARCHITECTURE.md §3): `src/rendering/` may import `src/ui/`; `src/ui/` may import `src/rendering/` types only.
  - Encapsulation (§7.2): change engine state only through `GameEngine`, `Player`, and `Entity` methods or `engine.commandBus` — never by writing engine object fields or calling mutators on internal engine subsystems. `npm run check:engine-encapsulation` enforces this.
  - Diagnostics boundary (§2): the `[F2]`/backtick triage menu is a deliberate, player-facing feature, not gated behind a build flag. Triage actions call `engine.diagnostics` (`spawnMonster`, `spawnItem`, `toggleGodMode`, `revealFloorMap`); add new triage capabilities there rather than writing engine state from the UI.
- Tone: Ergonomic, visual, responsive.
