# ADR-0004: HUD Bars & Viewport Scaling Overhaul

**Date:** 2026-09-16
**Status:** Accepted
**Related:** [docs/architecture/simulation-and-input.md](../architecture/simulation-and-input.md) — Focus & Modal Isolation

## Context
Before this overhaul, `ViewportManager.recalculate()` (`src/rendering/viewport.ts`) guessed the header/footer bars' combined height as two hardcoded constants, and didn't account for the ground-status-bar or quick-spells-bar at all. The header and bottom bars used `flex-wrap: wrap`, position and turn count were drawn twice (once in the DOM header, once by `canvas-renderer.ts`'s internal HUD), `Escape`/the Save & Quit button had no visible affordance beyond the key itself, and the `[P] Pacts` action had no persistent glyph teaching the key.

## Decision
- **Real letterboxing math:** `ViewportManager.recalculate()` now sums `getBoundingClientRect().height` for every bar actually mounted (`SURROUNDING_BAR_IDS`) and re-runs via a `ResizeObserver` on `#center-viewport` whenever any of them changes size. A header wrapping to two lines used to silently overflow the viewport and get clipped by `body { overflow: hidden }`; that's no longer possible, since the bars themselves never wrap now either. A `maxScale` config (default 4) replaces the old hard `max-width: 960px` CSS cap on `#game-container`, which used to fight the JS-computed width on large/high-res displays.
- **Bars never wrap, they collapse:** `.hud-bar-row`/`.hud-btn-group`/`.hud-btn` (`src/ui/styles/layout.css`) replace the header and bottom bars' old `flex-wrap: wrap`. Each button is `<icon> <key> <word>`; a `@container` query on `#game-container` (sized against the letterboxed canvas width, not the browser viewport — a `@media` query would miss a narrow-but-tall window) drops the word below 720px and the key below 460px, icon+key/icon-only surviving via the button's `title` tooltip. Below that, `.hud-btn-group` scrolls horizontally rather than clipping a button invisibly.
- **One turn counter, not three:** position and turn count used to be shown in the DOM header (`#header-pos`/`#header-turns`) *and* independently drawn by `canvas-renderer.ts`'s own internal HUD (`POS: (...) | TURN: ...`). Position was dropped from the always-on HUD entirely (Look-mode/Map territory in the reference roguelikes this pass drew on — Brogue, DCSS, Cogmind, NetHack); the sole remaining turn readout lives in `BottomStatusBar`'s ground-status-bar (`.ground-status-turn`).
- **Esc is the menu, not a silent instant-quit:** the header's `[Q] Save & Quit` button and the `Escape` key both already opened `SaveQuitModal` (Resume/Settings & Controls/Help/Save & Exit) — only the key had no visible affordance. The button is now labeled `☰ [Esc] Menu`.
- **Every actionable key gets a persistent glyph:** `InputHandler.togglePactModal()` (extracted from the `KeyP` case, mirroring `toggleInventory()`) is now shared by the keybind and a new bottom-bar button, so `[P] Pacts` is discoverable without a badge that only appears once a pact is already sealed.
- **Standard Input already lets you click:** the default "Standard (NumPad & Vi-Keys)" input-mode card in `keybindModal.ts` now documents that clicking a tile moves/attacks/auto-pathfinds (`CanvasRenderer.mouseVectoringEnabled = true`, on by default) instead of burying that fact under the separate, checkbox-gated "Hover Ring" card.

## Rationale
Each change closes a gap between what the UI silently assumed (fixed bar heights, a single always-visible turn readout, an affordance-free Escape key) and what actually varies at runtime (wrapping headers, duplicate HUD state, undiscoverable keys). None of it touches simulation code — it is presentation-only, and behaviorally the "current state" text in `docs/architecture/simulation-and-input.md` already describes the result, not this retrospective.

## Consequences
None outstanding — this is a closed retrospective, not an ongoing invariant. Future viewport/HUD work should read `ViewportManager.recalculate()`'s current implementation directly rather than this ADR.
