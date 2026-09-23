# Skill: Scaffold Monster

When asked to create or scaffold a new monster:
1. Define stats and loot tables in the target campaign pack, `src/content/<campaign>/` (e.g. `src/content/cotw/` or `src/content/warcraft/`).
2. Import the engine only through `src/engine/index.ts` — never a deep path into engine internals (e.g. `../../engine/items/factory`). Do not touch `src/engine/actions/actionPipeline.ts` or other engine internals except under ARCHITECTURE.md §8.1.
3. Use the engine's seeded PRNG (`engine.prng` / `engine.rng`) for any randomized loot amount or drop chance — `check:engine-purity` rejects `Math.random()` in content source.
4. Add the definition where the pack keeps its monsters — `src/content/cotw/monsters/<zone>.ts` (re-exported by `monsters/index.ts`) or `src/content/warcraft/monsters.ts` — and confirm it reaches the pack manifest's `monsters` list.
5. Run `npm run lint` and `npm test` to ensure compilation, type verification, and engine purity.
