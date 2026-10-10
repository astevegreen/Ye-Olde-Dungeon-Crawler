# Handoff: remove the battle-hound, cut Ranvild's services to revive and teach
2026-10-10 13:13 UTC · branch main · HEAD fb444b2 · tree clean

## Goal
Owner: "There should only be two companion options, determined by player choice near the end of act 1. Ranvild was created with other companion options that should not exist. Ranvild himself will need some work done because he currently offers things not intended". Done means: `battle_hound` is gone, Ranvild offers only revive and teach, the Oath's two companions (`hearth_frost_hound`, `ember_fang_wolf`, `src/content/cotw/choices.ts:33`) are the only ones, gates are green and the change is pushed.

## Decide first
- Ranvild's new lines (`src/content/cotw/town.ts:153-154`). Greeting: "A hound is only as good as the hand that trains it." Offer: "For a price I can revive a companion that has fallen, or teach it new tricks." Recommend: these, because they read right both before the Oath (no companion yet) and after it.

## Next
1. Content: delete `battle_hound` (`companions.ts:11-19`, comment :6-7), its sprite (`sprites/allySprites.ts:30`, "all three" at :27), `battle()` in `sprites/sculpt/hound.ts:179-191` (its default at :191 needs a new one), and the four barks keyed on it (`narrative.ts:373, 388, 403, 418`). Rewrite `town.ts:153-154` and the kennel tile (`tiles.ts:48`, "bonded and trained").
2. Engine: in `src/engine/economy/services.ts`, remove `bondCompanion` (:546-569), `switchArchetype` (:605-635), their costs (:541, :543) and the unused import (:20). In `src/engine/commands/commandBus.ts`, remove the `trainer_bond_companion` and `trainer_switch_archetype` cases (:509-514, :521-526) and the unused import (:29). Keep these, which other code still uses: `Companion.setArchetype` (the serializer), the bodyguard and skirmisher AI, the save field, and `COMPANION_BONDED_FLAG` (the Oath and `companionWheel.ts:34`). Leave `bondCompanion` in `lastStand.ts:56` and `behaviorTree.ts`: it is the Beast-Friend perk, not this.
3. UI: in `src/ui/shop/shopDialog.ts`, remove the `bond`, `bodyguard` and `skirmisher` cases (:504-513). In `shopPanels.ts`, remove the matching `ShopAction` members (:44-47) and offer rows (:394-397), fix the "T R G K" comment (:376), and rewrite the status text (:381-389), which says "not bonded", for a hero with no companion yet. Help text: `src/ui/help/contextHelp.ts:44`.
4. `engine.ts:588, :594, :599` (§8.1): the JSDoc names `TrainerService`'s bond, and the player message "Seek out a trainer in town" sends a hero with no companion to a trainer who can't help. Prefer `§8.1 exception 1`, with a test showing the message.
5. `src/main.ts:1654-1658`: the summon fallback takes `companions[0]`, which would become the frost hound. Make sure no summon before the Oath hands out a companion. Fix the stale "trainer visit" comments at `choiceAction.ts:137` and `src/engine/types/choice.ts:24`.
6. Tests:
   - Drop the bond and archetype tests: `trainerService.test.ts:20-63, 118-151`, `companionCommands.test.ts:40-53` (summon then needs the flag set by hand), `shopDialog.test.ts:113-116, 197-204`.
   - Rebase the Oath tests that use `battle_hound` as a pre-existing companion: `review-2026-10-06-content.test.ts:46-64, 161`. Can any hero still have a companion before the Oath? If not, that path in `choiceAction.ts` may be dead.
   - `allySprites.test.ts:17` and the `portraitsAndScreens.test.ts:18` comment.
7. Docs: `docs/architecture/content-companions.md:8, :17`; `.claude/skills/add-content/NPC.md:16-17` (index 0 is "the trainer's companion"; the ids-never-change rule).
8. `npm run gates`, then `visual-check` of Ranvild's shop (`scripts/capture/menus.mjs 1366 shop`). Commit with `Requested:` quoting the Goal, then push.

## Decisions
- Ranvild stays a woman (`prologue.ts:123` says "her"): owner: "A woman: keep her".
- Services kept: owner: "Revive a fallen companion", "Teach it new tricks". Bonding a battle-hound and retraining instincts go.
- Old saves holding a battle-hound: owner: "Don't care". `serializer.ts:431-445` falls back on an unknown id (the companion keeps its saved stats and has no registry entry). That is fine as it stands; add no migration.
- No portrait for the battle-hound (wave 9c), now moot.

## Read first
- `src/engine/economy/services.ts:531`: `TrainerService`, what goes and what stays.
- `src/ui/shop/shopPanels.ts:376`: Ranvild's offer rows and status text.
- `src/content/cotw/companions.ts`: the three definitions, and index 0's role.
- `src/engine/engine.ts:585-600`: the flag and the message (§8.1).

## Verification
- `npm run gates`: green on fb444b2's tree (lint, 2855 tests, sim, schema, build, 32 Chromium).
- Pre-push: green (88 Playwright in three browsers); pushed a282cc1..fb444b2.
