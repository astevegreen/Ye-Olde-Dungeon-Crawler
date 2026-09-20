# CotW Content Pack — Item Catalog

## Overview

Complete item catalog for the `cotw` content pack, covering levels 2–50 across both acts and the folklore intermission.

**Assumption to verify before implementation:** ARCHITECTURE.md references `Paperdoll.equip`/`unequip` but does not enumerate the slot set. This catalog assumes the canonical *Castle of the Winds* paperdoll — **head, neck, torso, back, hands, main hand, off hand, belt, ring ×2, feet, pack, purse**. Check the actual `Paperdoll` slot enum and adjust before wiring; if the slot set differs, the per-slot groupings below shift but the items themselves still stand.

**Coverage target:** every slot gets at least 4 distinct options spread across the level bands, so there is always a meaningful upgrade decision rather than a single linear best-in-slot.

| Slot | Count |
| --- | --- |
| Main hand (weapons) | 13 |
| Off hand (shields/foci) | 6 |
| Head | 5 |
| Torso | 6 |
| Back (cloak) | 5 |
| Hands | 5 |
| Feet | 5 |
| Belt | 5 |
| Neck | 5 |
| Ring | 7 |
| Pack / purse | 5 |
| Consumables & utility | 16 |
| **Total** | **83** |

**Band key:** A1-early (2–9) · A1-mid (10–17) · A1-late (18–25) · Folk (intermission) · A2-early (26–33) · A2-mid (34–42) · A2-late (43–50)

Items marked **(Corrupted)** carry a real drawback and are meant to be genuinely tempting rather than strictly worse — power with a cost the player opts into.

## Main hand — weapons (13)

Spread across weapon classes so a player can commit to a style: light/fast, heavy/slow, reach, and caster implements.

| Item | Band | Class | Effect |
| --- | --- | --- | --- |
| Mammut-Bone Cudgel | A1-early | Blunt | Starter weapon. Crude and heavy; small bonus damage against unarmored targets |
| Rime-Bit Chisel | A1-early | Dagger | Cold-iron glacier tool. Fast, low base damage, heavy bonus damage against frozen/brittle-tagged enemies |
| Skraeling Ice-Knapped Spear | A1-early | Reach | Attacks at 2 tiles; low damage, but strikes before an approaching melee enemy closes |
| Forge-Tongue Hammer | A1-mid | Blunt | Dwarven smith's hammer. High damage vs. constructs and armored foes; slow swing |
| Duergar Slag-Tongs | A1-mid | Polearm | Reach 2. Can disarm armed humanoid foes; immune to heat damage from what it grips |
| Cinder-Edge Shortsword | A1-mid | Blade | Forge-tempered. Reliable all-round damage, small burn chance on hit |
| Sól-Brand Glaive | A1-late | Polearm | Sun-chariot alloy. Heavy fire damage; illuminates a radius around the wielder, which wakes dormant monsters sooner |
| Ironwood Bough-Stave | A1-late | Caster staff | Petrified troll-wife bough. Boosts spell damage and mana regeneration; poor melee |
| Tarnished Quicksilver Stiletto | A2-early | Dagger | Mercury-veined. Ignores a portion of target armor; small self-poison chance on each hit |
| Pit-Draugr Pick | A2-early | Pick | Miner's tool. Armor-piercing; can dig through certain soft wall tiles |
| Heartwood Longsword | A2-mid | Blade | Cut from clean Yggdrasil grain. High damage, resists rot corruption, slowly self-repairs its own bonuses |
| Rot-Porous Cleaver **(Corrupted)** | A2-mid | Great axe | Devastating rot damage that cleaves armor; blocks natural HP regeneration while equipped |
| Níðhögg's Fang | A2-late | Blade | Level-50 relic. Massive necrotic damage; lifesteal on kill, but marks the wielder — hostile spawn rate rises while held |

## Off hand — shields & foci (6)

Includes non-shield options so casters have a reason to use the slot.

| Item | Band | Effect |
| --- | --- | --- |
| Lashed Driftwood Buckler | A1-early | Scavenged planks and sinew. Small block chance; breaks flavor-wise but mechanically just weak |
| Bellows-Plate Shield | A1-mid | Riveted automaton plating. Solid block; vents soot when struck, briefly reducing the attacker's accuracy |
| Sól-Shard Focus | A1-late | Caster focus. Directional glare pierces smoke and blinds subterranean beasts; suppresses the giant-blood bonus while held |
| Mirror-Skulker Facet | A1-late | Polished quartz panel. Reflects a portion of incoming beam/fire damage back at the source |
| Petrified World-Bark Tower Shield | A2-mid | Massive Yggdrasil slab. Excellent kinetic defense; if the player stays on one tile several turns it roots them in place for a short duration |
| Draugr-Bone Ward | A2-late | Lashed rib-cage barrier. High block plus fear resistance; small chance to reanimate a slain enemy briefly as a temporary ally |

## Head (5)

| Item | Band | Effect |
| --- | --- | --- |
| Brim-Wolf Pelt Hood | A1-early | Frozen wolf hide. Cold resistance; extends the giant-blood bonus one zone band deeper than it would otherwise reach |
| Skraeling Bone Circlet | A1-early | Lashed goblin trophy-bone. Minor defense, small bonus to detecting nearby hostiles |
| Soot-Visored Helm | A1-mid | Dwarven forge helm. Good defense; immunity to blind/soot effects, slight FOV reduction |
| Zealot's Seared Crown | A1-late | Solar-runed iron band. Fire resistance and bonus spell damage; light radius wakes dormant monsters sooner |
| Antler-Crowned Mask of the Iviðja | A2-mid | Troll-wife headdress. Boosts max mana and root/immobilize resistance |

## Torso (6)

| Item | Band | Effect |
| --- | --- | --- |
| Layered Fur Jerkin | A1-early | Starter armor. Light, minor cold resistance |
| Mammut-Hide Brigandine | A1-early | Bone-plated hide. Moderate defense, no penalties — the reliable early choice |
| Cinder-Quenched Hauberk | A1-mid | Dwarven ringmail. Superior defense against crushing blows; penalty to fire/heat resistance, so it gets worse the deeper you go in Act 1 |
| Obsidian Scale Cuirass | A1-late | Volcanic glass scales. High defense and strong fire resistance; heavy, reducing carry capacity |
| Quicksilver Mesh Shirt | A2-early | Fluid mercury weave. Light armor that boosts dodge; slowly applies a mild toxic stack over long wear |
| Níð-Dripping Hauberk **(Corrupted)** | A2-late | Tar-coated plate. Melee attackers take acid retribution damage; reduces the potency of all healing consumables |

## Back — cloaks (5)

| Item | Band | Effect |
| --- | --- | --- |
| Tattered Traveler's Wrap | A1-early | Plain starter cloak. Tiny defense bonus, no drawback |
| Ash-Weave Mantle | A1-mid | Soot-saturated wool. Reduces the range at which monsters notice you in lit areas |
| Huldra's Nettlespun Cloak | Folk | Forest-weed weave. Conceals from beasts and woodland spirits; dampens hearing and slows retreat in cramped tunnels |
| Sap-Sealed Cape | A2-mid | Resin-hardened. Resists acid and rot damage; slightly slows movement |
| Shroud of the Unburied | A2-late | Myling-haunted grave linen. Strong necrotic resistance; undead hesitate one turn before attacking you |

## Hands (5)

| Item | Band | Effect |
| --- | --- | --- |
| Frost-Cracked Mitts | A1-early | Stiff hide wraps. Minor defense; small penalty to spellcasting precision |
| Duergar Forge Gauntlets | A1-mid | Heat-proof leather and iron. Lets you handle burning objects safely; bonus melee damage |
| Glassblower's Grips | A1-late | Siphon-worker's gloves. Bonus damage with foci and casting implements |
| Leech-Skin Gloves | A2-early | Quicksilver-parasite hide. Small lifesteal on melee hits |
| Root-Wound Bracers | A2-mid | Living taproot fiber. Slow passive HP regeneration; reduced healing from consumables |

## Feet (5)

| Item | Band | Effect |
| --- | --- | --- |
| Bound Hide Wrappings | A1-early | Starter footwear. No bonuses, no penalties |
| Crampon-Nailed Boots | A1-early | Iron-spiked soles. Immunity to slipping on ice tiles; slightly noisy, waking monsters sooner |
| Treadplate Sabatons | A1-mid | Automaton-tread iron. High defense, reduced movement speed |
| Sure-Step Mine Boots | A2-early | Miner's reinforced boots. Reduced chance of triggering floor traps |
| Rootless Striders | A2-mid | Bark-fiber weave. Immune to root/immobilize effects, including the tower shield's self-root |

## Belt (5)

| Item | Band | Effect |
| --- | --- | --- |
| Braided Sinew Cord | A1-early | Plain starter belt. One extra quick-slot |
| Tool-Hung Smith's Girdle | A1-mid | Dwarven work belt. Several extra quick-slots for consumables |
| Ember-Pouch Sash | A1-late | Heat-lined. Consumables used from it also apply a small burn to adjacent enemies |
| Silverlode Money-Belt | A2-early | Miner's hidden belt. Increases gold found and protects carried coin from theft effects |
| Girdle of Thrym's Line | A2-late | Ancestral giant-iron. Substantial bonus to carry capacity and raw melee damage |

## Neck (5)

| Item | Band | Effect |
| --- | --- | --- |
| Wolf-Tooth Thong | A1-early | Hunter's trophy. Small bonus to hit against beast-tagged enemies |
| Nisse's Pewter Porridge-Spoon | Folk | Hearth-charm on a cord. Protects rations from vermin; alerts you to sleeping ambushes nearby |
| Corpse-Chieftain's Eye-Coin | Folk | Draugr lord's grave-coin. Complete immunity to fear, dread, and paralysis effects |
| Sun-Fragment Pendant | A1-late | Chariot shard on a chain. Bonus fire damage and a permanent small light radius |
| Amber Heart-Drop | A2-mid | Fossilized world-tree resin. Substantial max-HP bonus; slows mana regeneration |

## Rings (7)

Two ring slots share one pool, so combinations matter — the catalog leans into effects that interact.

| Item | Band | Effect |
| --- | --- | --- |
| Bone-Carved Band | A1-early | Crude first ring. Small flat defense |
| Rime-Signet of the Hollows | A1-early | Ice-etched silver. Bonus cold damage; enemies you strike briefly slow |
| Ring of the Slag-Walker | A1-mid | Forge-quenched iron. Immunity to damage from burning ground tiles |
| Duergar Vault-Ring | A1-mid | Vault-warden's seal. Improves chance of finding secret doors and hidden caches |
| Mirror-Cut Ring | A1-late | Faceted quartz. Reflects a small portion of spell damage back at casters |
| Ring of the Deep Lode | A2-early | Tarnished miner's band. Bonus mana and detects ore/treasure within a radius |
| Marrow-Gnawed Ring **(Corrupted)** | A2-late | Dragon-eaten bone. Massively amplifies physical and magical damage; the ground underfoot periodically weakens into collapsing sinkholes |

## Pack & purse (5)

Castle of the Winds treated carrying capacity as equippable gear, which gives inventory management its own upgrade path.

| Item | Band | Slot | Effect |
| --- | --- | --- | --- |
| Sealskin Rucksack | A1-early | Pack | Starter pack. Baseline capacity |
| Dwarven Tool-Frame | A1-mid | Pack | Rigid iron frame. Notably larger capacity, slight movement penalty when heavily loaded |
| World-Bark Satchel | A2-mid | Pack | Hollowed living bark. Large capacity; contents resist rot and acid damage |
| Leather Coin-Pouch | A1-early | Purse | Starter purse. Baseline coin capacity |
| Quicksilver-Lined Purse | A2-early | Purse | Mercury-sealed. Larger coin capacity; reduces gold lost on death |

## Consumables & utility (16)

Tactile Norse objects in place of generic potions and scrolls. Several are deliberately double-edged so using them is a decision rather than a reflex.

### Curatives

| Item | Band | Effect |
| --- | --- | --- |
| Birch-Tar Poultice | A1-early | Halts bleeding, rot, and venom immediately; deadens nerves, temporarily lowering dodge |
| Hearth-Broth Flask | A1-early | Basic healing draught. Restores a modest amount of HP over several turns rather than instantly |
| Bog-Myrtle Tonic | A1-mid | Restores mana; briefly muddles spell targeting precision |
| Marrow-Rich Stew | A2-early | Large healing plus a temporary max-HP boost; heavy, takes two turns to consume |
| Draught of Thawed Blood | A2-mid | Full cure of all negative statuses; leaves the drinker slowed for several turns |

### Combat & tactical

| Item | Band | Effect |
| --- | --- | --- |
| Bog-Iron Whetstone | A1-early | Restores edge to a weapon and adds an oxidizing layer that inflicts bleed on future strikes |
| Bellows-Skin Canteen | A1-mid | Sprays concentrated soot; blinds adjacent monsters and breaks line of sight in corridors |
| Ice-Stave Rune Tablet | A1-mid | Smashed on the ground, flash-freezes blood, water, and acid pools into impassable rime pillars |
| Zealot's Sun-Flare | A1-late | Thrown flare. Heavy fire damage in a small radius; lights the area, waking nearby dormant monsters |
| Vial of Choke-Damp | A2-early | Released mine gas. Creates a lingering poison cloud that also damages the thrower if they stand in it |
| Grave-Salt Pouch | A2-mid | Scattered on a tile, prevents undead from crossing it for several turns |

### Utility & knowledge

| Item | Band | Effect |
| --- | --- | --- |
| Grave-Wax Candle | Folk | Pale blue flame exposes hidden door seams, barrow illusions, and ethereal stalkers; rapidly attracts undead |
| Mead of the Corpse-Tongue | Folk | Read ancient petroglyphs and anticipate enemy movement paths; severely blurs field of vision meanwhile |
| Rune-Scratched Bark Map | A1-mid | Reveals the layout of the current floor, but not its contents |
| Duergar Lodestone | A1-late | Points toward the floor's descending stair; consumed on use |
| Wand of the Ironwood Bough | A2-mid | Aimed wand with limited charges; fires a rooting bolt that immobilizes a single target |

## Implementation notes

**Verify before wiring**

1. **Slot enum.** Confirm the real `Paperdoll` slot set before grouping these — this catalog assumes the canonical CotW layout (see Overview).
2. **No durability system.** Nothing here depends on item durability; if one gets reintroduced later, the Bog-Iron Whetstone and Heartwood Longsword are the natural hooks for it.
3. **No stamina stat.** All effects are expressed in terms of HP, mana, defense, damage, speed/energy, carry capacity, light radius, and status effects.
4. **Giant-blood interaction.** Three items touch the giant-blood bonus (Brim-Wolf Pelt Hood extends it, Sól-Shard Focus suppresses it, Girdle of Thrym's Line is thematically tied). Those need `cotw/giantBlood.ts` to expose something the item layer can read or modify.

**Mechanics these items assume exist**

Most map onto systems already in the spec — status effects, damage affinities, hook descriptors, drop tables, and the tag system. A handful would need new capability and should be checked against *No Engine Creep* (§3) before being promised:

- Light-radius-affecting equipment that changes monster awakening behavior
- Trap-trigger-chance modifiers (Sure-Step Mine Boots)
- Tile-denial consumables (Grave-Salt Pouch, Ice-Stave Rune Tablet) — likely expressible through the existing surfaces system
- Wall-digging weapons (Pit-Draugr Pick)
- Gold-loss-on-death reduction (Quicksilver-Lined Purse)

**Distribution suggestion**

Corrupted items work best as guaranteed drops from named minibosses and Act 2 zone bosses rather than in the random pool, so the tradeoff feels like a deliberate offer. Starter-tier items (Mammut-Bone Cudgel, Layered Fur Jerkin, Bound Hide Wrappings, Sealskin Rucksack, Leather Coin-Pouch) are natural candidates for the starting-kit roll.
