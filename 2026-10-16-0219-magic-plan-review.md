# Handoff: magic plan reviewed, Spells page built
2026-10-16 02:19 UTC · branch main · HEAD d3230277 · tree clean

## Goal
Owner: "Do a cursory review of the entire magic implementation plan to make sure we didn't overlook anything", then "Do it" (build the one gap found, 5c the Spells page). Both done; what remains is small tidy-ups and P-36, which waits for the owner (§9; last per the 13 Oct order).

## Decide first
- The Spells page shows the NAMES of spells not yet seen on a stone (only their text is hidden, with "found on floors X–Y"); the plan's wording could mean hiding names too — recommend: keep names visible, because players can plan where to look and the owner's bar is "clear and easily understood".
- Three tidy-ups from the review, none player-visible except the last: SPELL.md step 4.1 still says spells are learned by kill rites (stones teach now; `.claude/skills/add-content/SPELL.md:18-19`); cotw still sets dead `essenceDropChance`/`killsPerRevealedCondition` config (`src/content/cotw/magic.ts:120`), ignored under stones; spell cards show the school "HealingDivination" unspaced (predates this work) — recommend: one small Sonnet session for all three.
- Start P-36 (measuring magic with the soak bot)? — recommend: yes, next, after the tidy-ups; the plan is otherwise complete.

## Done
- 4163a11e Fylgja bursts on a killing blow too (`waveTwoSpells.ts` ending `on` gains 'slain'); `src/content/cotw/__tests__/waveTwoSpells.test.ts` casts all seven wave-2 spells in a real engine.
- d3230277 the Spells page: V (or "All spells") in the Spellbook; `src/engine/magic/spellCatalog.ts`, config `learningStones.elsewhere` + `messages.tablets`; Forging card moved there; list keeps scroll and follows the selection.
- Review found everything else built (phases 1–6); phase 2 went straight to main, not a side branch (no action).
- Uncommitted: none.

## Next
1. Ask the Decide-first questions; then the tidy-ups or P-36 as answered (P-36 entry in ARCHITECTURE.md §9; soak skill for how).

## Model
Sonnet 5.5 at medium for the tidy-ups; Opus at high for P-36 (soak-bot casting logic).

## Decisions
- Wave-2 numbers stay until P-36 measures them — owner: "keep current numbers"
- Build the Spells page before P-36 — owner: "Do it"
- Unfound spells keep their names on the Spells page — owner: "Keep names visible"
- Do the three tidy-ups, then start P-36 — owner: "do whatever cleanup/tidy-up is left from implementing the magic system and then start on P-36"

## Read first
- `src/ui/characterMenu/spellbookTab.ts` — the Known / All spells views.
- `src/content/cotw/learningStones.ts:45` — `elsewhere` and the tablet note a new spell must join.

## Verification
- d3230277: lint + test green (3,276); pre-push sim, build, Playwright 3 browsers green; pushed. visual-check after captures in `.prompts/captures/spellbook-after2/` (scroll fixed; the 16px footer shift was then fixed by a "Spells known" button, not re-captured).
Resumed: 2026-10-16 02:32 UTC
