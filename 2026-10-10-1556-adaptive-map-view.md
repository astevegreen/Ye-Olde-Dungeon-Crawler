# Handoff: adaptive map view (fill wide and tall windows)
2026-10-10 15:56 UTC · branch main · HEAD 1a8ecb9 · tree clean

## Goal
Owner, on a 2000×990 window: "On the left and right sides there is a bunch of dead space. Why is it empty". Cause: the map is a fixed 960×600 virtual canvas (30×18 tiles of 32px) aspect-fitted by `src/rendering/viewport.ts:211`, so whenever the room left by the bars isn't 16:10, the canvas leaves empty strips. Done: the view shows more tiles instead of strips (width 30–48 columns, height 18 up to a row cap), the action-button row is capped and centred, and gates, visual checks and the push are green.

## Decide first
- Row cap for tall windows: how many tiles top to bottom at most? recommend: 30 rows, because maps are 36–40 tall, so like the 48-column cap it leaves some vertical scrolling and keeps the hero nearer centre

## Next
1. `viewport.ts`: work out the virtual size in `recalculate()` before the scale (the fields at :37-38 are readonly; defaults at :87-88). Wider than 16:10: height 600, width `floor(600·availW/availH)`, clamped to [960, 48·32]. Taller: width 960, height `floor(960·availH/availW)`, clamped to [600, cap]. Use floor, since tests :136-196 depend on rounding. `MIN_COLUMN_WIDTH` (:34, :237-238) becomes nearly dead: keep it only for the clamped cases, otherwise delete it (knip). `watchDpr` (:138-141) must call `notifyResize()`, not only `recalculate()`.
2. `canvas-renderer.ts:452-467`: take columns and rows from the virtual size, not the hard-coded `min(map.width,30)` / `min(map.height,18)`. Use `ceil` with a negative offset so partial edge tiles fill to the edge, and an odd count so the hero is centred. Recompute on floor change too (`onFloorChanged` :403-405, `setEngine` :408-411): `resize()` runs only on window, observer and UI-scale events, so a 57-wide floor followed by the 56-wide town leaves a stray black column. Check that the clamp in `camera.ts:16-35` and the culling at :51/:80 still hold with partial tiles. Keep the private names `camera`, `cellSize`, `offsetX`, `offsetY` and `viewport`: `e2e/gameplay.spec.ts:240,825,893` reads them.
3. `src/ui/styles/layout.css:987-992`: the 8 action buttons are `flex:1 1 0` with no max-width. Cap them near today's width (~120px at 1366) and centre the row. Leave `#hud-admin-bar` (:978-980, space-between) as it is.
4. Tests: `src/rendering/__tests__/viewport.test.ts` :34-46, :48-67 and :118-134 fail by design, so rewrite them. Add cases for the 48-column cap, the tall-window rows and the floor-change recompute. `e2e/gameplay.spec.ts:298-308` (bars inside 1920 width, +1px) will be tight now the bars reach the edge.
5. Docs and comments (§8.2): `docs/decisions/0011-menus-and-visual-system-direction.md:32-34`, `docs/architecture/simulation-and-input.md:33`; `layout.css` :50-54, :62-70, :98, :120-123; `viewport.ts` :11-16, :29-34; `canvas-renderer.ts:455`; `theme.ts:319`; `index.html:14`.
6. Verify: `npm run gates`. Use `visual-check` at 1280×720, 1366×768, 1920×1080, 2000×990, 2560×1080 and one tall window. `hud.mjs` and `map-scene.mjs` crops change size, so `diff.mjs` reports a size mismatch: judge the images and take fresh baselines. Time frames before and after at the widest size: every frame redraws every tile, about +60% at the cap. Then commit and push.

## Decisions
- Show more world, not spread the HUD (option 1 over option 2): owner chose it after a mock-up ("Make a plan for how to implement option 1").
- Width cap 48 columns: owner: "48 sounds good".
- Row cap 30 rows for tall windows: owner picked "30 rows (Recommended)" on resume.
- Action buttons: owner: "Cap and center buttons".
- Tall windows get more rows in this same task: owner: "May as well implement now rather than have to revisit it later".
- The camera keeps clamping at map edges (no black beyond them), so the hero sits off-centre more often; the owner was told. Minimum view stays 30×18. No engine, save or §8.1 file changes: the engine is FOV-only, and nothing saved stores the view size.

## Push summary needs
Nearly every player sees more map, not only wide screens: 1366×768 goes from 30 to ~40 columns, 1920×1080 to ~39, and the owner's window to ~46. Dungeons reveal no extra live monsters (sight radius ~8 already fits); you see more remembered map and Detect pings. The orbs move outward and log lines get longer. Soak seeds aren't comparable across this change: the chaos policy clicks random canvas points (`e2e/soak/policies.ts:50-52`).

## Read first
- `src/rendering/viewport.ts:160-245` — the fit maths
- `src/rendering/canvas-renderer.ts:400-470` — `resize()` and the tile grid
- `src/rendering/camera.ts:9-90` — centring, clamp, culling
- `src/rendering/__tests__/viewport.test.ts` — what pins today's sizes

## Verification
- not run (planning only, no code changed)
Resumed: 2026-10-10 16:34 UTC
