# ADR-0005: Owner-Authorized Protected-File Changes and the Agent Workflow

**Date:** 2026-09-23
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §8.1 (exception 4), §8.4 (Agent Workflow), §7.2 (`check:engine-creep`); [ADR-0002](0002-v0-v11-migration-chain-deletion.md)

## Context
§8.1 allowed protected-file edits under three exceptions, but the owner had authorized others outside them, and those authorizations lived only where a later reviewer would not look:
- 2026-09-18: difficulty threading through `engine.ts`'s `changeFloor()` and `diagnostics.spawnMonster`, noted only in `content-progression-scaling.md`.
- 2026-09-20: deletion of the v0→v11 migration chain from `migrator.ts`, recorded in ADR-0002 alongside a "binding invariant" that §8.2 says may live only in `ARCHITECTURE.md`.
- The token-efficiency audit and the code hygiene/efficiency pass (including `dc5de31`): the owner confirmed on 2026-09-23 that the protected-file edits were explicitly authorized. Nothing in the commits recorded it, so the next review flagged them as §8.1 violations.

Separately, `dc5de31` (an Antigravity commit titled "Code Hygiene Pass") put CotW spell IDs and story flags into `GameEngine` and passed every gate, because the gates check import topology, not what the code names. "Verify after the fact" caught it only because the next Claude Code session was told to look: nothing marked which commits had been reviewed, commits did not say which tool wrote them, and the session-start `git log -10` misses anything older.

## Decision
- **§8.1 exception 4:** an owner-authorized, named, narrowly scoped protected-file change is a standing exception. The agent never infers it; the authorization comes from the owner in the task and is recorded as an ADR. Every protected-file commit states `§8.1 exception N`, enforced by `.githooks/commit-msg`.
- **ADR-0002's floor invariant moves to §5**, where binding rules live.
- **§8.4 Agent Workflow:** commits carry an attribution trailer; Antigravity leaves engine production-source changes uncommitted for Claude Code review; a local `verified` tag marks the last reviewed commit, and each Claude Code session reviews `verified..HEAD`.
- **`check:engine-creep`** joins `npm run lint`: engine production source may not name an identifier a content pack declares, except allowlisted overlaps with stated reasons.

## Alternatives Considered
- **Treat the past authorizations as one-offs and keep three exceptions.** Rejected: it leaves the owner's actual way of working outside the written rules, so the next authorized edit would again read as a violation.
- **Clearer written guidance alone.** Rejected: `rules.md` already stated No Engine Creep and §8.1 plainly when `dc5de31` landed.
- **A PR-only workflow with required CI.** Not adopted now; it changes the working rhythm more than the failure warrants.

## Consequences
- The prior authorizations above are exception-4 changes on record; no code changes follow from recognizing them.
- A protected-file commit without a stated exception fails locally (bypassable only deliberately, with `SKIP_HOOKS=1`).
- Review becomes a queue (`verified..HEAD`) rather than a recollection.
