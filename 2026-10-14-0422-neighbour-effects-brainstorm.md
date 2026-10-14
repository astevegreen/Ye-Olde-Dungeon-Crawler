# Handoff: grimoire neighbour-effect brainstorm
2026-10-14 04:22 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Continue the owner's grimoire redesign dialogue (talk only; nothing is built until the owner picks). Stat catalog, picking rules, glyphs and slot elements are settled. Next: the neighbour-effect brainstorm, then outliers one by one. Done when the page's "Grimoire redesign" section holds the element and spell-type lists and its Open decisions list only what the owner deferred.

## Done
- Notion "Magic system review — 13 Oct 2026" (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225) reconciled with the redesign (item 3 folded in, items 4/7/8 reworded, spell ideas' N/O tags now brainstorm input) and the 14 Oct answers folded in
- Memory `magic-review-2026-10-13.md` updated. Uncommitted: none

## Next
1. Neighbour brainstorm with the owner. Two lists:
   - What each element brings. Seeds from the effect glyphs (`src/content/cotw/magic.ts:134`): cold slows, lightning leaps to one more foe, shadow heals the caster, Enchantment paralyzes, Movement steps back. Fill in fire, poison, arcane, physical, healing.
   - How each spell type uses it: damage adds the status, terrain changes material (cold: icicles, not dirt pillars), summon takes the element, ward resists it.
2. Settle: two-way giving (the centre gets four flavours and no stats); stacking of the same element; which neighbour a summon takes its element from when several touch it; what Týr's altar strengthening does in numbers.
3. Outliers one by one: Detect Monsters, Detect Objects, Identify, Teleport, Phase Door.
4. Fold each answer into the page per memory `notion-plan-answers`.

## Decisions
- Every known spell sits in a slot; a full grimoire means forget one (gone for the run) or decline — owner: "Approved"
- Catalog slightly larger than the 19 slots; exact size later — owner: "We'll settle this later"
- Stats: Power, Thrift, Range, Area, Duration, Swift (¾ → ⅔ → floor ½ turn) — owner: "Keep swift and all other recommended stats"
- One grimoire per stat, two different stats per grimoire, Máni's pick at run start; step sizes later — owner: "Approve all except 3"
- Sage Mimir rearranges stats for a depth-scaled gold fee; Hel F7/F19 re-pick one grimoire free — owner: "Approve all three"
- Number glyphs and slot elements dropped; effect glyphs seed the neighbour list; Týr's altar strengthens a slot's neighbour effect — owner: "Approve all"

## Read first
- The Notion page: "Grimoire redesign" and "Open decisions"
- `src/content/cotw/magic.ts:122` — today's grimoire config and glyphs
- `src/content/cotw/spells.ts` — the 16 core spells, their elements and targeting
