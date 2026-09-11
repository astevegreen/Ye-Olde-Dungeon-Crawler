# Skill: Validate Save Schema

When asked to verify save file compatibility, schema migrations, or test data persistence:
1. Run `npm run validate:schema` in the terminal.
2. If it fails, inspect `src/engine/storage/migrator.ts` and identify missing version migrations.
3. Report pass/fail status back to the user.
