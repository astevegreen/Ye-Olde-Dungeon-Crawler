# Handoff: magic 2c, the forge (commit 4 of 4 next)
2026-10-15 16:36 UTC · branch magic-grimoire · HEAD d97154b7 · tree clean

## Goal
Plan step 2c "The forge" (`.prompts/plan-page.txt:325-345`). Owner: "can we begin step 2c?". Done = 4 commits on `magic-grimoire`, each through `npm run gates`, each `Requested: "can we begin step 2c?"`; then ask the owner about merging `magic-grimoire` to `main` (plan `:242`).

## Done
- 603b2315 feat(magic): Odin's forge adds a second element to a known spell (not pushed)
- 918f1a5f feat(magic): Ivalda and Skuld give free forges that wait for a spell (not pushed)
- d97154b7 feat(magic): the forge replaces the 12 fused spells; runestones tell of pairs (not pushed). Hybrids map to base spell + forge in `cotw/grimoires.ts` `retired.spells`; lore `forgePair` replaces `fusionSpellId`; Spellbook card `renderForging`; `legacyMagic.ts` keeps one carried-over forge per spell.
- Uncommitted: none

## Next
1. Commit 4: Eihwaz poison Essence-Rune (`src/content/cotw/items/essences.ts:19-59`, `COTW_ESSENCE_BY_ELEMENT`), dropped by poison spells' shards like the others (plan `:332`); check `SPELL.md` step 3 ("`poison` has no essence and no rune") and the Ivalda forge's "any essence element" pick.
2. Visual check g03, g09b, g19 at 1366 and 1280 (plan `:345`); `git push` in background; ask owner about merging `magic-grimoire` to `main`.

## Model
Sonnet 5.5 at medium thinking — commit 4 is routine content with a clear spec; the gates and visual check are mechanical.

## Decisions
- Forge offers wait as pending state, claimed by index; the card auto-opens once per offer and reopens from the Spellbook — so Esc never loses a free forge.
- Retired hybrids carry over as a normal (not fated) forge; two hybrids folding into one base keep the first.
- The Forging card counts only the pack's titled pairs (12); untitled forgings still show on the spell's own title.
- Runestone choice option id `thunder_maul` kept: it is a choice id, not a spell, and renaming could break replay trails.

## Read first
- `.prompts/plan-page.txt:325-345` — step 2c spec
- `src/content/cotw/items/essences.ts:19-59` — where Eihwaz goes
- `src/ui/characterMenu/spellbookTab.ts` `renderForging` — the new card, for the visual check

## Verification
- `npm run gates`: green on d97154b7 (3080 unit, 33 Chromium).
