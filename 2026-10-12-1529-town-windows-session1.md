# Handoff: Notion plan Session 1, town windows
2026-10-12 15:29 UTC · branch main · HEAD a1621dd3 · tree 9 uncommitted files

## Goal
"Do session 1 of the Ideas, bugs, and playtest notes Notion page." Session 1 (Sonnet) = four town-window fixes: bank "Deposit", temple wording, one shared appraisal for buy/sell/details, shopkeepers buy only their own trade. Page: https://app.notion.com/p/3daeb012942f80fcae7aeb8ae89b401b (fix plan toggle at top).

## Done
- All four changes are coded and uncommitted (the owner asked for four requests, so four commits):
  - Bank: `src/ui/shop/shopPanels.ts:311,323,327` tab/button "Deposit", key L -> D.
  - Temple: `TempleOfferingsDefinition` gains optional `label`/`detail`/`note` (`src/engine/types/manifest.ts`), pack text in `src/content/cotw/town.ts` (templeOfferings), used at `shopPanels.ts:136,155`.
  - Prices: `appraisedValue()` in `src/engine/economy/merchant.ts`; buy and sell both use it (known good 1.5x, bad 0.1x, chaotic/unknown flat). Details panel already reads buy/sell price via `shopDialog.ts priceOf`.
  - Trade: `MerchantConfig.buys` + `Merchant.buysItem` (merchant.ts); `buys` set for Olaf, Gunther, Astrid in town.ts; `shopDialog.ts getSellableItems`, `commandBus.ts` sell_junk and `sellItem` use it.
- Tests updated: merchant.test.ts (Astrid sells tonic; new trade + appraisal tests), town-persistence.test.ts (dagger sold to Gunther), shopDialog.test.ts (D key).
- `npm run gate-stamp -- run lint test`: green (395 files, 2920 tests).

## Next
1. Read the `npm run gates` result: it was started in the background and wrote `C:\Antigravity\scratch-gates.txt` (ends with `exit N`); if missing or non-zero, rerun `npm run gates > ../scratch-gates.txt 2>&1`.
2. Split into four commits, one per request, each with a `Requested: "<owner words from the Notion note>"` trailer. Files are mixed (shopPanels.ts, merchant.ts, manifest.ts, town.ts, shopDialog.ts, commandBus.ts): stage by hunk, e.g. `git diff -U0` filtered into `git apply --cached`. Order: bank, temple, prices, trade.
3. Re-run gate-stamp per commit tree if hooks require it, then `git push` in the background.
4. Summary for owner, player-visible lines: bank says Deposit (key D); temple explains what offerings do; buy prices now reflect known alignment; Olaf won't buy weapons/armour, Gunther only gear, Astrid potions/amulets/rings.
5. Then update the Notion plan: remove Session 1 or mark it done, per memory notion-plan-answers.

## Decisions
- Olaf buys consumable, container, light, cloak, misc; Gunther weapon, armor, shield, helmet, boots, gauntlets, bracers; Astrid consumable, amulet, ring, misc — chosen so every category has a buyer; owner has not seen this list.

## Verification
- lint + test: green on tree at HEAD a1621dd3 + uncommitted changes
- gates (sim, schema, build, Chromium e2e): running/not confirmed
Resumed: 2026-10-12 15:49 UTC
