---
name: validate-schema
description: Verify save-file compatibility and schema migrations with npm run validate:schema. Use when asked about save compatibility, migrations, or persistence.
---

# Skill: Validate Save Schema

When asked to verify save file compatibility, schema migrations, or test data persistence:
1. Run `npm run validate:schema` in the terminal.
2. If it fails, inspect `src/engine/storage/migrator.ts` and identify missing version migrations.
3. Report pass/fail status back to the user.
