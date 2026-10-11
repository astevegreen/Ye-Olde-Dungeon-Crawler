# Handoff: own sprites for the raid villagers, gate-ward and altar captives
2026-10-11 02:36 UTC · branch main · HEAD 4d43383 · tree 14 uncommitted files (finished, not yet committed)

## Goal
Owner: "Just do item 2 and then do a handoff". Item 2 is art audit "Left to do" item 3 (`.prompts/claude-character-art-overhaul.md:273`): the rescued villagers and the prologue cast get their own map sprites instead of the old `townsperson`/`guard` recipes. Done = committed, gates green, pushed.

## Decide first
- Portraits too? These 8 open the shop greeting, which falls back to their map sprite at 96 px; every other townsperson has a drawn portrait (wave 9c). — recommend: a 9c-style batch of 8 portraits next, because they all speak in that dialog.
- Contact sheet `.prompts/art-review/villagers/sheet-final.png` was not shown to the owner first (owner said "just do"); taste calls to revisit only if asked: Brandr's rime-bit chisel reads a little blue-bright; Eir's herbs are small at game size; Hallvard is a small grey heap at game size (seated, dying, as `prologue.ts:210` describes).

## Done
- Uncommitted, finished: `src/content/cotw/sprites/sculpt/villagers.ts` (8 models: Eir, Sigrun, Brandr, Hallvard, Ingrid, Torstein, Sigrid, Leif scaled 0.84), `vil_*` materials in `materials.ts`, registered in `sprites/allySprites.ts` by NPC id.
- Uncommitted, finished: generic capability `NpcConfig.spriteKey` (`src/engine/entities/npc.ts`), saved as optional `SerializedNpc.spriteKey` (same no-schema-bump pattern as `choiceId`, `231d7ae`), read by `sprite-mapper.ts` NPC branch. `hostageRitual.ts` `seatRaidCaptives` and `populateReturnedCaptives` set it, so a captive seated as Eir draws as Eir. Doc line in `content-extensibility.md:25`.
- Tests: `npcSpriteKeyRoundTrip.test.ts` (new), `sprite-mapper.test.ts`, `allySprites.test.ts`, `hostageRitual.test.ts`, `nornicReliquaries.test.ts`: 68/68 green.

## Next
1. Read `.prompts/art-review/villagers/gate1.txt` (gate-stamp lint+test, ran in the background) and the visual-check verdict, if this session didn't get to them; rerun `npm run gate-stamp -- run lint test` if absent.
2. `npm run gates` (presentation change), then one commit: `feat(art): the raid's villagers, the gate-ward and the altar captives get their own drawings`, `Requested: "Just do item 2 and then do a handoff"`. No §8.1 file touched.
3. `git push` in the background; player-visible: the three raid villagers, Hallvard and the four altar captives (and returned captives in town) each look like themselves.
4. Mark item 3 done in the art audit; next there is item 2 (wave 8's deferred pieces).

## Decisions
- Map sprites only this task; portraits left as a question — chosen because the audit item names the map recipes.
- Hallvard drawn seated against the wall, frost on his mail, per `prologue.ts:210`.

## Verification
- Affected vitest files: 68 passed on the uncommitted tree. Gate-stamp and visual check: running when written. `npm run gates`: not run.
