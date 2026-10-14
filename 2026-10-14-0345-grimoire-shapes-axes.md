# Handoff: grimoire redesign dialogue (shapes, axes)
2026-10-14 03:45 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Owner: "have a dialogue with me about the first two open decision items from the Notion page on Magic. I want to talk through the ideas to see if they are any good or not." Those were the owner's grimoire ideas (stat axes, shaped grimoires). The direction is settled in the page's "Grimoire redesign (direction, 14 Oct)" section. Next: workshop the axis stat catalog, then the neighbour-effect brainstorm. Talk only; nothing gets built until the owner picks.

## Done
- Notion "Magic system review — 13 Oct 2026" (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225): redesign direction written; open decisions left: the stat catalog, glyphs and slot elements
- Memory: `magic-review-2026-10-13.md` updated (settled items, direction, pyramid added to don't-re-propose). Uncommitted: none

## Next
1. Stat catalog workshop with the owner (owner: "Do we need to workshop the axes' 'stats' first?… there should be a catalog of stats to choose from"). Starter draft from this session, for the owner to react to: Power (damage or heal amount), Thrift (lower cost), Range (aimed spells), Area (bursts, clouds, terrain), Duration (statuses, summons, terrain, buffs), Swift (the cast takes less of a turn; the engine already charges energy per action). Rules to settle, with recommendations:
   - each stat used once across all grimoires — yes: grimoires stay distinct and an all-power build is impossible
   - two different stats per grimoire — yes
   - narrow stats (Range, Area, Duration) get bigger steps than universal ones (Power, Thrift) — yes, or Power+Thrift is everyone's best grimoire
   - utility spells (Detect Monsters, Identify) gain only from Thrift, Area or Duration, so they already have a home
   - when Máni's first stat is picked: at the start of the run, with a suggested default
2. Then glyphs and slot elements: if Range, Area and Thrift are axis stats, glyphs' number effects overlap them; recommend glyphs become the list of what each element brings to neighbours, and slot elements go.
3. Fold every answer into the Notion section per memory `notion-plan-answers` (rewrite the bullets, remove the question).
4. Neighbour-effect brainstorm: one list of what each element brings, one of how each spell type uses it (damage adds the status, terrain changes material, summon takes the element, ward resists it). Settle two-way giving (the centre gets four flavours and no stats) and stacking. Then workshop outliers one by one (Detect Monsters, Detect Objects, Identify, Teleport, Phase Door).

## Decisions
- Shapes: Máni row of 3, Sól plus of 5, Yggdrasil full 3×3 (nine worlds, Midgard centre); one touching rule, max 4 neighbours — owner: "I like your idea A and also building your own with the last two Hel's altars"
- All three grimoires work at once, each spell in one only — owner: "All at once"
- Axes are bonuses measured from the centre; the cost of an outer slot is fewer neighbours — owner: "it would actually be more beneficial… in the middle where it can affect more neighbors"
- Stats per grimoire differ, so a small grimoire can suit a spell best (this corrects the "small grimoires hold leftovers" worry) — owner: "you have to consider the tradeoff of not having spells on certain pages because the axis stats on a smaller page are more beneficial to that spell"
- Neighbour effects by element × spell type, outliers individually — owner: "simple rules for most spells and then workshop the outliers like detect monsters individually"
- Unlock on need (4th spell opens Sól, 9th Yggdrasil); Hel F7/F19 re-pick a grimoire's stats; late Hel slots may go beyond the 3×3 outline — owner: "'Yes' to all my calls questions"

## Dead ends
- Pyramid of 10 — needs a second touching rule, a six-neighbour slot, lopsided axes, not Norse
- Axes from one corner — leaves dead slots (bottom-left gets nothing; the row's left end wastes a third of it)
- Hex-grid set — six-neighbour hubs are hard to balance, and it looks unlike the square dungeon

## Read first
- The Notion page above: "Grimoire redesign" section and "Spell ideas (13 Oct)"
- `src/content/cotw/magic.ts:134` — glyph table
- `src/engine/magic/grimoireMatrix.ts:232` — today's slot rules
- `src/content/cotw/spells.ts` — the 16 core spells and their stats
- `.prompts/antigravity/2026-10-13-grimoire-spells.md` — the 41 spell ideas (no code changed; gates not run)
Resumed: 2026-10-14 04:02 UTC
