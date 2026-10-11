# Handoff: spell colours, portal label, blast centre (art follow-ups)
2026-10-11 12:10 UTC · branch main · HEAD 5e92adc · tree clean

## Goal
Owner: "note the spell colors, portal label, and blast area as to-do". These are three small follow-ups left by wave 8's deferred art (`eadc8f6`, pushed). Done means each one is settled, then committed and pushed as its own commit through `npm run gates`.

## Decide first
- Spell colours: fire is the owner's yes already (11 Oct). Do frost, lightning and poison move to the bible's hues too? Those are `#9fe6ff`, `#fff27a` and `#95dc4c`, replacing `#38bdf8`, `#eab308` and `#22c55e`. — recommend: yes, all four in one commit, because the bible's rule is one palette, and the 11 Oct "proceed with all recommendations" covered "also frost/lightning/poison". Ask anyway, since it recolours every spell's aim line, blast zone and damage number.
- Portal label: the "<name> · step in" pill (now under the portal) is wide enough to cover the creatures beside the portal. Show the pill only while the hero is within 2 tiles (or the mouse is over the portal), and let the floating map tag mark it from afar? — recommend: yes, because the tag now does the "never missed" job the always-on pill was for.
- Blast area: a thrown burst (fireball) stops at the first creature in its path and bursts there, not on the aimed tile. The preview shows that honestly (it reads the same geometry). Keep the rule or fly over creatures to the aimed tile? — recommend: keep the rule, which is classic roguelike and tactical, and make the preview say so: draw the reticle on the burst's real centre when it differs from the aimed tile. Changing the rule is a balance call for the owner.

## Done
- eadc8f6 feat(art): rune-ring wheel, map tags, new aim reticle and blast zone, HUD icons (wave 8 deferred)
- 5e92adc chore(art): delete the old item and monster recipes the pixel sprites replaced

## Next
1. Spell colours: edit `src/content/cotw/elements.ts:6-9` (content, not engine). Grep `e2e/`, `scripts/capture/` and tests for the old hex values. Check fire damage numbers still differ from the danger red (`--ui-bad`). Use `visual-check` for the aim line and blast in Aim mode.
2. Portal label: `portalCards()` at `src/rendering/canvas-renderer.ts:1369`. Add the distance and hover condition; the pill's placement (`below: true`, `src/ui/mapCards/mapCardLayer.ts`) stays.
3. Blast: the preview is drawn in `src/rendering/targeting-overlay.ts:340-349`; the geometry is in `src/engine/magic/castTrace.ts:42-52` (not a §8.1 file). For "keep the rule", change only the overlay: mark `geo.burst.epicenter` when it isn't the reticle tile.

## Decisions
- All three Decide-first questions as recommended: four colours in one commit; portal pill only within 2 tiles or on hover; keep the burst rule and mark the real centre — owner: "implement all items as recommended" (11 Oct resume)
- Fire goes from red `#ef4444` to the bible's orange `#ff8a2c`, as its own small task — owner: "proceed with all recommendations" (11 Oct resume).
- HUD icons look a little soft in some chips; the proper fix bakes each icon at its real on-screen size (`installUiIcons`, `src/rendering/uiIcons.ts`). Explained to the owner 11 Oct; recommended later, not asked for.

## Read first
- `src/rendering/targeting-overlay.ts:330` — how the aim preview uses `castGeometry`
- `.prompts/captures/w8d-z2/zoom-g1.png` — the portal pill covering the kobold beside the portal

## Verification
- gates (Chromium) and pre-push (three browsers, 91 passed): green on 5e92adc
Resumed: 2026-10-11 12:12 UTC
