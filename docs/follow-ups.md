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
- On a few fixture-pack floors (floor 3 seed 11, floor 4 seeds 1 and 11, of 120 probed) the only way to the stairs down is a diagonal squeeze between a vault pillar and a wall: the hero's movement allows it, monster pathfinding (`src/engine/ai/pathfinding.ts`, corner-clipping rule) and `SpawnSiteFilter`'s four-way reach do not. `DungeonGenerator.isReachable` (`src/engine/dungeon/dungeon-generator.ts`) checks eight-way, so it accepts such floors; cotw's layout strategies showed none in 570 floors (6 Nov 2026, test-suite audit, `vaultGenerationIntegration.test.ts`).
- No test covers a kill rite teaching into full grimoires (the "Every slot in your grimoires is full" suffix) or its `screen_flash` (`src/engine/magic/killRites.ts`, `teachRiteSpell`); found 3 Nov 2026 by the reviewer on 1d02df90.
- No test shows a bug-report replay of a save below the version floor reporting `migration-failed`, or of a newer save reporting `newer-than-engine` (`src/engine/debug/replay.ts:351`, the `migrateForLoad` path of the replay loader); the profile and autosave loaders have both (7 Nov 2026, reviewer on the test-suite audit branch).
- Monster tags now reach the corrupt-versus-radiant branch too (`src/engine/combat/mitigationPipeline.ts:51`, since 970e715): a corrupt weapon would take its bonus against a `radiant`-tagged monster. No pack tags one today; a pack that adds one needs a test of that bonus (7 Nov 2026, reviewer on the test-suite audit branch).

## Content (cotw pack)

## Presentation

## Tests, gates and tooling
- Test-suite audit leftovers (6 Nov 2026, test-suite audit): the six `src/engine/storage/__tests__/*RoundTrip.test.ts` files want one table with a `roundTrip()` helper; 24 files still assign `globalThis.document`/`window` by hand instead of `vi.stubGlobal` (the config already unstubs); 19 hand-rolled fake DOMs could share happy-dom (a new dependency, so its own change); a shared sprite-sheet helper for the sprite tests; four gameplay specs could run in Chromium only; soak-shaped tests (`chaosSimulation.test.ts`) could move to the tooling project.
- Tests the audit found missing (6 Nov 2026, test-suite audit): the rail list in `scripts/second-look.mjs` omits `tests/setup/sharedState.ts` and `packNeutralSource.test.ts` (a rail change: needs the rail audit); a viewport device-pixel-ratio test (`src/rendering/viewport.ts`); `validatePayload` cases in `relay/src/__tests__/relay.test.ts`; `decodeRunShare` rejecting a tampered score; BSP sealed-region checks in `dungeon-generator.ts`; a cap on how far one action may advance the world (`engine.ts`).
- `src/engine/__tests__/scheduler-guard.test.ts:20` and `src/engine/__tests__/inspect.test.ts:43` were proposed for deletion but no other test covers zero-speed scheduling or a zero-cost inspect; kept (6 Nov 2026, test-suite audit).

- `scripts/lib/agy.mjs` is 408 lines: its Gemini API half (`apiPrompt`, `parseApiReply`, the HTTPS post,
  `geminiApi`) belongs in its own file, split the same way in all three repos. [7 Nov 2026, Gemini API fallback]
- The "(diff truncated; read the rest from disk)" line is written in `scripts/second-look.mjs` and matched by
  `TRUNCATED` in `scripts/lib/agy.mjs`: one shared constant would stop a reworded marker from sending part of a diff to
  the API. [7 Nov 2026, Gemini API fallback]

## Docs
