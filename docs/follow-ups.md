# Follow-ups

Known work that a session found outside its task. The list carries it forward, so session summaries stop repeating
it. Sessions add to it by day; sprint lanes file follow-up issues instead. Moving an item into an issue deletes it here.

## How to use
- Grep this file before adding: an item already here gets nothing more.
- One item per bullet: what is wrong or missing, and where (`path:line`, an issue number), then the date found and
  how, in brackets.
- Finish an item: delete its bullet in the same commit.
- A decision only the owner can make goes to the owner as a question, not here.

## Engine
- No test covers a kill rite teaching into full grimoires (the "Every slot in your grimoires is full" suffix) or its
  `screen_flash` (`src/engine/magic/killRites.ts:148`, `teachRiteSpell`). [3 Nov 2026, reviewer on 1d02df90]
- A bug report's replay checkpoint and state snapshot are bare `serializeGame()` output with no schema version, so
  `loadReplayState` (`src/engine/debug/replay.ts:350`) can't gate them: a report from an older build is decoded as
  current, or fails as `corrupt`. Stamping the version on the checkpoint would let it be refused like any old save.
  [7 Nov 2026, agy's second look on #110]
- `ProfileManager.importHero` (`src/engine/storage/profile-manager.ts:512-518`) throws a plain `Error`, not a
  `SaveLoadError`, for an envelope at the current version whose `data` lacks `profile`, `player` or `map`, or whose
  hero is dead; its doc promises a typed reason. [7 Nov 2026, agy's second look on #110]
- `declaredVersion` (`src/engine/storage/loadResult.ts:66-70`) reads `{}`, `[]` or an envelope with a non-numeric
  `schemaVersion` and no timestamp as version 0, so they fail as `migration-failed` instead of `corrupt`.
  [7 Nov 2026, agy's second look on #110]
- `DungeonGenerator.isReachable` (`src/engine/dungeon/dungeon-generator.ts:524`) exempts a vault's whole rect and
  checks only its `@` connectors, so a blueprint with no `@` passes walled off; and where every room is a vault
  (`:308`, `joinable` falls back to `rooms`) a connector can join its own vault again. A stamp-time check that a
  blueprint has an `@` closes the first. [7 Nov 2026, agy's second look on cb0bb7ef]

## Content (cotw pack)

## Presentation

## Tests, gates and tooling
- `scripts/lib/agy.mjs` is 408 lines: its Gemini API half (`apiPrompt`, `parseApiReply`, the HTTPS post,
  `geminiApi`) belongs in its own file, split the same way in all three repos. [7 Nov 2026, Gemini API fallback]
- The "(diff truncated; read the rest from disk)" line is written in `scripts/second-look.mjs:75` and matched by
  `TRUNCATED` in `scripts/lib/agy.mjs:168`: one shared constant would stop a reworded marker from sending part of a
  diff to the API. [7 Nov 2026, Gemini API fallback]
- The workflows pin each action by major tag (`actions/checkout@v7`, `.github/workflows/deploy.yml:24` and the
  others), so a moved tag runs at once, past Dependabot's 7-day cooldown (`.github/dependabot.yml:3-4`); pinning by
  commit SHA with the version in a comment closes that. [7 Nov 2026, agy's second look on #106]
- `.github/dependabot.yml:3-4` says security updates skip the cooldown; unverified, as docs.github.com was blocked
  in the cloud session that wrote it. [6 Nov 2026, toolchain upgrades handoff]
- A push that only deletes branches runs every pre-push gate, all three browsers included (`.githooks/pre-push:30`
  lets only `handoffs` pushes skip); a deletion carries no code. A rail change: it gets the rail audit.
  [7 Nov 2026, housekeeping]

- `.claude/settings.local.json` is tracked and still holds broad one-off grants (`npm run *`, `npx tsx *`, `npx tsc *`,
  awk and scratchpad lines); the auto-mode classifier refused the pruning as self-modification, so the owner or a
  rail-audited change should narrow it to the gate scripts, `npx vitest *`, `gh run *`, `git worktree *`,
  `git ls-remote *`. [7 Nov 2026, agent context batch B]
- `.agents/` is not a copy of `.claude/`: it is the read-only analyst rule set that agy's second look reviews against
  (`scripts/lib/second-look.mjs`, `scripts/lib/agy.mjs` CONTEXT, `docReferences.test.ts`). Only its invariants list
  in `project-rules.md` restates `ARCHITECTURE.md`; shrinking it to pointers changes a rail, so it needs the rail
  audit. [7 Nov 2026, agent context batch B]

## Docs
