# Handoff: Session 2, shop and altar windows
2026-10-12 02:58 UTC · branch main · HEAD 0e78809 · tree 11 uncommitted files (code done, visual check passed, not gated)

## Goal
Owner: "proceed with phase 2 from the Notion plan" (page "Ideas, bugs, and playtest notes", Session 2, Sonnet). Done = shop clicks refresh HUD and log; Mimir's result line on top and scroll kept; a Pacts tab; Oath-Stone grid drawn right with a taller, scroll-keeping list; up-front text naming spells and runes. Parent plan and settled decisions: `.prompts/handoffs/2026-10-12-0111-playtest-fix-plan.md`.

## Decide first
- Mimir's pact number keys 1–9 worked on any tab; now only on the Pacts tab. Recommend keep, because a hidden key is the discoverability problem the owner reported.
- Session 5 scope is still open; it blocks nothing before Session 5.

## Done
- Uncommitted, lint green, targeted tests green (shopDialog + altarModal 39; spellbook tests passed earlier):
  - `src/ui/shop/shopDialog.ts` — `onServed` option called from `report()`; status line under the greeting (only where a trade or service can produce one); scroll of body, `.shop-list`, `.shop-choices` kept, reset on tab or view switch.
  - `src/rendering/canvas-renderer.ts` — `onServed: () => this.afterAction()`; `src/ui/styles/shop.css` — `.shop-status` sticky.
  - `src/ui/shop/shopPanels.ts` — `servicePanelFor`: Pacts is a view after the keeper's own lists.
  - `src/ui/grimoireGrid.ts` (new) — shared 5x5 grid with spacers, used by `spellbookTab.ts` and `altarModal.ts`.
  - `src/ui/altarModal.ts` — grid helper, burn-rule note, "essence · fire ×N" label, scroll kept; `src/ui/styles/dialog.css` — `.altar-list` 150 to 260px.
  - `src/content/cotw/magic.ts` — four altar descriptions say "a spell you know or an Essence-Rune".
  - Tests: `src/ui/__tests__/shopDialog.test.ts` (edited), `altarModal.test.ts` (new).
- Visual check at 1366: as intended. Altar has nine full cells, status line clear of the greeting, Mimir's tabs Items/Study/Rumors/Pacts; the empty-line gap on guard/villager was found and fixed. Images: `.prompts/captures/s2-shop-altar-after/`, `s2-extra-after/x04-sage-pacts.png`.
- Baseline worktree and :5174 server removed.

## Next
1. `npm run gates`, real output pasted. Sticky status was never exercised (the sage body scrolls only ~85px at 768px); worth a glance at 1366x600 if cheap.
2. Two commits, `Requested:` quoting the owner: (a) shopDialog.ts, shopPanels.ts, canvas-renderer.ts, shop.css, shopDialog.test.ts; (b) altarModal.ts, grimoireGrid.ts, spellbookTab.ts, dialog.css, magic.ts, altarModal.test.ts. Use Edit/Write, not heredocs.
3. `git push` in the background; summary lists player-visible changes: bars and log update at once after a shop click, result line on top, Pacts tab, Oath-Stone grid and wording.
4. Tick Session 1 and 2 boxes on the Notion page; Session 3 (recent-messages strip) in a fresh session.

## Decisions
- Pacts tab last, after Items/Study/Rumors; other sages get no tab — chosen because the keeper's lists vary by pack.
- Pact number keys only on the Pacts tab — owner: "Keep: only on Pacts tab (Recommended)"
- Session 5 scope deferred — owner: "Defer (Recommended)"
- Burn-rule line is pack-neutral; "Essence-Rune" is named only in the pack's altar descriptions (pack-neutral check).

## Dead ends
- `createScaledItem` deep import in a `src/ui` test — `check:engine-purity` rejects it; used `new Item(...)` from the barrel (memory ui-tests-no-deep-imports).
- Nested `python - <<EOF || py - <<EOF2` hung 120 s — use the Edit tool.

## Verification
- lint: green on working tree (HEAD 0e78809 + 11 files), no gate stamp. Full test, sim, schema, build, Playwright: not run.
Resumed: 2026-10-12 03:01 UTC
