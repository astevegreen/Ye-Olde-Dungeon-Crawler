---
name: validate-schema
description: Verify save-file compatibility and schema migrations with npm run validate:schema. Use when asked about save compatibility, migrations, or persistence.
---

# Skill: Validate Save Schema

When asked to verify save file compatibility, schema migrations, or test data persistence:
1. Run `npm run validate:schema` in the terminal. It prints a ✓ or ✗ per check, in two groups (`scripts/validate-schema.ts`).
2. If it fails, triage by which check failed:
   - **Round-trip fidelity** (surface, ground item, PRNG state, custom content tile): the usual failure. State didn't survive serialize -> JSON -> deserialize, so look in `src/engine/storage/serializer.ts` (`serializeGame`/`deserializeGame`) and the state's own save/restore code, e.g. a new field the serializer never writes or restores, or a value JSON can't carry (a `Map`, `undefined`, a function).
   - **Migration machinery** (a current-version save passes through, an older one is refused, a probe forward step runs): read `src/engine/storage/migrator.ts` and `docs/architecture/storage-and-schema.md` to understand it, but don't edit it. `migrator.ts` is a §8.1 protected file. It changes only under an ARCHITECTURE.md §8.1 exception named in the commit message (a breaking save-format change is exception 2: one new forward-only step plus a `CURRENT_SCHEMA_VERSION` bump, §5). Report what you found and ask before touching it.
3. Report the pass/fail status, and for a failure, the failing check and its likely cause, back to the user.
