# Handoff: hybrids and the forge, design session
2026-10-15 02:12 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
The next magic-redesign topic, talk only: what hybrids become now that neighbour effects do what fusing did. The owner took the recommendation (15 Oct) to give hybrids "a session of its own", leaning towards "the forge adds a second element to a known spell". Done when the owner has picked a design and it is folded into the main magic page (memory `notion-plan-answers`). Nothing gets built. Design work: Opus.

## Done
- Runestone placement and gaps A–H settled 15 Oct; the first stone is on floor 4 (claimed note `2026-10-15-0149-runestone-placement.md`). Notion and memory only.
- Uncommitted: none

## Next
1. Read the main page's "Grimoire redesign" (the "Hybrids get their own session" bullet, the neighbour rules, Týr's and Loki's lend doubling) and action items 2 (show true hybrid power) and 5 (Thunder Maul runestone).
2. Read today's hybrids: `src/content/cotw/hybridSpells.ts:40` (spells) and `:67` (12 recipes); Odin's forge at `src/content/cotw/index.ts:293`, `:297`, `:302` (floors 11, 27, 47); Ivalda's hearth (`index.ts:336`, floor 13) and Skuld's Mirror (`index.ts:344`, floor 49).
3. Draft the proposal as a child page of the main page, like the runestone page, covering:
   - what the forge does and what it costs (Essence-Runes feed it);
   - its limits (one second element per spell?);
   - how a second element meets the neighbour rules: does it lend both, and does "one flavour counts once" apply?;
   - what Ivalda's Steam Lance and Skuld's Renewal or Hel-Fire become;
   - what happens to the recipes' lore hints and the Thunder Maul runestone;
   - how the spellbook shows a two-element spell's damage.
   Then walk the dry run's forge floors (11, 13, 27, 47, 49) with it.
4. Ask the owner the questions it raises, each with a recommendation.

## Decisions
- Lean: the forge gives a known spell a second element, so it hits with both and lends both. That replaces the 12 fixed recipes and their lore hints, and would settle items 2 and 5. Owner, 15 Oct: "approve all recommendations".

## Read first
- https://app.notion.com/p/3f8eb012942f815aa849c981efb30225: "Grimoire redesign", action items 2 and 5
- https://app.notion.com/p/3faeb012942f81a48630e644820fb375: the full-run dry run the forge floors fit into
- `src/content/cotw/hybridSpells.ts:67`: today's 12 recipes
- `src/content/cotw/index.ts:293`: Odin's forge placements
