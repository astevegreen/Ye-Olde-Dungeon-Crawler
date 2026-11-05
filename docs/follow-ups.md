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
- No test covers a kill rite teaching into full grimoires (the "Every slot in your grimoires is full" suffix) or its `screen_flash` (`src/engine/magic/killRites.ts`, `teachRiteSpell`); found 3 Nov 2026 by the reviewer on 1d02df90.

## Content (cotw pack)

## Presentation

## Tests, gates and tooling
- No test covers the soak bot's Phase Door landing pick beside Hliðskjálf (`escapeAt`, `e2e/soak/playerBot.ts:1424-1441`): the farthest open tile at least two from every foe, and the null fall-through to Heal, potion and scroll; pull it into `e2e/soak/escapePlan.ts` as a pure function like `shouldEscape`. [5 Nov 2026, reviewer on the K4 cherry-pick]

## Docs
