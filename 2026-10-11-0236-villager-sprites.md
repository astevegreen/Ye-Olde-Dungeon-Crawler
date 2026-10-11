# Handoff: own sprites for the raid villagers, gate-ward and altar captives (complete)
2026-10-11 02:55 UTC · branch main · HEAD 3501a73 (pushed) · tree clean

## Goal
Owner: "Just do item 2 and then do a handoff". Item 2 was art audit "Left to do" item 3 (`.prompts/claude-character-art-overhaul.md:273`): the rescued villagers and the prologue cast get their own map sprites instead of the old `townsperson`/`guard` recipes.

## Decide first
- Portraits too? These 8 open the shop greeting, which falls back to their map sprite at 96 px; every other townsperson has a drawn portrait (wave 9c). — recommend: a 9c-style batch of 8 portraits next, because they all speak in that dialog.
- Contact sheet `.prompts/art-review/villagers/sheet-final.png` was not shown to the owner first (owner said "just do"); taste calls to revisit only if asked: Brandr's rime-bit chisel reads a little blue-bright; Eir's herbs are small at game size; Hallvard is a small grey heap at game size (seated, dying, as `prologue.ts:210` describes).

## Done
- 3501a73 feat(art): the raid's villagers, the gate-ward and the altar captives get their own drawings
  - `src/content/cotw/sprites/sculpt/villagers.ts` (Eir, Sigrun, Brandr, Hallvard, Ingrid, Torstein, Sigrid, Leif), `vil_*` materials, registered by NPC id in `sprites/allySprites.ts`.
  - Generic capability: `NpcConfig.spriteKey`, saved as optional `SerializedNpc.spriteKey` (no schema bump, like `choiceId`), read by `sprite-mapper.ts`; `hostageRitual.ts` sets it for stand-ins and returned captives.

## Next
Complete. Art audit next: item 2, wave 8's deferred pieces (rune-ring wheel, map markers, aim reticle, element retone: fire orange), or the portraits above if the owner says yes.

## Decisions
- Map sprites only this task; portraits left as a question — chosen because the audit item names the map recipes.
- Hallvard drawn seated against the wall, frost on his mail, per `prologue.ts:210`.

## Verification
- `npm run gates` (2863 vitest, sim, schema, build, 33 Chromium Playwright): green on the committed tree. Visual check in game (`.prompts/captures/villagers-after/`): distinct, no clipping, night lighting fine. Pre-push: 91 passed.
