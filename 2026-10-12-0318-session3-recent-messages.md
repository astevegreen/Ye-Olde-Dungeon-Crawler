# Handoff: Session 3, seeing danger and results from menus
2026-10-12 03:18 UTC · branch main · HEAD e55e77d · tree clean (Sessions 1 and 2 pushed)

## Goal
Owner: "proceed with phase 2 from the Notion plan"; Session 3 is the page's next block (Notion page "Ideas, bugs, and playtest notes", id 3daeb012-942f-80fc-ae7a-eb8ae89b401b, Sonnet). Done = each box below works and is ticked on the page:
- The character menu shows the last few log lines and your health, so identifications and attacks are visible while it is open.
- A warning appears when a monster attacks you or comes into view while the menu is open: a flash plus a log line. The menu stays open (the owner decided this).
- The inventory gets a purse meter ("Purse 120 / 1,000").
- Dropping a stack asks how many.
- The death screen shows the last log lines and has a Report a bug button (F3 works there too), screenshot included.
One new "recent messages" strip is built once and reused by the inventory, identification and the death screen.

## Decide first
- none; Sessions 1 and 2 settled everything Session 3 needs.

## Done
- Session 1 pushed (1d2be1f rings, 1f598e0 "mana" wording, 71b909f Essence-Rune stacking, ebfd935 Bestiary sort, 935a14a guard hint, 0e78809 packs spawn identified).
- Session 2 pushed 12 Oct: 894c2cd shop (HUD and log refresh on click, Pacts tab), e55e77d altar (shared grid, taller list). Notion boxes for Sessions 1 and 2 are ticked.

## Next
1. Read the Notion page's "Code pointers" toggle, then look at how the log is drawn behind the character menu: `src/ui/styles/layout.css:29` blurs and dims the sidebar and HUD while it is open, so the strip must sit above that scrim.
2. Build one shared strip component in `src/ui/` (last N log lines plus HP/Seiðr). Reuse `src/ui/messageLogModal.ts` for the log source; pack-neutral wording (§3). Mount it in the character menu (`src/ui/characterMenu/characterMenuModal.ts`) and the death screen (`src/ui/gameOverDialog.ts`).
3. Warning on attack or a hostile coming into view while the menu is open: flash plus a log line, menu stays open. Hook it from the presentation side (domain events, §4); never write engine state.
4. Purse meter in the inventory tab (`src/ui/inventory/inventoryTab.ts`); capacity is read from the item definition (`src/engine/storage/serializer.ts:198`). Do not change the purse size, that is Session 4.
5. Drop-quantity prompt: `src/ui/inventory/inventoryController.ts` (split-stack flow exists) and `src/engine/actions/inventory-actions.ts`. Essence-Runes now stack, so "drop 40" is a real stack.
6. Death screen: Report a bug button plus F3; input is disabled on game over, see `src/rendering/input-handler.ts:487-510` and `src/main.ts`. Include the screenshot.
7. Gates, `visual-check` before and after at 1366 (`scripts/capture/menus.mjs 1366 g00`), commits with `Requested:` trailers, one request per commit, push, tick the page.

## Decisions
- The menu stays open when a monster appears or attacks; only a warning shows. Owner, per the page: "The menu stays open, as you decided."
- A pact's number keys work only on the Pacts tab. Owner: "Keep: only on Pacts tab (Recommended)"

## Dead ends
- Nested heredocs (`python - <<EOF || py - <<EOF2`) hang for 120 s; use the Edit or Write tool.
- Deep engine imports in `src/ui` tests are rejected by `check:engine-purity`; build fixtures from the barrel (memory ui-tests-no-deep-imports).

## Read first
- `src/ui/messageLogModal.ts` — the existing log source and history window.
- `src/ui/gameOverDialog.ts` — the death screen's buttons and Fate line.
- `src/rendering/input-handler.ts:487` — why F3 is dead on game over.
- `.prompts/handoffs/2026-10-12-0111-playtest-fix-plan.md` — the parent plan and settled decisions for Sessions 4 to 6.

## Verification
- Session 2 gates green on e55e77d (lint, 2885 tests, sim, schema, build, Playwright three browsers). Nothing for Session 3 run yet.
Resumed: 2026-10-12 03:19 UTC
