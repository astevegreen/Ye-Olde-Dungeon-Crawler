# Handoff: Session 2, shop and altar windows
2026-10-12 02:51 UTC · branch main · HEAD 0e78809 · tree 11 uncommitted files (code done, not gated)

## Goal
Owner: "proceed with phase 2 from the Notion plan" (page "Ideas, bugs, and playtest notes", Session 2, Sonnet). Done = five boxes shipped: shop clicks refresh HUD and log; Mimir's result line on top and scroll kept; a Pacts tab; Oath-Stone grid drawn right with a taller, scroll-keeping list; up-front text naming spells and runes. Parent plan and settled decisions: `.prompts/handoffs/2026-10-12-0111-playtest-fix-plan.md`.

## Decide first
- Mimir's pact number keys 1–9 used to work on any of his tabs; now only on the Pacts tab, since Pacts is a tab. Recommend: keep, because a hidden key on another tab is the discoverability problem the owner reported.
- Session 5 scope (which design ideas go in) is still open; it blocks nothing before Session 5.

## Done
- Uncommitted, all lint-green, targeted tests green (altarModal + shopDialog 38, spellbook 42 with them):
  - `src/ui/shop/shopDialog.ts` — `onServed` option called from `report()`; status line moved under the greeting; scroll of `.ui-dialog-body/.shop-list/.shop-choices` kept, reset on tab or view switch (`freshList`).
  - `src/rendering/canvas-renderer.ts` — `onServed: () => this.afterAction()`.
  - `src/ui/styles/shop.css` — `.shop-status` sticky at the top.
  - `src/ui/shop/shopPanels.ts` — `servicePanelFor`: Pacts is a view after the keeper's own lists; view `count` optional.
  - `src/ui/grimoireGrid.ts` (new) — shared 5x5 grid with spacers; used by `spellbookTab.ts` and `altarModal.ts`.
  - `src/ui/altarModal.ts` — grid via helper, BURN_RULE note, kind label "essence · fire ×N", scroll kept, overlay cleared on open.
  - `src/ui/styles/dialog.css` — `.altar-list` max-height 150 to 260px.
  - `src/content/cotw/magic.ts` — four altar descriptions say "a spell you know or an Essence-Rune".
  - Tests: `src/ui/__tests__/shopDialog.test.ts` (edited), `altarModal.test.ts` (new).
- A visual-check agent was still running (captures `.prompts/captures/s2-shop-altar-before/` and `-after/`, log `s2-before-run.txt`); its verdict was not received.

## Next
1. Read the captures (diff with `scripts/capture/diff.mjs`) or rerun `visual-check` on filter `g19|shop` at 1366, baseline URL http://localhost:5174. Check: altar grid has nine full cells, sticky status doesn't collide with the greeting, Mimir's tabs show Pacts last.
2. Clean the baseline: kill the :5174 server (`netstat -ano | grep :5174`, `taskkill //PID <pid> //T //F`), then `cmd //c rmdir C:\Antigravity\YODC-before\node_modules` (removes the junction only; do this BEFORE the next step), then `git worktree remove C:\Antigravity\YODC-before`.
3. `npm run gates` (presentation change). Real output, pasted.
4. Commit in two, each with `Requested:` quoting the page's note or "proceed with phase 2 from the Notion plan": (a) shop dialog: shopDialog.ts, shopPanels.ts, canvas-renderer.ts, shop.css, shopDialog.test.ts; (b) altar: altarModal.ts, grimoireGrid.ts, spellbookTab.ts, dialog.css, magic.ts, altarModal.test.ts. Write them with Edit/Write, not heredocs.
5. `git push` in the background. The summary lists what players see change: shop clicks update bars and log at once; result line at the top; Pacts tab; Oath-Stone grid and wording.
6. Tick Session 1 and Session 2 boxes on the Notion page. Then Session 3 (recent-messages strip) in a fresh session.

## Decisions
- Pacts tab goes last, after Items/Study/Rumors; other sages get no tab — chosen because the keeper's lists vary by pack.
- Burn-rule line is pack-neutral UI text; "Essence-Rune" is named in the pack's altar descriptions, not in `src/ui/` (pack-neutral check).

## Dead ends
- `createScaledItem` deep import in a `src/ui` test — `check:engine-purity` rejects it though ARCHITECTURE.md says tests may deep-import; used `new Item(...)` from the barrel.
- `python - <<EOF || py - <<EOF2` hung 120 s — use the Edit tool.

## Read first
- `src/ui/shop/shopPanels.ts:468` — the Pacts view logic.
- `src/ui/shop/shopDialog.ts:545` — render(): status, scroll keeping.
- `src/ui/altarModal.ts:143` — render().

## Verification
- lint: green on working tree (HEAD 0e78809 + 11 files); no gate stamp (bare `npm run lint`).
- targeted vitest: green. Full `npm test`, sim, schema, build, Playwright: not run.
