# Handoff: adaptive map view (fill wide and tall windows)
2026-10-10 15:56 UTC · branch main · HEAD 1a8ecb9 · tree clean
Resumed: 2026-10-10 16:34 UTC · finished 44e8f90 on main (pushed, deployed)

## Goal
Owner, on a 2000×990 window: "On the left and right sides there is a bunch of dead space. Why is it empty". Done: the map's virtual canvas takes the room's shape (30×18¾ tiles up to 48 columns or 30 rows, same tile size), the action-button row is capped and centred.

## Done
- 44e8f90 feat(map): the view fills wide and tall windows with more tiles

## Next
Complete. Possible follow-ups, none requested:
- At 2560×1080 the action console spreads its pieces evenly (orb, potion slots, context panel, spells, orb), ~96px gaps; it reads fine but loosely (`.prompts/captures/adaptive-map-after/g00/g00-hud-2560x1080.png`).
- Redraw cost grew with the tile count (headless Chromium, `.prompts/time-frames.mjs`): 1366 3.1→4.8 ms, 2000 3.5→6.9 ms, 2560 3.5→7.6 ms per full frame. Within a 60 fps budget; worth watching if animation stutters on slow machines.
- Cleanup: worktree `.claude/worktrees/adaptive-map` (branch `adaptive-map-view`, merged) and remote branch `origin/adaptive-map-view` (deleting it needs the owner's ok). `.prompts/captures/adaptive-map-before-src` is a plain git-archive copy with no node_modules inside, safe to delete.

## Decisions
- Show more world, not spread the HUD (option 1 over option 2): owner chose it after a mock-up ("Make a plan for how to implement option 1").
- Width cap 48 columns: owner: "48 sounds good".
- Row cap 30 rows for tall windows: owner picked "30 rows (Recommended)" on resume.
- Action buttons: owner: "Cap and center buttons". Cap is 112px (×1.25 UI zoom from 1920 = 140px), today's laptop width.
- Tall windows get more rows in this same task: owner: "May as well implement now rather than have to revisit it later".
- The camera keeps clamping at map edges, so the outer wall column can be half cut and the hero sits off-centre near edges. No engine, save or §8.1 file changes.
- `ViewportConfig` gained `maxVirtualWidth/Height`; without them the size stays fixed (old tests still pin that). The renderer re-lays its grid every frame (`layoutGrid()`), so floor changes need no hook — chosen because it's a few arithmetic ops.
- Pushing to main was blocked by auto mode as a production deploy; the owner approved it in chat ("Push to main now").

## Verification
- `npm run gates` (lint, 2860 tests, sim, schema, build, Chromium): green on 44e8f90's tree in the clean worktree.
- pre-push, three browsers: 88 passed, on the branch push and again on the push to main.
- visual-check before/after at 1280, 1366, 1920, 2000, 2560, 1280×1024, 1200×1600: as intended (`.prompts/captures/adaptive-map-{before,after}/`).
