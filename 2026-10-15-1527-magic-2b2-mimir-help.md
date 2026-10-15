# Handoff: magic 2b-2, Mimir built, help text next
2026-10-15 15:27 UTC · branch magic-grimoire · HEAD 3eeddcfa · tree 9 uncommitted files

## Goal
Plan step 2b-2 "cotw switch: altars, Mimir, help, tests" (`.prompts/plan-page.txt:310-324`). Hel and Týr are committed; Mimir is built but not committed; the help and hint text is left. The branch deploys nothing until 2c (the forge), so push the branch when 2b-2 is done (no PR to main needed yet).

## Done
- 3eeddcfa feat(magic): Hel re-picks stats or adds a slot; Týr waits for touching spells (gates green, 33/33 Playwright; not pushed)
- Uncommitted, Mimir's restat (unit tests green, lint green, gates not run):
  - `src/engine/types/manifest.ts`: `TownServicesDefinition.grimoireRestat {baseCp, perFloorCp}`; `src/content/cotw/town.ts`: 300 + 30.
  - `src/engine/economy/services.ts`: `SageService.restatOffered/restatPrice/restatGrimoire` (price by `gameState.deepestFloor`, min 1; an unchanged choice is refused unpaid).
  - `src/engine/commands/commandBus.ts`: `sage_restat` `{grimoireId, x, y}`.
  - `src/ui/shop/shopPanels.ts`: 4th sage view `grimoires` (picker, verdict line, offer act `restat`, key G); `sageRestatChoice`; `servicePanelFor` takes a `restat` choice. `src/ui/shop/shopDialog.ts`: holds `restatChoice`, binds `bindRestatPicker`, dispatches on G.
  - Tests: new `src/engine/economy/__tests__/sageRestat.test.ts` (4), `src/ui/__tests__/shopDialog.test.ts` (Grimoires list test).
  - `scripts/capture/menus.mjs` shopScenes: extra shot `sNN-sage-grimoires-<tag>.png`.

## Next
1. Visual check of the sage's Grimoires list: passed. Other shop shots match 3eeddcfa apart from animation noise; the sage's tab row gains "Grimoires"; the new shot is readable, nothing clipped, the G offer and price visible without scrolling (`.prompts/captures/sage-after/s06-sage-grimoires-1366x768.png`). No need to rerun unless the shop UI changes.
2. Help and hints (all magic tests and e2e already match the grimoires; save fixtures already load and play a turn in `legacySaveFixtures.test.ts`):
   - `src/ui/help/contextHelp.ts:109-120` altar card: the tip still says "one clears a debt", and the bullets assume every altar burns an offering. Presentation is pack-neutral, so name no god: one doubles a slot's lend, one chooses a grimoire's stats afresh or adds a slot, free, one transmutes, one gambles.
   - `contextHelp.ts:42` `TOWN_ROLE_HELP.sage`: append "; rearrange grimoire stats" when `manifest.town.services.grimoireRestat` is set (like the pact-keeper append at :301).
   - `src/content/cotw/hints.ts:10` altar hint (name the gods; only Hel's is free, and it also clears the debt) and `:42` grimoire hint (add: Sage Mimir rearranges a grimoire's stats for a fee).
   - grep `e2e/` and `scripts/capture/` for any changed label text.
3. `npm run gates`, then commit Mimir and the help text as separate commits (one request each), `Requested: "300 + 30/floor (Recommended)"` for Mimir. Then `git push` in the background.
4. Loose ends: Magic Arrow's "Piercing" lend has no effect yet (`src/content/cotw/grimoires.ts:74`).

## Model
Sonnet 5.5 at medium thinking: a visual check, help text with a clear spec, gates, and commits.

## Decisions
- Mimir's restat fee: 300 CP + 30 CP per deepest floor: owner picked "300 + 30/floor (Recommended)" (15 Oct).
- Hel's slot on floors 31 and 43 is free: owner picked "Free (Recommended)" (15 Oct).
- Loki's middle outcome already doubles a slot's lend (`altars.ts` `rollGamble`); nothing to do.

## Read first
- `src/ui/help/contextHelp.ts:39-46` and `:107-121`: the cards to rewrite
- `src/content/cotw/hints.ts`: the hints

## Verification
- `npx vitest run` on sageRestat.test.ts and shopDialog.test.ts: green. `npm run lint`: green. `tsc`: clean. Gates: green on 3eeddcfa; not run on the Mimir tree.
