# Handoff: 6b wave-2 spells built
2026-10-16 01:46 UTC · branch main · HEAD 57fbf17a · tree clean

## Goal
Continue the owner's magic implementation plan. 6b (the seven wave-2 spells as cotw data) is built and pushed; what is left is checking they play right, then the plan's later phases (P-36, measuring magic, last per the owner's 13 Oct order).

## Decide first
- Numbers I chose where the plan was silent (Mire 2 poison/turn and a fifth off armour, Fylgja burst 10 shadow, Rime-Thurs 80 HP and shatter 14 cold, mana costs 5–14, zone placement) — recommend: keep until a playtest, because tuning belongs to P-36's measurements.

## Done
- 57fbf17a feat(cotw): the seven spells in `src/content/cotw/waveTwoSpells.ts`; zones in `learningStones.ts`, tablets in `spellTablets.ts` (tablet_lightning_bolt gone), `grimoires.ts` retired map `lightning_bolt: 'hammer_throw'` (fusions now point at hammer_throw), summons in `monsters/summons.ts`, poison rune `spell~poison`.
- Raise Cairn's wall HP = 30 (owner: "Your pick").
- Hero's point-blank blast catches the caster: kept (owner: "Keep").
- Uncommitted: none.

## Next
1. Write a headless test casting each of the seven in a real engine (none exists): Fylgja bursts when struck and at expiry, Rime-Thurs shatters on expiry and when slain, Mire's mired status lowers defence, Hammer-Throw hits twice, Cairn blocks a path, a saved hero's Lightning Bolt loads as Hammer-Throw.
2. Check `MIRED` defence modifier and `endings` effects in `waveTwoSpells.ts` behave (endings run with no `tiles`, so Rime-Thurs lays no ice sheet, only damage and paralysis).
3. Then P-36 only when the owner asks (§9).

## Model
Opus at high thinking — step 1 may expose engine bugs to trace; Sonnet is enough if tests pass first time.

## Decisions
- Wave-2 numbers (Mire, Fylgja, Rime-Thurs, mana costs, zones) stay as built until P-36 measures them — owner: "keep current numbers"

## Dead ends
- Rime-Thurs "shatters into ice" as a laid surface — ending effects get no cast tiles, so `lay` cannot run there; used cold damage plus paralysis instead.

## Read first
- `src/content/cotw/waveTwoSpells.ts` — all seven, statuses, handlers.
- `src/engine/status/endings.ts:25` — how endings fire.
- `src/engine/__tests__/tempWalls.test.ts` — a working spell test pattern.

## Verification
- lint + test: green on 57fbf17a (3,258). Pre-push (sim, build, 3 browsers): green, pushed.
Resumed: 2026-10-16 01:47 UTC
