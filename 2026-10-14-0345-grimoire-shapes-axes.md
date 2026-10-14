# Handoff: grimoire redesign dialogue (shapes, axes)
2026-10-14 03:45 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Owner: "have a dialogue with me about the first two open decision items from the Notion page on Magic. I want to talk through the ideas to see if they are any good or not." Those were the owner's grimoire ideas: X/Y stat axes and three differently shaped grimoires. The direction is now settled and written to the page's "Grimoire redesign (direction, 14 Oct)" section. Next comes the neighbour-effect brainstorm. Talk only; nothing gets built until the owner picks.

## Decide first
- Unlock on need: the 4th known spell opens Sól, the 9th opens Yggdrasil (count spells known, not slots filled; once open, always open)? — recommend: yes, because a grimoire is never empty and it follows the player's pace (casters get theirs sooner)
- Hel's F7 and F19 altars lose their corner-opening job: what do they do? — recommend: re-pick one grimoire's stats, so axes stay a build choice with two chances to correct it
- Late slots (Hel F31/F43): inside each grimoire's 3×3 outline only, or beyond it? — recommend: beyond, because Yggdrasil is full and could not grow otherwise; a slot 2–3 steps out gets 2–3× one stat and touches one spell (bounded: only two such slots). A slot above/below the row gives the row its second stat
- Glyphs and slot elements (grounds): keep, fold or drop? — recommend: glyphs become the list of what each element brings to neighbours; grounds go, since they came from Hel opening corners

## Done
- Notion "Magic system review — 13 Oct 2026" (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225): the two open questions replaced by the redesign direction plus three open decisions (unlock timing, late-slot outline, glyphs/grounds)
- Memory: `magic-review-2026-10-13.md` updated (settled items, direction, pyramid added to don't-re-propose). Uncommitted: none

## Next
1. Ask the Decide-first questions; fold answers into the Notion section per memory `notion-plan-answers` (rewrite the bullets, remove the question).
2. Neighbour-effect brainstorm with the owner: one list of what each element brings, one of how each spell type uses it (damage adds the status, terrain changes material, summon takes the element, ward resists it). Start from the glyph table. Settle two-way giving (the centre gets four flavours and no stats; a corner two stats and two flavours) and stacking (four different elements on the centre). Then workshop outliers one by one: Detect Monsters, Detect Objects, Identify, Teleport, Phase Door. Cover the 41 ideas' types too (terrain, summon, light, ward).

## Decisions
- Shapes: Máni row of 3, Sól plus of 5, Yggdrasil full 3×3 (nine worlds, Midgard centre); one touching rule, max 4 neighbours — owner: "I like your idea A and also building your own with the last two Hel's altars"
- All three grimoires work at once, each spell in one only; switching goes away — owner: "All at once"
- Axes are pure bonuses measured from the centre (centre none, edge one, corner both); the cost is fewer neighbours — owner: "you might not want to put your 'most powerful spell' in the top right because it would actually be more beneficial to your play style if you put it in the middle where it can affect more neighbors"
- Neighbour effects by element × spell type, outliers individually; replaces Gifts — owner: "I do want neighbor slots to get a spell type-specific effect from neighbors… simple rules for most spells and then workshop the outliers like detect monsters individually"

## Dead ends
- Pyramid of 10 — brick-stacked rows need a second touching rule, its middle slot touches six, axes sit lopsided, not Norse
- Axes from one corner — leaves dead seats: bottom-left gets nothing, and the row's left end wastes a third of that grimoire
- Hex-grid set (row 3, sun 7, triangle 10) — consistent, but hubs of six are hard to balance and it looks unlike the square dungeon; not chosen

## Read first
- The Notion page above: "Grimoire redesign" section and "Spell ideas (13 Oct)"
- `src/content/cotw/magic.ts:134` — glyph table, the first draft of what each element brings
- `src/engine/magic/grimoireMatrix.ts:232` — today's slot rules (centre, opposed element, ray beside burst, grounds, glyphs)
- `src/content/cotw/spells.ts` — the 16 core spells, for the outlier list
- `.prompts/antigravity/2026-10-13-grimoire-spells.md` — the 41 spell ideas and their types

## Verification
- No code changed; gates not run.
