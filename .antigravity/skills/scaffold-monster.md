# Skill: Scaffold Monster

When asked to create or scaffold a new monster:
1. Define stats and loot tables in the target campaign pack, `src/content/<campaign>/` (e.g. `src/content/cotw/` or `src/content/warcraft/`).
2. Import the engine only through `src/engine/index.ts` — never a deep path into engine internals (e.g. `../../engine/items/factory`). Do not touch `src/engine/actions/actionPipeline.ts` or other engine internals except under ARCHITECTURE.md §8.1.
3. Use the engine's seeded PRNG (`engine.prng` / `engine.rng`) for any randomized loot amount or drop chance — not `Math.random()`. Note: existing monster definitions in `monsters.ts` use `Math.random()` for gold-drop amounts; this is tracked as Planned Work P-10 in ARCHITECTURE.md and is not a pattern to copy.
4. Append the new monster definition into `src/content/<campaign>/monsters.ts` and register it in the campaign manifest.
5. Run `npm run lint` and `npm test` to ensure compilation, type verification, and engine purity.
