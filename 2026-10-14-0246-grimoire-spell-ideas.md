# Handoff: grimoire spell ideas catalogued
2026-10-14 02:46 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Owner asked for an exhaustive brainstorm of new spells grounded in the grimoire's adjacency system, then picked a subset, merged it with their own "Curated 10-Spell Collection" ("Combine them but do not drop parts that need systems the game doesn't have… Keep the more authentic Norse names"), and had it appended to the Notion magic review as spell ideas. Done; nothing in the repo changed. Next work is the owner choosing what to build.

## Decide first
- Gifts: should every spell lend one small bonus (−1 mana, +1 range, +2 duration…) to its four grid neighbours? — recommend: yes, because without it summons and terrain gain nothing from slotting
- Neighbour sides and slot order: the owner's collection gives left and right neighbours different effects and uses "Lead (slot 0)" / "Anchor (final slot)"; build those, or translate them to today's rules (all four neighbours equal, centre slot special)? — recommend: translate, because both corners start sealed and side-aware adjacency doubles the grid's rules
- Poison: Miasma, Mire, Serpent Brood and Fáfnir's Breath wait on the open poison-spell decision in the magic review — recommend: yes to poison
- First build: the spawn-surface engine addition (a spell leaves water, oil, ice, fire or gas) unlocks 13 of the 41 — recommend: build it first

## Done
- Uncommitted: none. `.prompts/antigravity/2026-10-13-grimoire-spells.md` (gitignored) holds the merged 41-spell list
- Notion "Magic system review — 13 Oct 2026" (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225): new bottom section "Spell ideas (13 Oct) — ideas only, not planned", with toggle headings per category

## Next
1. Ask the Decide first questions; fold answers into the Notion section per memory `notion-plan-answers` (rewrite, don't annotate)
2. When the owner picks spells to build, load the `add-content` skill (SPELL.md) and start from the engine additions the picks need (build tags in the file)

## Decisions
- Merged names: Mire, Raise Cairn, Shroud of Máni, Hrævareldr, Fylgja, Thunderclap, Loki's Switch; Ignition Brand, Gargoyle Carapace, Spectral Phasing keep their names — owner: "Keep the more authentic Norse names for each"
- The collection's wording is kept verbatim; each entry has a **Needs** line for the missing systems — owner: "do not drop parts that need systems the game doesn't have"
- "Anchor (Final Slot)" read as slot 8, the bottom-right corner — chosen because spells have no cast order

## Read first
- `.prompts/antigravity/2026-10-13-grimoire-spells.md` — the list, build tags and grid rules
- `src/engine/magic/grimoireMatrix.ts:232` — today's adjacency rules (centre, opposed element, ray beside burst, grounded, glyphs)
- `src/engine/magic/types.ts:27` — spell effect primitives; a pack cannot add new ones

## Verification
- gates: not run (no code changed)
Resumed: 2026-10-14 02:49 UTC

## Answers 14 Oct (resume)
- Blood magic: finish — owner: "Finish"
- Poison spell: yes, one — owner: "Yes"
- Quick bar casts from any page — owner: "No"
- Norse names once the final catalog is decided — owner: "Use Norse names once we decide on the final spell catalog"
- Hostages grant unique positive-alignment spells — owner: "Yes"
- Gifts dropped, a different neighbour system comes — owner: "We will implement a system different than gifts"
- Notion page updated and cleaned. Still open: axis scheme, grimoire shapes, neighbour sides/slot order, spawn-surface first
