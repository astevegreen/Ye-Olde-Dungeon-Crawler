# Handoff: spell catalog picks, then neighbour effects
2026-10-14 22:53 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Continue the owner's grimoire redesign dialogue (talk only; nothing is built until the owner picks). The spell catalog is shaped; the owner picks which remaining ideas join, then settles the neighbour-effect proposal, then outliers one by one. Done when the Notion page's "Grimoire redesign" section holds the element and spell-type lists and its Open decisions list only what the owner deferred.

## Decide first
- Which of the 15 remaining spell ideas join (26 spells for 19 slots if all) — recommend: all 15 in two waves, first Hliðskjálf, Fáfnir's Breath, Call the Pack, Rockfall, Thunderclap, Shroud of Máni, Rime Floor, Loki's Switch; then Mire, Hammer-Throw, Fylgja, Sól's Glare, Raise Cairn, Rime-Thurs, Drench, because Raise Cairn's temporary walls are the one big engine job
- Hammer-Throw replaces Lightning Bolt or sits beside it — recommend: replace, because lightning gets Thunderclap too (cost: a Castle of the Winds name goes)
- Two-way: every touching pair lends both ways — recommend: yes, it makes the centre-versus-edge trade work
- The same flavour from two neighbours counts once — recommend: yes, mixing elements is the puzzle
- A summon's hits carry every neighbour's flavour; its damage element stays its own — recommend: yes
- Opposites (fire/cold, lightning/poison) also give each other +25% power — recommend: yes, the pack's opposites keep a meaning
- Týr's altar: an Essence-Rune doubles what one slot lends, once per slot — recommend: yes
- Approve the flavour and type lists under Next (healing's cleanse and arcane-by-school are the weakest) — recommend: approve

## Done
- Notion magic review page (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225): item 6 states the catalog rule and merges, item 4 narrows poison to Fáfnir's Breath or Mire, Open decisions holds the 15-ideas question, the 26 cut ideas are removed (named in the Spell ideas callout). Memory `magic-review-2026-10-13.md` updated.
- Uncommitted: none (Notion and memory only)

## Next
1. Ask Decide first; fold answers into the page per memory `notion-plan-answers` (catalog answers into item 6 and Open decisions; neighbour answers into "Grimoire redesign").
2. The neighbour proposal those questions settle:
   - Elements lend: fire burns 2 · cold slows 2 (Isa) · lightning leaps to one more foe at ½ (Thurisaz) · poison 2 · physical knocks back 1 (walls stun, chasms drop) · shadow drains 3 (Nauthiz) · healing cleanses one harmful status on cast · arcane by school: Enchantment binds 1, Movement steps back 2 (Raidō), Divination marks (seen through walls 10 turns), Magic Arrow pierces resistance. Frith spells take healing.
   - Types use it: damage, the hit carries it · control, lands on the held target · heal, bursts on adjacent foes · summon, its hits carry it · movement, bursts where you land · ward (future), resists that element · terrain, material changes (cold ice, fire burning ground, poison mire, shadow darkness, healing hallowed ground, physical stone).
3. Outliers one by one: Hliðskjálf, Teleportation, Phase Door, Loki's Switch.
4. Raise the ward gap: none of the 15 is a plain ward; the frith Dísir carry it, or a simple ward joins later.

## Decisions
- Cuts and merges (one spell per kind of action; neighbours make the element versions; two heals into Heal; Detect Monsters, Detect Objects, Clairvoyance into Hliðskjálf; Identify scroll-only) — owner: "I agree with all the cut and merge recommendations."
- Catalog past the slots — owner: "I'm ok with having a few extra spells that players will never be able to use because that allows a tiny bit of replay value and introduces choice for players."
- Light stays cut: a torch only matters on F21 and F30 until relit (sight 2 → 5, `src/content/cotw/darkness.ts:57`); chosen because a slot for two floors is waste.

## Read first
- The Notion magic review page: items 4 and 6, "Grimoire redesign", Open decisions
- `src/content/cotw/magic.ts:134` — the glyphs the flavours come from
- `src/content/cotw/elements.ts:5` — elements and their opposites
Resumed: 2026-10-14 22:58 UTC
