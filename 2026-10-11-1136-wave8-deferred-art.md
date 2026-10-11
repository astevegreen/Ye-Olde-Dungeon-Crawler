# Handoff: wave 8's deferred art (wheel, aim, map tags, HUD icons, cleanup)
2026-10-11 11:36 UTC · branch main · HEAD 21aeb8f · tree 23 uncommitted files (all this task's)

## Goal
Owner: "wave 8's deferred pieces: The companion wheel redrawn as a rune ring. New markers floating above quest, stairs and portal tiles. New art for the aiming reticle and the area-of-effect preview. Four HUD icons still on the old art: backpack, coins, chest and rune stone. Dead-art cleanup: players won't see any change." Done = two commits pushed (the four visible pieces, then the cleanup), each through `npm run gates`.

## Decide first
- Retone `elements.ts` fire from red `#ef4444` to the bible's orange `#ff8a2c` (also frost/lightning/poison per bible `palette.js`)? It recolours the new aim line, blast zone and fire damage numbers. — recommend: yes, as its own small task, because red is the danger colour and the owner didn't ask for it here.

## Done (all uncommitted, built, tests green)
- HUD icons: `COTW_UI_PIXEL_ICONS` in `src/content/cotw/sprites/uiIcons.ts` maps the 4 `ui~` keys to the item pixel sprites; `installUiIcons(recipes, pixelSprites)` in `src/rendering/uiIcons.ts`; `main.ts` passes them; doc line in `content-extensibility.md`; test `uiPixelIcons.test.ts`.
- Wheel: `src/rendering/radialMenu.ts` ports bible `markers.js` `wheel` (theme-derived colours, new role `wheelStone` in `engine/types/theme.ts` + `rendering/theme.ts`); `render(..., t)` returns moved; renderer passes `markerNow`.
- Aim: `drawAimReticle`, `drawBlastZone`, shared `strokeZoneEdge` in `src/rendering/markers/markers.ts` (new design, no bible model); `targeting-overlay.ts` uses them, aim line keylined; `render(..., t)`.
- Map tags: `drawMapTag` (bible `mapMarker`) + `renderMapTags()` in `canvas-renderer.ts`: stairs/portal on explored tiles, quest pennant over visible `getCurrentObjective().pointTo` entities (only the prologue has any).
- Cleanup: deleted `sprites/items.ts`, `organicShapes.ts`, 44 monster recipes (kept player, player_female for `ui~hero/heroine`, and the 6 NPC role looks as fallback), cotw `spriteTagRules`; 3 tests re-pointed.
- Cleanup-commit versions of the 6 files that would differ saved in `.prompts/scratch/cleanup/` (monsters.ts, atlas.ts, sprites/index.ts, spriteRecipes/sprite-mapper/entityIconSprite tests).

## Next
1. Read the visual-check verdict: captures in `.prompts/captures/w8d-*` (it was still running; its before-worktree is `../yodc-before`, remove it with `git worktree remove` if left). Fix nits it reports.
2. Commit 1 (visible art): `git checkout HEAD --` monsters.ts, atlas.ts, the 3 cleanup tests, restore items.ts/organicShapes.ts; hand-edit `sprites/index.ts` to keep the items import but add `export { COTW_UI_PIXEL_ICONS } from './uiIcons';`. `npm run gates`, commit with `Requested:` trailer.
3. Commit 2 (cleanup): copy `.prompts/scratch/cleanup/*` back, `rm` items.ts and organicShapes.ts, gates, commit, `git push` in background.
4. Log wave 8 deferred as done in `.prompts/claude-character-art-overhaul.md` status audit; summary lists player-visible changes.

## Decisions
- No bible design for the aim reticle: ticks + diamond in the spell colour; blast zone dots (not the danger hatch) — chosen so "your blast" and "enemy's blow" never look alike.
- Map tag tail touches the tile's top row by 1 px (bible geometry); test allows it.

## Verification
- `npx vitest run`: 2870 passed on the uncommitted tree; `npm run lint` green (palette 20); `npm run build` ok, 2,364.98 kB (782 kB gzip). Gates/Playwright: not run.
