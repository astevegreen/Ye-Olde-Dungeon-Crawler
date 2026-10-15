# Handoff: magic phase 2, 2a-1 Spellbook done, 2a-2 next
2026-10-15 11:24 UTC · branch magic-grimoire · HEAD ba2efca8 · tree clean

## Goal
Magic plan phase 2 (`.prompts/plan-page.txt:231`): cotw moves to the three grimoires on side branch `magic-grimoire`, merging to main once 2c passes `npm run gates`. 2a-1 (Spellbook UI) is committed; 2a-2 is next: quick bar boosted numbers, run-start stat pick, one placement card (plan-page.txt:~262).

## Decide first
- The push of 0a04acf6 hit Firefox flakes once (known hang pattern); a rerun was started in the background (`.prompts/push2.txt`). Check `git status -sb` / `git log origin/magic-grimoire`: if the branch is not on origin, rerun the push once more, and report if red again — recommend: rerun once, because Firefox hangs are known (memory: e2e-known-flakes).

## Done
- 0a04acf6 feat(magic): the Spellbook shows the three grimoires, one at a time (layout B, owner chose "B"). Gates before commit: lint + 3066 tests + sim/schema/build + Playwright Chromium green.
- ba2efca8 docs(handoff) — the owner's own commit (handoff skill now has a Model section); not mine.
- Uncommitted: none. Push of the branch: pending (see above).

## Next
1. Confirm `origin/magic-grimoire` holds 0a04acf6 (see Decide first).
2. Quick bar: boosted numbers beside base ones; casting an unslotted spell goes away (`src/ui/quickSpellsBar.ts:164-166`, `src/main.ts:386-466`). Use `castFromSlot` (`src/ui/characterMenu/spellbookGrimoires.ts`) for the numbers.
3. Run start: title screen gets Máni's first stat, Power preselected (`src/ui/title-screen.ts:365-372`, `src/engine/storage/profile-manager.ts:171-333`); `PickGrimoireStatAction` exists, so presentation calls it.
4. One placement card for every way of learning a spell (place, forget one to make room, not now); today `Player.learnSpellResult` returns outcome `full` (`src/engine/entities/player.ts:549`).
5. Then 2b-1 (cotw switch, Opus): the first real before/after `visual-check` of the Spellbook waits for it; the spike only used mock DOM.

## Model
Sonnet 5.5 at medium thinking — 2a-2 is UI work on a clear spec across known files.

## Decisions
- Spellbook layout B: spell list + detail kept, one grimoire at a time via a switcher — owner: "B"
- Swift ⅔ at two steps; Phase Door and Loki's Switch each set own `lends` in cotw data; dry-run table approved — owner: "approve all recommendations and proceed"
- Engine index now exports only what the UI uses from `magic/grimoires` (knip fails unused exports): grimoireCells, grimoireAxes, isSlotDoubled, pendingStatPicks, slotStatSteps, spellAt, statPickFor, types GrimoireSlotRef/GrimoireState/ResolvedCast. Add more only as used.
- The new view is chosen by `player.grimoireSystem !== undefined`; the old single-grimoire path stays until cotw switches (2b-1) and P-29 deletes it.

## Dead ends
- A `python - <<EOF || py - <<EOF2` heredoc hung the shell; write files with the Edit/Write tools.

## Read first
- `src/ui/characterMenu/spellbookGrimoires.ts` — the view and `castFromSlot`
- `src/ui/characterMenu/spellbookTab.ts:156` — `render` branch, `bindGrimoires`
- `src/ui/__tests__/spellbookGrimoires.test.ts` — fake-container pattern (node env, no jsdom)
- `src/main.ts:513` — option wiring for the new actions

## Verification
- gate-stamp lint test, `npm run gates`: green on 0a04acf6 tree (before commit)
- pre-push: Firefox red once (4 flaky, 1 failed: gameplay.spec.ts:43), rerun in progress
Resumed: 2026-10-15 11:39 UTC
