# Handoff: shorter item names, then Session 5
2026-10-12 12:01 UTC · branch main · HEAD 6baa1c5 · tree clean · pushed (155e77e..6baa1c5, pre-push green, 2 Firefox flakes passed on retry)

## Goal
Owner: item names like "Blessed Sanctified Holy Warhammer of the Templar" are confusing and "too long overall"; "double check how long names render". Done: names shortened and pushed. Next is Session 5 of the Notion page "Ideas, bugs, and playtest notes" (id 3daeb012-942f-80fc-ae7a-eb8ae89b401b).

## Decide first
- Some screens still cut long names (captured before the fix, at 52-68 chars; the longest is now 56, "Chaotic Bloodthirsty Heartwood Longsword +4 of Lightning"): the shop sell list cuts at ~30 chars, the Look panel (`x`) cuts with an ellipsis, inventory tiles show only the text after the first " of " (`cellLabel`, `src/ui/inventory/inventoryController.ts:79`, so "Heartwood Longsword +4 of Lightning" reads "Lightning"), and in the shop detail a long name plus the comparison note push the Sell button below the fold at 1280x720. Fix these? — recommend: yes, as one presentation task before Session 5: tiles keep the start of an equipment name, the shop list wraps to two lines, the shop detail keeps Sell visible. Re-capture with `.prompts/scratch/stage2.mjs` (visual-check's script) first, since names are shorter now.

## Done
- 1a83526 feat(items): alignment word names the item, the tier leads its description (`Item.displayName`, `src/engine/items/item.ts:262`; `ItemFamilyDefinition.nameShowsTier` for Chaotic; `withPackNaming` refreshes word/prefix/suffix/description on load).
- 6baa1c5 feat(items): five longest base names shortened (World-Bark Tower Shield, Quicksilver Stiletto, Nisse's Porridge-Spoon, Ice-Knapped Spear, Chieftain's Eye-Coin).
- Uncommitted: none.

## Next
1. Ask the Decide-first question; if yes, do that presentation task (`npm run gates` before committing, `visual-check` before and after).
2. Session 5: Strength knockback perk, then ramping defence (defensive twin of Berserkergang). Read the page's Session 5 and its two design-idea replies first. Knockback: `src/engine/combat/impulse.ts`; perks: `src/content/cotw/perks.ts`.
3. Then Session 6 (balance + one soak, Opus).

## Decisions
- Name scheme: alignment word only; Chaotic shows its variant as a prefix — owner: "Alignment word only (Recommended)".
- Shorten the five longest base names, list approved — owner: "Shorten the top 5 (Recommended)", "Use these (Recommended)".
- Ironclasp Purse stays 2,000 — owner: "approved your recommendation for Olaf's purse".
- An item carries exactly one family (loot rolls one; temple hallowing needs none). The two-family name came from a test that built an impossible item; the test is fixed.
- Items already in a save keep their old base name (the save stores names); new finds use the new ones.

## Verification
- lint + 2914 tests, sim, validate:schema green on 6baa1c5; pre-push (sim, build, Playwright in three browsers) green.
Resumed: 2026-10-12 12:04 UTC
