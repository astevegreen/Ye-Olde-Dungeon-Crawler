import type { TileDefinition } from '../../engine';
import { SKALDIC_RUNESTONE_TILES } from './runestones';
import { IRON_CLANS_BARROW_TILES } from './ironClans';

/** Bjarnarhaven's lanes and street furniture (townLayout.ts). */
const townThing = (type: string, name: string, glyph: string, description: string): TileDefinition => ({
  type,
  name,
  passable: false,
  walkable: false,
  transparent: true,
  blocksProjectiles: false,
  glyph,
  description,
});

/**
 * Castle of the Winds campaign-specific tile definitions (ARCHITECTURE.md §3).
 * Extracted from engine built-in TILES so the core engine remains completely pack-neutral.
 */
export const COTW_TILES: TileDefinition[] = [
  {
    type: 'town_road',
    name: 'Cobbled Lane',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: ',',
    description: 'Frost-heaved cobbles, swept clear of the worst of the snow.',
  },
  townThing('town_pine', 'Snow-laden Pine', 'T', 'A dark pine bowed under its load of snow.'),
  townThing('town_fountain', 'Frozen Fountain', 'F', 'The plaza fountain, frozen solid beneath a carved raven.'),
  townThing('town_statue', 'Statue of a Hero', 'A', 'A weathered stone warrior, hammer raised against the long winter.'),
  townThing('town_hay_cart', 'Hay Cart', 'H', 'A farm cart heaped with hay for the stables.'),
  townThing('town_goods_cart', 'Goods Cart', 'C', "A trader's cart stacked with crates and sacks."),
  townThing('town_barrels', 'Barrels', 'O', 'Iron-hooped barrels of ale, salt fish and pitch.'),
  townThing('town_woodpile', 'Woodpile', 'L', 'Split logs stacked for the hearths.'),
  townThing('town_market_stall', 'Market Stall', 'M', 'A market stall under a faded striped awning.'),
  {
    // Opens where Níðhögg falls: the way into Ragnarök (quest.ts, ending 'ragnarok').
    type: 'gateway_valhalla',
    name: 'The Split Root',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '▲',
    description: 'Where Níðhögg fell, the World Root has split open onto fire and storm. Step through, and the age of the gods ends.',
    interactionHandlerId: 'quest_victory_portal',
    visual: 'portal',
  },
  {
    // Opens where Níðhögg is driven off: the way home (index.ts bossFleeResolutions, ending 'sealed').
    type: 'gateway_home',
    name: 'The Path of Light',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '▲',
    description: 'The gnawed root has knit closed, and a path of warm light runs up toward Bjarnarhaven. Step through to go home.',
    interactionHandlerId: 'quest_victory_portal',
    visual: 'portal',
  },
  {
    type: 'altar_tyr',
    name: 'Ancient Altar of Tyr',
    passable: true,
    walkable: true,
    transparent: true,
    // Drawn as an altar fixture, like the rune altars below; the glyph is Tyr's rune.
    visual: 'altar',
    glyph: 'ᛏ',
    description: 'A weathered runic altar consecrated to Tyr, god of justice. Blood-stained defilement clings to the ancient runes.',
    interactionHandlerId: 'altar_tyr',
    landmarkLabel: 'Altar of Tyr',
  },
  {
    // Stamped by the floor-22 siphon vault's layout legend (hostageRitual.ts).
    type: 'siphon_altar',
    name: 'Siphon Altar of Járnviðr',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '_',
    description: 'An ancient obsidian altar marked with blood runes, its grooves pooled with dark vitriol.',
    interactionHandlerId: 'blood_altar_ritual',
    landmarkLabel: 'Siphon Altar',
  },
  {
    // Spell altar (COTW_MAGIC.altars): one rite, then spent.
    type: 'galdr_altar_tyr',
    name: "Týr's Oath-Stone",
    passable: true,
    walkable: true,
    transparent: true,
    visual: 'altar',
    glyph: 'ᛏ',
    description: 'A runestone carved with a wolf and a severed hand. It hums with oaths.',
    interactionHandlerId: 'galdr_altar_tyr',
    landmarkLabel: "Týr's Oath-Stone ᛏ",
  },
  {
    // Spell altar (COTW_MAGIC.altars): one rite, then spent.
    type: 'galdr_altar_odin',
    name: "Odin's Gallows-Stone",
    passable: true,
    walkable: true,
    transparent: true,
    visual: 'altar',
    glyph: 'ᚨ',
    description: 'A gallows-shaped stone hung with nine rotted cords.',
    interactionHandlerId: 'galdr_altar_odin',
    landmarkLabel: "Odin's Gallows-Stone ᚨ",
  },
  {
    // Spell altar (COTW_MAGIC.altars): one rite, then spent.
    type: 'galdr_altar_hel',
    name: "Hel's Grave-Altar",
    passable: true,
    walkable: true,
    transparent: true,
    visual: 'altar',
    glyph: 'ᛉ',
    description: 'A half-buried altar, one side living stone, the other cold and black.',
    interactionHandlerId: 'galdr_altar_hel',
    landmarkLabel: "Hel's Grave-Altar ᛉ",
  },
  {
    // Spell altar (COTW_MAGIC.altars): one rite, then spent.
    type: 'galdr_altar_loki',
    name: "Loki's Cairn",
    passable: true,
    walkable: true,
    transparent: true,
    visual: 'altar',
    glyph: 'ᛚ',
    description: 'A leaning cairn that is never quite the same shape twice.',
    interactionHandlerId: 'galdr_altar_loki',
    landmarkLabel: "Loki's Cairn ᛚ",
  },
  ...SKALDIC_RUNESTONE_TILES,
  ...IRON_CLANS_BARROW_TILES,

  // --- Act 1 Campfire Grotto: The Dwarven Hearth Grotto (Floor 13) ---
  {
    type: 'dwarven_cascade_veil',
    name: 'Subterranean Cascade',
    passable: true,
    walkable: true,
    transparent: false,
    glyph: '≈',
    description:
      'A rushing veil of cold mountain runoff pouring from a fissure in the rock. The spray obscures the passage behind it.',
  },
  {
    type: 'grotto_hearth',
    name: 'Dwarven Hearth',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '♨',
    landmarkLabel: 'Dwarven Hearth',
    description:
      'An ancient iron-banded stone hearth glowing with banked geothermal embers. The radiating warmth soothes tired bones and dispels the dungeon chill.',
    interactionHandlerId: 'choice_dwarven_hearth',
  },
  {
    type: 'grotto_mineral_spring',
    name: 'Thermal Mountain Spring',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '~',
    description:
      'A bubbling pool of crystal-clear mineral water. Wisps of steam rise gently into the quiet air.',
    interactionHandlerId: 'choice_dwarven_spring',
  },
  {
    type: 'grotto_stone_bench',
    name: 'Carved Basalt Bench',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'π',
    description:
      'A low bench carved directly into the basalt wall, polished smooth by centuries of miners resting in peace.',
  },
  {
    type: 'grotto_supplies',
    name: 'Wayfarer Supplies',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '⌂',
    description:
      'A weathered copper kettle, dried mountain herbs, and a bundle of dry kindling left behind for weary travelers.',
  },

  // --- Act 2 Campfire Grotto: The Heartwood Knothole (Floor 37) ---
  {
    type: 'root_curtain_veil',
    name: 'Woven Root Curtain',
    passable: true,
    walkable: true,
    transparent: false,
    glyph: '}',
    description:
      'A dense curtain of hanging tree rootlets, woven lianas, and weeping amber bark. The fibrous tendrils yield easily to a gentle push.',
  },
  {
    type: 'world_bark_campfire',
    name: 'Amber Peat Fire',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '♨',
    landmarkLabel: 'Amber Hearth',
    description:
      'A low campfire of fragrant dried peat and pine resin glowing within a ring of smooth river stones. It crackles softly, driving away the creeping blight.',
    interactionHandlerId: 'choice_world_bark_hearth',
  },
  {
    type: 'world_bark_sap_pool',
    name: 'Living Sap Font',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '~',
    description:
      'A natural hollow in the heartwood catching slow, golden droplets of uncorrupted Yggdrasil sap. The liquid gleams with gentle warmth.',
    interactionHandlerId: 'choice_world_bark_font',
  },
  {
    type: 'world_bark_moss_bed',
    name: 'Star-Lichen Bed',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '≈',
    description:
      'A thick, springy bed of emerald moss and luminescent star-lichen. It yields gently underfoot, smelling of rain and fresh soil.',
  },
  {
    type: 'world_bark_chimes',
    name: 'Carved Root Talismans',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '♪',
    description:
      'Polished alder chimes and woven bark talismans hung on fine sinew. They chime in gentle, rhythmic tones whenever the cavern breathes.',
  },
];
