# Handoff: magic plan 1a-1, grimoire core
2026-10-15 03:33 UTC · branch main · HEAD e167da4e · tree clean

## Goal
Owner: "Read https://app.notion.com/p/Magic-implementation-plan-15-Oct-2026-3faeb012942f8151966add5a1946da01 and implement phase 1, session 1". Session 1a-1 is done; the plan's next session in lane A is **1a-2, carrying old saves over** (brief on the Notion page, phase 1). 1b-1 and 3a may run beside it in their own worktrees.

## Decide first
- Two steps of Thrift (only reachable on a slot Hel adds two steps out): 36% off (each step takes a fifth of what is left, built) or 40% off (a flat fifth per step) — recommend: keep 36%, because it can never reach a free spell, and step sizes get tuned in phase 7 anyway.

## Done
- 1a624378 test(saves): 8 legacy cotw saves in `tests/fixtures/saves/*.json`, loaded and played a turn by `src/engine/storage/__tests__/legacySaveFixtures.test.ts`
- 9b789a9f docs(architecture): P-28 to P-36 in §9, next free P-37
- e167da4e feat(magic): three-grimoire model, fixture pack only
- Push of all three to main: running in the background when this was written; check `git status -sb` shows no "ahead".

## Next
1. Confirm the push landed (`git log origin/main --oneline -1` = e167da4e); if pre-push failed, rerun once (known flakes), else report.
2. Start 1a-2 from the Notion brief: a pack-declared retired-spell map in manifest types, a new `src/engine/storage/legacyMagic.ts`, seeding placements from old pages when `pData.grimoires` is absent (today `reconcileGrimoireState` seeds from `spellsKnown` order instead), glyph refunds as Essence-Runes, dropping retired statuses.

## Decisions
- Learning with every slot full leaves the spell unlearned (`learnSpellResult` → `full`); `learnSpell` keeps its boolean. Chosen because the brief says "reports full for the card to come".
- A forgotten spell is refused if taught again (`forgotten` outcome), per "forgotten spells are gone for the run".
- Grimoires open by a declared `opensAtSpellsKnown` (4 and 9), not by "no free slot", per "spells known count".
- The area cap applies only to spells with a damage effect, so Hliðskjálf needs no flag (the plan mentioned one).
- `PickGrimoireStatAction` fills an empty axis only; re-picks (Hel, Mimir) call `Player.assignGrimoireStat(..., replace=true)`.
- Pack data reaches the hero as `PlayerConfig.grimoireSystem` from `profile-manager.ts` and the loader, so `engine.ts` stays untouched.

## Read first
- `src/engine/magic/grimoires.ts` — the whole model: state, step math, learn/place/forget, reconcile, save helpers
- `src/engine/entities/player.ts:536` — `grimoireModel()` and the wrappers around it
- `src/engine/storage/serializer.ts` — search `grimoires:` (save) and `grimoireState:` (load)
- `tests/fixtures/fixture-pack/index.ts` — `FIXTURE_GRIMOIRES`, the reference declaration with the plan's step sizes
- `tests/fixtures/saves/legacySaveBuilder.ts` — what each legacy fixture stages

## Verification
- gate-stamp lint test: green on e167da4e (398 files, 2973 tests)
- sim, validate:schema, build: green on e167da4e
- Playwright / pre-push: running at write time
Resumed: 2026-10-15 03:38 UTC
