---
name: add-content
description: Adding content to the cotw pack. Use when asked to add, create or rework a monster, an item or item family, a spell, a vault, a story beat (a choice, trigger, countdown or ending), or a town NPC or companion.
---

# Add content

Content is data in `src/content/cotw/` that the engine interprets, so a new monster, item, spell, vault, beat, NPC or companion needs no engine change. Read the branch file for the kind you are adding, and only that one:

| Adding | Read |
|---|---|
| a monster | [MONSTER.md](MONSTER.md) |
| an item, a family tier, an item effect | [ITEM.md](ITEM.md) |
| a spell or a hybrid spell | [SPELL.md](SPELL.md) |
| a vault | [VAULT.md](VAULT.md) |
| a choice, a progress trigger, a countdown, a boss resolution, an ending | [STORY.md](STORY.md) |
| a town NPC, a companion, a companion skill | [NPC.md](NPC.md) |

A piece often spans kinds (a miniboss needs its vault, an altar its choice): finish the branch asked for, then follow each branch it names. A miniboss's definition, loot and rite follow MONSTER.md; where it stands follows the placing branch.

## Every branch
- **The engine is reached through its index:** `import type { … } from '../../engine'` (one more `../` per subfolder); a deep path fails `check:engine-purity`.
- **An id lives only in the pack.** Engine and presentation source never name it (`check:engine-creep`), nor an NPC's name (`packNeutralSource.test.ts`); every word the player reads comes from the manifest. Ids are unique: the registry keeps the last of two equal ids without a word.
- **Randomness is the `rng` the engine passes in;** `Math.random()` and `Date.now()` fail the purity gate.
- **The engine changes only to gain a generic capability** that the pack then uses (ARCHITECTURE.md §3). Where a branch says engine work, name the capability to the owner before building it; `engine.ts`, `actionPipeline.ts` and `migrator.ts` are protected (§8.1).
- **Numbers come from neighbours** at the same depth, as each branch says. A balance call nothing settles (a roster change, a permanent stat, a new family) is the owner's: ask, with a recommendation.
- **Tests read the real thing.** Several past additions passed tests that read only their declarations, then broke on a real floor; a new placement or beat gets a test that generates the floor or plays the action. A test sweeping many seeds passes a timeout like `30_000`, since vitest stops a test at 5 s.
- **A change to what floors draw** (monsters, loot, vaults) is bracketed by balance runs, both quoted in the commit: `mkdir -p .prompts/balance` (`--out` makes no folder), `npm run balance -- --out .prompts/balance/before.json` before, `npm run balance -- --baseline .prompts/balance/before.json` after.

## Done
Done when every step and Finish line of the branch holds and `npm run gate-stamp -- run lint test` is green, its output pasted. Where a branch was wrong (a step the code no longer matches, a test it didn't name), correct the branch file in the same commit.
