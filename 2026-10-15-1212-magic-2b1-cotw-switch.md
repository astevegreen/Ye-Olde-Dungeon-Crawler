# Handoff: magic 2b-1, the cotw switch
2026-10-15 12:12 UTC · branch magic-grimoire · HEAD 0fc8153e · tree clean

## Goal
Magic redesign plan phase 2, step 2b-1 (`.prompts/plan-page.txt`, "2b-1 cotw switch: grimoires and lends"): cotw runs on the three grimoires with real content and the old grimoire is deleted. 2a-1 and 2a-2 are done and pushed. Branch merges to main only once 2c passes `npm run gates`.

## Decide first
- Show the owner the placement card (2a-2, `src/ui/spellOfferCard.ts`) in a `visual-check` capture before building on it? It was never captured — recommend: yes, one capture at 1366 and 1280 (`scripts/capture/menus.mjs`), because 2b-1 changes what fills it.

## Done
- 25c20c1b quick bar boosted numbers, unplaced spell not cast
- f829eef9 title screen "First stat", Power preselected
- 0fc8153e placement card: a spell with no room is a pending offer saved with the hero, reopened from the Spellbook; card opens only when grimoires are full (owner's answer)
- `npm run gates` green and branch pushed on 0fc8153e. Uncommitted: none.

## Next
1. Read the 2b-1 section of `.prompts/plan-page.txt` (~line 307) and the "Neighbour rules" / doubled-lend list it cites.
2. Declare in `src/content/cotw/magic.ts` the three grimoires, the stat catalog with step sizes, the lend tables, and a spell type for each of today's spells.
3. Merge spells: Heal Minor + Medium -> Heal; Phase Door absorbs Teleportation (2-6 tile hop, +2 per Range step; the scroll keeps the whole-floor jump); Identify scroll-only (keep the inspector button id, `src/ui/inventory/itemInspector.ts:13`); drop retired tablets (`src/content/cotw/spellTablets.ts:39-48`); retarget rites in `killRites.ts`.
4. Remove glyphs, slot elements, the Midgard centre bonus, the ray-beside-burst rule, page switching and its 2-turn channel, the engine's opposites list (`src/engine/magic/elements.ts:45-50`), casting unslotted spells; delete `src/engine/magic/grimoireMatrix.ts`.
5. Add cotw's retired-spell map so old saves load; update `.claude/skills/add-content/SPELL.md`.
6. `npm run gates`, `visual-check` shots g03 (Spellbook), g09b, g19 at 1366 and 1280; commit per request; push.

## Model
Opus at high thinking — engine plus content removal across many files, and save carry-over.

## Decisions
- Spell with no room: kept as a pending offer — owner: "Keep it as a pending offer saved with the hero, reopened from the Spellbook."
- Card opens only when the grimoires are full — owner: "The card opens only when the grimoires are full."
- Capture the placement card before 2b-1 — owner: "run a visual check first"

## Read first
- `.prompts/plan-page.txt:307` — 2b-1 spec and file list
- `src/content/cotw/magic.ts:15` — today's grimoire and spell declarations
- `src/engine/magic/grimoires.ts` — new grimoire engine from phase 2a
- `src/ui/spellOfferCard.ts` — the card 2b-1 feeds

## Verification
- lint, tests, gates (Chromium), pre-push (3 browsers): green on 0fc8153e.
- `visual-check` of the placement card: not run. Soak: none until magic lands (memory).
Resumed: 2026-10-15 12:13 UTC
