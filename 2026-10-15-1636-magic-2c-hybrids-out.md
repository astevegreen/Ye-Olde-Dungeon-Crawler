# Handoff: magic 2c, the forge (commit 3 of 4 written, uncommitted)
2026-10-15 16:36 UTC · branch magic-grimoire · HEAD 918f1a5f · tree 23 uncommitted files

## Goal
Plan step 2c "The forge" (`.prompts/plan-page.txt:325-345`). Owner: "can we begin step 2c?". Done = 4 commits on `magic-grimoire`, each through `npm run gates`, each `Requested: "can we begin step 2c?"`; then ask the owner about merging `magic-grimoire` to `main` (plan `:242`).

## Done
- 603b2315 feat(magic): Odin's forge adds a second element to a known spell (not pushed)
- 918f1a5f feat(magic): Ivalda and Skuld give free forges that wait for a spell (not pushed)
- Uncommitted: commit 3, remove hybrids. Code complete; last gates run failed only on `spellRunes.test.ts` (spell count >30, now 30; lowered to >20); a gates rerun was in flight when this was written, result unknown.
  - Engine: `magicConfig.ts` (`hybrids`/`HybridRecipe` gone), `types/manifest.ts` (`fusionSpellId` → `forgePair: [a, b]`), `magic/grimoires.ts` + `index.ts` (`forgePairKey`), `storage/legacyMagic.ts` (one carried-over forge per spell: first wins, an existing non-fated forge wins).
  - Content: `hybridSpells.ts` deleted (plain `rm`); `magic.ts`, `spells.ts` refs gone; `grimoires.ts` `retired.spells` maps all 12 hybrids; `runestones.ts` lore 2-6 rewritten as forge hints with `forgePair`, hybrid names removed from descriptions and resolved messages.
  - UI: `spellbookTab.ts` `renderForging` (was `renderFusions`): titled pairs forged on a known spell or told by read lore, "N of 12 known"; CSS `.sb-fusion*` → `.sb-pair*` in `menu.css`.
  - Tests: new `spellbookForging.test.ts` (old `spellbookFusions.test.ts` deleted), cotw `altars.test.ts` (forging pairs + retired map), `killRites.test.ts`, `runestoneText.test.ts`, `spellRunes.test.ts`, `legacyMagic.test.ts`, `legacySaveFixtures.test.ts`.
  - Docs: `content-extensibility.md` altars row, `.claude/skills/add-content/SPELL.md`, `SKILL.md`.

## Next
1. `npm run gates > .prompts/gates.txt 2>&1`; when green, `git add -A` and commit 3: `feat(magic): the forge replaces the 12 fused spells; runestones tell of pairs`, trailer `Requested: "can we begin step 2c?"`.
2. Commit 4: Eihwaz poison Essence-Rune (`src/content/cotw/items/essences.ts:19-59`, `COTW_ESSENCE_BY_ELEMENT`), dropped by poison spells' shards like the others (plan `:332`); check `SPELL.md` step 3 ("`poison` has no essence and no rune") and the Ivalda forge's "any essence element" pick.
3. Visual check g03, g09b, g19 at 1366 and 1280 (plan `:345`); `git push` in background; ask owner about merging `magic-grimoire` to `main`.

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
- Commit 3 tree: tsc clean; targeted vitest green (legacyMagic 17, spellbookForging 2, cotw altars 6, runestoneText/killRites/legacySaveFixtures); full gates: last run 1 failure (spell count, since fixed), rerun result unknown.
