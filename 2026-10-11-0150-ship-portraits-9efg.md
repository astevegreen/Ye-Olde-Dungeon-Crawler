# Handoff: ship waves 9e–9g portraits (34 ported, drakes pending)
2026-10-11 01:50 UTC · branch main · HEAD ed3c2be · tree 16 uncommitted files (below)

## Goal
Owner: "Waves 9e-9g": the last 37 bestiary portraits drawn, ported, registered, gated, visual-checked, committed with `Requested: "Waves 9e-9g"`, pushed. Done = all 37 in the bestiary on the Pages site.

## Done
- No commits yet. Uncommitted, all verified with the fidelity tool (`.prompts/fidelity-all.txt`: all 304 frames, 608 bakes identical across 76 portraits) and `tsc`:
  - 12 new port files `src/content/cotw/sprites/sculpt/portraits{Goblins,Witches,DarkArts,Brutes,Giants,HiddenFolk,FaeSlag,Bound,Constructs,Fiends,Dwarves,WorldBark}.ts` (34 portraits: 9e all, 9f all, 9g a/c/d).
  - `sculpt/materials.ts`: 13 group headers at the end, materials under 12; the `(portraitsDrakes.ts)` header is still empty.
  - `sculpt/kit.ts`: `RampOptions.contrast` (bible's ramp has it; the fire giant's crust uses 0.8; default 1 is bake-neutral).
  - `portraitSprites.ts` registers the 34; `__tests__/portraitsAndScreens.test.ts` `CREATURES` lists them.
- Re-timed in fresh pages (`.prompts/retime-9efg.txt`): 35–85 ms a frame at 192 px, all under 120.
- Running when written: `npm run gate-stamp -- run lint test` → `.prompts/gate-9efg.txt` (last line `exit N`); and an artist finishing 9g-b in `bible/js/m-portraits-9g-b.js` (the Ancient Wyrm was a "placeholder"; the Grave-Wyrmling was a copy of the Frost Drake). At 01:50 the file already registers its own `graveWyrmling`.

## Next
1. Read `.prompts/gate-9efg.txt`. Red: fix (likely the portraits test's 30 s timeout with 34 more bakes) and rerun.
2. `npm run gates`, then `visual-check` the bestiary for the 34 (as 9d: `.prompts/captures/bestiary-9d/`). Commit: subject like "feat(art): portraits for thirty-four of the rank and file (waves 9e–9g)", trailer `Requested: "Waves 9e-9g"`. Push in the background.
3. 9g-b: check the file's three `S.def` notes no longer say 'placeholder', shoot `node .prompts/character-art-bible/tools/shot.mjs sheet-9g.html .prompts/art-review/w9/sheet-9g-r.png 1900` and Read it (wyrmling: small, violet, bile-green, not Níðhögg's double). Weak → a fresh artist per `BRIEF-9efg.md`, tag b.
4. Port 9g-b per `bible/PORT-9efg.md` (target `portraitsDrakes.ts`, exports `frostDrakePortrait, ancientWyrmPortrait, graveWyrmlingPortrait`; already in the fidelity tool). Register `frost_drake, ancient_wyrm, grave_wyrmling`, add to `CREATURES`, re-time, gates, commit, push.
5. Log in `.prompts/claude-character-art-overhaul.md` after line 260 (shipped shas, taste calls below); update memory `art-overhaul-plan`.

## Decisions
- Sheets approved as recommended, no per-sheet wait — owner: "all recommended designs approved".
- One request ("Waves 9e-9g"), so one commit for the 34 and one for the drakes, not one per wave: `materials.ts` holds every wave's materials and partial staging is interactive.
- Taste calls to log: the Captive of the Chariot is lit gold (its map sprite's colour; a captive sun-spirit, against the "gold = holy" rule); the Cinder-Gilded Duergar's mask is gold; 9g-c and 9g-d were drawn with few review looks (Forge Wretch, Sap-Weeper the plainest reads).
- `cold:` dropped from `scr_captiveLight`/`scr_captiveRay` (bake-neutral, as 9d's).

## Read first
- `.prompts/character-art-bible/bible/PORT-9efg.md` — port rules for step 4.
- `src/content/cotw/sprites/portraitSprites.ts:105` — the new registrations.
- `.prompts/character-art-bible/tools/portrait-fidelity.ts:38` — bible files and port lists (a bible file that fails to parse is now skipped).

## Verification
- Fidelity: green, 76 portraits. tsc: green (port agents). Gate-stamp: running at write time. Gates/Playwright, visual-check: not run.
