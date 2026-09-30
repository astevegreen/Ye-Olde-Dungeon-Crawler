# ADR-0011: Menus and Visual System — One Structure, Pack Material, One Hub

**Date:** 2026-09-30
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §3 (Pack-Neutral Presentation), §6 (Focus & Modal Isolation); [ADR-0004](0004-hud-overhaul-retrospective.md) (HUD overhaul); [ADR-0010](0010-warcraft-pack-parked.md) (WarCraft parked)

## Context
An audit of every menu, tab and dialog (2026-09-30, at 1440×900 and 1366×768) found eleven plain bugs and a UI built in five visual styles: Windows 3.1 bevel windows, the flat slate HUD, parchment, a cyan-glow style, and canvas-drawn frames. The theme set 10 CSS variables, while 1,595 hard-coded hex colors (199 distinct) did the real work. The inventory and shops draw 10px text at 8.5px on a 1366-wide screen. Level-up and the Character tab each carried their own copy of the attribute-allocation UI.

## Decision
The owner chose, in answer to five questions:
1. **Visual direction C — one structure, pack material.** Every menu and dialog shares one anatomy (window, card, inset; one dialog frame modeled on the Choice dialog; one scrim), one spacing grid and one type scale with an 11px floor on DOM and canvas alike. Color, display face, radius, border style and ornament are semantic `--ui-*` role tokens that the pack supplies through `ThemeTokens`; presentation code names roles, never hues. The accent token is never the danger token.
2. **One hub.** The character menu hosts everything that is not a mid-turn decision. Level-up stops being a modal: leveling opens the Character tab, which owns the only allocation UI, and the Rune of Return tree folds into that tab because it spends the same points. The menu shell owns titles, key hints and close; wrapped tabs lose their own chrome. Only interrupting events stay dialogs: choice, altar, discovery, mastery, crash.
3. **Canvas menus move to DOM now.** The shops and the inventory are rebuilt as DOM, sharing the tokens, type scale and modal stack with every other menu.
4. **Settings stop offering movement keys that the game uses as hotkeys.** The hotkeys keep their keys.
5. **A pack may inline one display font** into its single-file bundle.

Story-as-UI (approved earlier): locked milestones shown as riddles from a manifest `riddle` field, factions hidden until met, a Carved Verses page fed by manifest lore entries unlocked by flags, and a Descent line drawn from `atlas.tileZoneBands`.

## Sequence
0. Fix the audited bugs. 1. Token foundation and fonts. 2. Menu shell, Character (with level-up and the Rune tree) and Story. 3. Dialogs, title flow and settings. 4. Shops, then inventory, to DOM. 5. Pixel UI icons from `ui~` sprite recipes, replacing emoji.

## Consequences
- Work targets cotw only (ADR-0010), but tokens stay semantic so a future pack reskins without code changes.
- A lint ratchet on hex literals and inline colors in `src/ui` and `src/rendering` keeps the old palette from creeping back.
- U and the level-up path change meaning; tests that open the level-up modal move to the Character tab.
- The design record with screenshots and mockups is the owner's doc "Menus and art direction: audit and proposal"; the capture and mockup scripts are `.prompts/menus-audit.mjs` and `.prompts/menus-mockup.mjs` (gitignored).
