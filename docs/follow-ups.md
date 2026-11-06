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

## Content (cotw pack)

## Presentation

## Tests, gates and tooling

## Docs
