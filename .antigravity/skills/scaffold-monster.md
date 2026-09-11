# Skill: Scaffold Monster

When asked to create or scaffold a new monster:
1. Ensure the stats and loot tables are defined according to `src/content/cotw/`.
2. Do NOT touch `src/engine/actions/actionPipeline.ts` (obey Section 5 of ARCHITECTURE.md).
3. Append the new monster definition directly into `src/content/cotw/monsters.ts`.
4. Run `npm test` to ensure compilation and type verification.
