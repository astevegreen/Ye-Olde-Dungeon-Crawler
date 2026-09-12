# Skill: Scaffold Monster

When asked to create or scaffold a new monster:
1. Ensure the stats and loot tables are defined according to target campaign in `src/content/<campaign>/` (e.g. `src/content/cotw/` or `src/content/warcraft/`).
2. Do NOT touch `src/engine/actions/actionPipeline.ts` or engine internals (obey Section 3 & 7 of ARCHITECTURE.md).
3. Append the new monster definition into `src/content/<campaign>/monsters.ts` and register it in the campaign manifest.
4. Run `npm run lint` and `npm test` to ensure compilation, type verification, and engine purity.
