# Handoff: grimoire stat-axis step sizes
2026-10-15 00:09 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Continue the owner's magic redesign dialogue (talk only; nothing is built until the owner picks). Spell learning is settled; the stat axes come next ("We might need to work out other mechanics like the stat axes or how to unlock new spells. Let's think through those questions first."). Done when the Notion page's "Grimoire redesign" states step sizes and "Open decisions" holds only what the owner deferred.

## Decide first
- How much one step of each axis stat gives — recommend: start from today's glyph values and tune after magic is measured (item 9): Power +20% (Kenaz), Thrift a fifth off the cost, Seiðr or HP (Berkano's flat −2 is unfair across 4–18 costs), Range +2 tiles (Ansuz), Area +1 radius (Uruz; cap at 2 steps for damage spells, since 3 steps from a late Hel slot is a 9×9 blast; Hliðskjálf uncapped), Duration +50% (new), Swift ¾ → ⅔ → ½ turn (already decided); narrow stats take bigger steps so Power + Thrift isn't everyone's best grimoire
- What "slightly stronger" means for a spell learned through the rite shortcut — recommend: one permanent extra step of Power (Thrift for spells Power doesn't help, e.g. Hliðskjálf, Phase Door), because it reuses the step and needs no new rule

## Done
- Notion magic review page (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225), 14 Oct: all 15 spell ideas join in two waves, Hammer-Throw replaces Lightning Bolt (item 6, item 4); neighbour rules recorded as tentative under "Grimoire redesign"; outlier spells' neighbour effects postponed (Open decisions); new "Learning spells (direction, 14 Oct)" section: Shard and stone, plus a feasibility audit of today's rites.
- Memory `magic-review-2026-10-13.md` updated to match.
- Uncommitted: none (Notion and memory only)

## Next
1. Ask Decide first; fold answers into the page per memory `notion-plan-answers`: step sizes into "Grimoire redesign" (the stat catalog bullet), the rite-shortcut bonus into "Learning spells" (the shortcut bullet), and drop "Step sizes per stat" from Open decisions.
2. Ask the owner what to take up next: the postponed outlier spells (Hliðskjálf, Teleportation, Phase Door, Loki's Switch), the ward gap (none of the 15 new spells is a plain ward; the frith Dísir carry it, or a simple ward joins later), or which spell sits on which stone.

## Decisions
- Neighbour effects stay tentative — owner: "keep anything related to neighbor effects as tentative for now. I might want to revisit the actual mechanics of how neighbor slots affect each other more later."
- Shard and stone replaces kill rites as the gate; stone about every other floor, two spell faces per stone, rite shortcut learns on the spot and slightly stronger — owner: "Approve all your recommendations"
- The rite shows in the Bestiary after the first kill of that kind; Spells page shows "found on floors X–Y" for unmet spells; an unwanted or known shard becomes an Essence-Rune — owner, 14 Oct.

## Dead ends
- Kill rites as the gate — audit at 7e23de4d: Slow rests on one F4 rite, the Captive's Fireball rite needs 23 overkill against a best hit of 16, burn/poison/terrain kills never count, one-time monsters never reveal. Odin's Way (learn by surviving a spell) and Mimir's springs (pick one of three) were shown and not chosen.

## Read first
- The Notion page: "Grimoire redesign", "Learning spells (direction, 14 Oct)", "Open decisions"
- `src/content/cotw/magic.ts:134` — today's glyph values the step sizes start from
