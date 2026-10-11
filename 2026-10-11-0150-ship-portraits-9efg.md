# Handoff: ship waves 9e–9g portraits (complete)
2026-10-11 02:25 UTC · branch main · HEAD 4d43383 (pushed) · tree clean

## Goal
Owner: "Waves 9e-9g": the last 37 bestiary portraits drawn, ported, registered, gated, visual-checked, committed and pushed.

## Done
- e1598c7 feat(art): portraits for thirty-four of the rank and file (waves 9e-9g)
- 4d43383 feat(art): portraits for the three drakes, the last of the bestiary (wave 9g)
- Every monster has its own portrait: 79 registered in `src/content/cotw/sprites/portraitSprites.ts`, all byte-identical to the bible (`.prompts/captures/bestiary-9efg/frames-all-run.txt`).

## Next
Complete. Next on the art audit (`.prompts/claude-character-art-overhaul.md`, "Left to do"): wave 8's deferred pieces (owner: after wave 9).

## Decisions
- Sheets approved as recommended, no per-sheet wait — owner: "all recommended designs approved".
- `kit.ts` `RampOptions.contrast` added (the bible's ramp option; the fire giant's crust). The bible's `cold:` is still unported; drop it only where bakes stay identical.
- Taste calls to revisit if the owner asks: the Captive of the Chariot lit gold; the Duergar's gold mask; Forge Wretch and Sap-Weeper the plainest reads; the Grave-Wyrmling's body a little blobby; the Coven Warlock's monster name duplicates "Troll-Wife Warlock".

## Verification
- Gate-stamp, `npm run gates` (33 Playwright) and bestiary visual check: green on both commits. Pre-push: 90 passed, 1 flaky (Firefox belt-slot hover, passed on retry).
