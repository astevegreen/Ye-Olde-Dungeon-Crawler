# Handoff: Session 2, shop and altar windows
2026-10-12 02:51 UTC · branch main · HEAD 0e78809 · tree 11 uncommitted files (code done, not gated)

## Goal
Owner: "proceed with phase 2 from the Notion plan" (page "Ideas, bugs, and playtest notes", Session 2, Sonnet). Done = shop clicks refresh HUD and log; Mimir's result line on top and scroll kept; a Pacts tab; Oath-Stone grid drawn right with a taller, scroll-keeping list; up-front text naming spells and runes. Parent plan and settled decisions: `.prompts/handoffs/2026-10-12-0111-playtest-fix-plan.md`.

## Decide first
- Mimir's pact number keys 1–9 worked on any tab; now only on the Pacts tab. Recommend keep, because a hidden key is the discoverability problem the owner reported.
- Session 5 scope is still open; it blocks nothing before Session 5.

## Done
- Uncommitted, lint green, targeted tests green (altarModal + shopDialog + spellbook, 42):
  - `src/ui/shop/shopDialog.ts` — `onServed` option called from `report()`; status line under the greeting; scroll of body, `.shop-list`, `.shop-choices` kept, reset on tab or view switch.
  - `src/rendering/canvas-renderer.ts` — `onServed: () => this.afterAction()`; `src/ui/styles/shop.css` — `.shop-status` sticky.
  - `src/ui/shop/shopPanels.ts` — `servicePanelFor`: Pacts is a view after the keeper's own lists.
  - `src/ui/grimoireGrid.ts` (new) — shared 5x5 grid with spacers, used by `spellbookTab.ts` and `altarModal.ts`.
  - `src/ui/altarModal.ts` — grid helper, burn-rule note, "essence · fire ×N" label, scroll kept; `src/ui/styles/dialog.css` — `.altar-list` 150 to 260px.
  - `src/content/cotw/magic.ts` — four altar descriptions say "a spell you know or an Essence-Rune".
  - Tests: `src/ui/__tests__/shopDialog.test.ts` (edited), `altarModal.test.ts` (new).
- A visual-check agent was still running; its verdict was not received. Captures: `.prompts/captures/s2-shop-altar-before/` and `-after/`.

## Next
1. Read the captures (`scripts/capture/diff.mjs`) or rerun `visual-check` on filter `g19|shop` at 1366 (baseline URL http://localhost:5174). Check: nine full altar cells, sticky status clear of the greeting, Pacts last in Mimir's tabs.
2. Clean the baseline: kill the :5174 server (`netstat -ano | grep :5174`, `taskkill //PID <pid> //T //F`); then `cmd //c rmdir C:\Antigravity\YODC-before\node_modules` (junction only, BEFORE the next); then `git worktree remove C:\Antigravity\YODC-before`.
3. `npm run gates`, real output pasted.
4. Two commits, `Requested:` quoting the owner: (a) shopDialog.ts, shopPanels.ts, canvas-renderer.ts, shop.css, shopDialog.test.ts; (b) altarModal.ts, grimoireGrid.ts, spellbookTab.ts, dialog.css, magic.ts, altarModal.test.ts. Use Edit/Write, not heredocs.
5. `git push` in the background; summary lists player-visible changes: bars and log update at once after a shop click, result line on top, Pacts tab, Oath-Stone grid and wording.
6. Tick Session 1 and 2 boxes on the Notion page; Session 3 (recent-messages strip) in a fresh session.

## Decisions
- Pacts tab last, after Items/Study/Rumors; other sages get no tab — chosen because the keeper's lists vary by pack.
- Burn-rule line is pack-neutral; "Essence-Rune" is named only in the pack's altar descriptions (pack-neutral check).

## Dead ends
- `createScaledItem` deep import in a `src/ui` test — `check:engine-purity` rejects it; used `new Item(...)` from the barrel (memory ui-tests-no-deep-imports).
- Nested `python - <<EOF || py - <<EOF2` hung 120 s — use the Edit tool.

## Verification
- lint: green on working tree (HEAD 0e78809 + 11 files), no gate stamp. Full test, sim, schema, build, Playwright: not run.
