# Handoff: Act 2 town physical changes
2026-10-17 11:16 UTC · branch main · HEAD 674543ba · tree 3 uncommitted files (not this task)

## Goal
Bjarnarhaven visibly changes through Act 2; today every Act 2 town change is text. Owner: "start everything in the easy and moderate tiers. Note that hard tier is an option to consider in the future if time and resources allow for it."
Stages, each applied once, in order, stacking (a hero who skips visits gets all due stages at once):
- **Thaw** (`relic_recovered`): fountain flows (text already claims it, tile still frozen), woodpiles/carts/stalls in use, a stall reopens.
- **Roots** (deepest floor counter >= 34, as `homecoming.ts` stage `roots`): tremor cracks, toppled cart, black sap seeps, roots through the road, darker fountain.
- **Herald** (`vidnir_slain`): carts packed by the gate, crowd at the temple, some villagers gone; `vidnir_warning_heeded` → Torvald's wards/rune-stones round the plaza, `vidnir_warning_defied` → weapon racks, war muster.
- **Choice extras:** memorial stones in the temple yard for each `<captive>_sacrificed` (`hostageRitual.ts:315-386`); `oath_broken` → Sól brazier, `oath_honored` → frost shrine to Thrym (`oath.ts:22-23`).
Easy tier: rearrange existing props, townsfolk arrive/leave (reuse villager art via `spriteKey`), shop stock by stage (stock predicates, `town.ts:77`). Moderate tier: new prop tiles + code-drawn art for all of the above.
Done when every stage shows in town, tested, gated, pushed. The summary lists player-visible changes.

## Decide first
- Looks only, or do some changes affect play (a working well heals, a closed stall)? — recommend: looks only, because the frost stages were talk-only by the owner's choice (`hearthCold.ts:8`).
- At Herald, may shopkeepers or service NPCs leave? — recommend: only non-service villagers leave, so no shop or service is lost near the end.

## Next
1. Write a `cotw` post action hook (new file, e.g. `src/content/cotw/townStages.ts`) modelled on `townFurnishings.ts:11-27`: on floor 0, a counter records the last stage applied; apply each due stage's tile and NPC patches in order; skip cells with an entity or item; never block roads, shop doors or NPCs. Register it in `index.ts:182-200`.
2. Easy tier per stage: move or add existing props, add or remove townsfolk (remove + add, as `homecoming.ts:310-338` `seat` and `ironClans.ts:274-293`), and gate shop stock with predicates.
3. Moderate tier: new `townThing` tiles in `tiles.ts`, each with a recipe in `terrain/zones/town.ts:676-705`. The flowing fountain is a 2x2 area tile drawn in quadrants (`~q0..3`): first check a quarter-by-quarter swap draws cleanly. An unregistered tile loads as a wall (`serializer.ts:841-862`).
4. Tests per stage, including skipped visits and the furthest stage on an old save. `visual-check` captures the town at each stage. Grep `e2e/` and `scripts/capture/` for town paths the new props could block. Run `npm run gates`, commit, push.

## Model
Opus 5.5 at high thinking — the staged-patch hook and the passability rules decide the outcome. The art recipes can drop to Sonnet 5.5.

## Decisions
- Hard tier deferred: whole-town snowmelt (needs per-stage floor art switching, an engine capability), falling snow and chimney smoke (no weather rendering exists), new outfits for named townsfolk. Consider it later if time and resources allow. Owner: see Goal.
- Endings can't show in town: both end the run on Floor 50 (`quest.ts:95-98`, `:138`).
- No save-format change and no §8.1 files: the town is a stored floor-0 map whose edits and NPCs save as they are (`serializer.ts:830-855`).
- The uncommitted `e2e/soak.spec.ts`, `e2e/soak/playerBot.ts` and `.claude/skills/soak/SKILL.md` are other work (P-36 soak). Leave them out of this task's commits.

## Read first
- `src/content/cotw/townFurnishings.ts:11` — precedent: a hook that patches the stored town
- `src/content/cotw/homecoming.ts:30` — stage logic from flags and counters; `seat` at :310
- `src/content/cotw/tiles.ts:7` — `townThing` and the town tiles
- `src/content/cotw/terrain/zones/town.ts:676` — prop art recipes
- `src/content/cotw/townLayout.ts:13` — legend, furnishings and buildings, so you know where the roads and doors are

## Verification
- not run: nothing built yet
