# Handoff: magic 2c, the forge (commit 2 of 4 written, uncommitted)
2026-10-15 16:23 UTC · branch magic-grimoire · HEAD 603b2315 · tree 22 uncommitted files

## Goal
Plan step 2c "The forge" (`.prompts/plan-page.txt:325-345`). Owner: "can we begin step 2c?". Done = 4 commits on `magic-grimoire`, each through `npm run gates`, each `Requested: "can we begin step 2c?"`; then ask the owner about merging `magic-grimoire` to `main` (plan `:242`).

## Done
- 603b2315 feat(magic): Odin's forge adds a second element to a known spell (commit 1, not pushed)
- Uncommitted: commit 2, Ivalda and Skuld forges. Code complete; targeted tests green; first gates run failed only on knip (unused `ForgeOffer` export in `src/engine/index.ts`), since removed; tsc and knip clean after. Files:
  - Engine: `types/choice.ts` (`offerForge` consequence), `magic/grimoires.ts` (`ForgeOffer`, `GrimoireState.forgeOffers`, create/copy/serialize/read), `storage/types.ts`, `entities/player.ts` (`pendingForgeOffers`, `offerForge`, `takeForgeOffer`), `actions/choiceAction.ts`, `actions/spell-actions.ts` (`ClaimForgeOfferAction`), `magic/altars.ts` (`forgeOfferElements`), `debug/replay.ts`.
  - UI: new `src/ui/forgeOfferCard.ts` (+ `__tests__/forgeOfferCard.test.ts`); `altarModal.ts` exports `forgePreviewHtml` (shared preview); `spellbookTab.ts` "Free forges" card + `onOpenForgeOffer`; `main.ts` card wiring and auto-open step 'forge offers'.
  - Content: `ironClans.ts` option `steam_lance` → `forge_spell` (free forge, any essence element); `choices.ts` Skuld renewal/ragnarok → fated healing "of Renewal" / shadow "of Hel-fire"; `renown.ts`, `elements.ts` wording.
  - Tests: `altars.test.ts` (3 new), `ironClans.test.ts`, `nornicReliquaries.test.ts`, `legacyMagic.test.ts` fixture. Doc: `content-extensibility.md` lists `offerForge`.

## Next
1. `npm run gates > .prompts/gates.txt 2>&1`; when green, commit 2: `feat(magic): Ivalda and Skuld give free forges that wait for a spell`, trailer `Requested: "can we begin step 2c?"`.
2. Commit 3, remove hybrids: delete `src/content/cotw/hybridSpells.ts`, `HybridRecipe`/`magic.hybrids` (`magicConfig.ts:23,~263`), refs in `magic.ts`, `spells.ts`; retired map in `cotw/grimoires.ts` `retired.spells` (steam_lance→cold_ray+fire, surtr_brand→lightning_bolt+fire, hagalaz_hail→cold_ray+lightning, rune_flare→fireball+arcane, rime_shard→cold_ray+arcane, galdr_spark→lightning_bolt+arcane, hel_fire→firebolt+shadow, forge_bolt→firebolt+physical, ice_spear→cold_ray+physical, thunder_maul→lightning_bolt+physical, renewal→heal_spell+arcane, iron_blessing→heal_spell+physical). `LoreEntry.fusionSpellId` → pair hint (`manifest.ts:215`, `runestones.ts:98-131`, `:232`); Fusions card `spellbookTab.ts` `renderFusions` → Forging card; tests `spellbookFusions.test.ts`, cotw `altars.test.ts:32`, `legacySaveFixtures.test.ts:55`, `runestoneText.test.ts`, `killRites.test.ts:13`; `.claude/skills/add-content/SPELL.md`.
3. Commit 4: Eihwaz poison Essence-Rune (`items/essences.ts:19-59`, `COTW_ESSENCE_BY_ELEMENT`).
4. Visual check g03, g09b, g19 at 1366 and 1280 (plan `:345`); push; ask owner about merging to main.

## Model
Opus at high thinking: commit 3 deletes a content system across layers and adds a save map.

## Decisions
- Forge offers wait as pending state (`forgeOffers`), claimed by index; the card auto-opens once per offer object (`WeakSet` in `main.ts`) and reopens from the Spellbook — chosen so Esc never loses a free forge.
- Ivalda's forge kept in both her grotto and town choices (as Steam Lance was) — chosen as the smaller change; she moves to town once trusted anyway.
- Claiming costs a turn only with foes in sight (`grimoireEditCost`), like other grimoire edits.
- A fated forge onto a spell already forged with that element is refused — chosen for simplicity (one Skuld choice per run).

## Read first
- `src/engine/actions/spell-actions.ts` `ClaimForgeOfferAction`
- `src/engine/magic/grimoires.ts` `ForgeOffer`, `forgeSpellElement`
- `.prompts/plan-page.txt:325-345`

## Verification
- `npx vitest run` altars/ironClans/nornicReliquaries: 39 green; `src/ui`: 510 green; tsc + knip clean after the export fix. Full gates: not yet green on the final tree (first run failed on knip only).
Resumed: 2026-10-15 16:26 UTC
