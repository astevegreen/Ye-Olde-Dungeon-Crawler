# Handoff: wire the approved wave 8 shrines (on the local machine)
2026-10-09 23:50 UTC · branch claude/practical-davinci-zhktva (cloud) · HEAD ca501f2 · tree clean

## Goal
Wire the approved shrines and delete the leftover branches, on the machine that wrote note `2026-10-09-2313-wave-8-shrines.md`:
its five design files were uncommitted there on `main` at 4e58202, on no origin branch. Done: shrines draw in game, gates green, pushed, branches gone.

## Done
- ca501f2 sensed marks back to the old footprint: draft PR https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/pull/16 (waits on CI, then the owner's merge)
- Uncommitted, local machine only, typechecked, not wired: `src/content/cotw/sprites/sculpt/` `altar.ts` (imports `SHRINES`),
  `altar2.ts` (new: verdandi, skuld, ratatoskr, barrow), `runestone.ts` (new), `fixture.ts` (rune strokes), `materials.ts` (`alt_*`).

## Next
1. On the local machine: `git status` shows the five files. Once #16 is merged, `git pull` (it touches only `src/rendering/markers/`).
2. Register the tiles in `COTW_FIXTURE_ART.tiles`, `src/content/cotw/sprites/fixtureSprites.ts:26`:
   `verdandi_loom`, `skuld_mirror` and `ratatoskr_perch` map to `altarModel` kinds `verdandi`, `skuld` and `ratatoskr`;
   `duergar_barrow_1..3` map to kind `barrow`; `skaldic_runestone_1..6` map to `runestoneModel` kinds `frost`, `smithy`, `dawn`, `lament`,
   `norns` and `twilight`, in that order.
3. Barrow rune: confirm the `barrow` kind in `altar2.ts` glows wight-green (the design agent's pick, now the owner's); change it only if it doesn't.
4. Empty `UNDRAWN` in `src/content/cotw/__tests__/fixtureSprites.test.ts:10`. Runestones may share an outline but must not bake identically.
   Run that test, then `npm run gates`, and commit with `Requested: "Shrine designs approved."`, then push.
5. Branches: `git branch -D worktree-agent-ad37d107d66e3cf2e` (its commit went in as 4e58202);
   `git push origin --delete claude/cool-goldberg-822ce8 claude/hopeful-allen-mz463w claude/zealous-lovelace-dtd99q` (all merged into main);
   after #16 merges, also `claude/practical-davinci-zhktva`.
6. Then wave 9 (Q7 list in `.prompts/claude-character-art-overhaul.md`).

## Decisions
- Shrines and runestones go in as drawn — owner: "Shrine designs approved."
- Barrow rune wight-green — owner: "Barrow rune colour: wight-green."
- Cloud pushes skip the pre-push hook and go through a PR, for that session only — owner chose "Skip; open a PR".

## Dead ends
- Cloud: pre-push can't pass (Chromium 1194 only, shimmed for Playwright's 1243; no Firefox or WebKit), and only the session's own branch can be pushed (deletes got HTTP 403).

## Read first
- `src/content/cotw/sprites/fixtureSprites.ts:26`: where the tiles register; `sculpt/runestone.ts` (local only): `runestoneModel` kinds

## Verification
- ca501f2: lint, 2835 tests, sim, schema, build, 32 Chromium Playwright passed; visual check as intended; pre-push skipped (owner OK); CI on #16 pending.
- Shrines: `npx tsc --noEmit` passed (design agent); tests and gates not run.
Resumed: 2026-10-09 23:54 UTC
