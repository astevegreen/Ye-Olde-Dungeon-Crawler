# Handoff: grimoire neighbour effects, owner to decide
2026-10-14 22:20 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Continue the owner's grimoire redesign dialogue (talk only; nothing is built until the owner picks). The Siphon Altar rework is settled (magic review item 1). The neighbour-effect proposal below waits on the owner; then outliers one by one. Done when the Notion page's "Grimoire redesign" section holds the element and spell-type lists and its Open decisions list only what the owner deferred.

## Decide first
- Two-way: every touching pair lends both ways, so Sól's centre gets four flavours and no stats — recommend: yes, it makes the centre-versus-edge trade work
- The same flavour from two neighbours counts once — recommend: yes, mixing elements is the puzzle (alternative: a capped stack for a pure build)
- A summon's hits carry every neighbour's flavour; its damage element stays its own — recommend: yes, then no rule decides which neighbour wins
- Opposites (the pack's fire/cold, lightning/poison) also give each other +25% power, the old opposed bonus moved onto neighbours — recommend: yes, the pack's opposites keep a meaning
- Týr's altar: an Essence-Rune doubles what one slot lends (burning 4, leap to two foes, push 2), once per slot — recommend: yes
- Approve the two lists under Next, or swap a flavour (healing's cleanse and arcane-by-school are the weakest) — recommend: approve

## Done
- Siphon Altar rework settled and folded into Notion: magic review item 1 (https://app.notion.com/p/3f8eb012942f815aa849c981efb30225); narrative review item 4, Act 1→2 bridge (https://app.notion.com/p/3f8eb012942f81d4b27cf24552ee417d). Memory `magic-review-2026-10-13.md` updated.
- Uncommitted: none (Notion and memory only)

## Next
1. Ask the Decide first questions; the proposal they settle:
   - Elements lend: fire burns 2 · cold slows 2 (Isa) · lightning leaps to one more foe at ½ (Thurisaz) · poison 2 · physical knocks back 1 (walls stun, chasms drop) · shadow drains 3 (Nauthiz) · healing cleanses one harmful status on cast · arcane by school: Enchantment binds 1 (Binding), Movement steps back 2 (Raidō), Divination marks (seen through walls 10 turns), Magic Arrow pierces resistance. Frith spells (Grið, Dísir) take healing.
   - Types use it: damage, the hit carries it · control, lands on the held target · heal, bursts on adjacent foes (lightning leaps to an ally) · summon, its hits carry it · movement, bursts where you land · ward (future), resists that element and its status · terrain (future), material changes (cold icicles, fire burning ground, poison mire, shadow darkness, healing hallowed ground, physical stone).
   - Doses stay small: Sól's centre gets four at once. Exact doses come with the stat step sizes.
2. Fold answers into the page's "Grimoire redesign" section per memory `notion-plan-answers`.
3. Outliers one by one: Detect Monsters, Detect Objects, Identify, Clairvoyance, Teleport (Phase Door is covered by the movement rule unless the owner objects).

## Decisions
- Altar: two captives buy one spell; blood vs frith mirrored (Reap↔Grið, Draugr-call↔Dísir); Volatile Energy cut, blood costs HP, corruption a mark; town swing ±10 — owner: "Yes" (each)
- Altar reason: two captives volunteer (the old way) + a dying human Sól-Brand Zealot leader at the F21 pylon claims only blood harms Níðhögg; never confirmed; Völuspá's Náströnd stanza argues back — owner: "Approve all recommendations"

## Read first
- The Notion magic review page: item 1 and "Grimoire redesign"
- `src/content/cotw/magic.ts:134` — the glyphs the flavours come from
- `src/content/cotw/elements.ts:5` — elements and their opposites
