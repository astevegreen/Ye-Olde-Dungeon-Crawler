import type { KillRiteDefinition } from '../../engine';

/**
 * Galdr of the Slain: how each monster must die to yield its magic (engine `KillRiteDefinition`).
 *
 * Every condition is something the hero controls: the killing blow's element (arcane =
 * Magic Arrow, physical = a weapon), a status the hero's own spells inflict (slow,
 * paralysis), the size of the blow, or the hero's own state. None depends on where a
 * monster happens to stand.
 *
 * Spell pacing. A new hero knows Magic Arrow and Heal Minor Wounds; the rites below teach
 * the rest, each opening the next (Slow opens "while slowed", Cold Ray opens "cold", and
 * so on). `killRites.test.ts` checks every teaching rite can be met with the spells
 * obtainable by that monster's first floor.
 *
 *   Rime Hollows (1-9)    Slow 4 · Cold Ray 5/7 · Firebolt 6 · Phase Door 8 · Detect Monsters 8
 *   Dwarven Works (10-17) Detect Objects 10 · Lightning Bolt 12/15 · Heal Medium 12/14 · Identify 14
 *   Obsidian Siphon (18-25) Teleport 20 · Fireball 22/25
 *   Silver Veins (26-33)  Paralyze 28 · Clairvoyance 29
 *   Deeper: second sources for Lightning Bolt, Paralyze and Clairvoyance
 *
 * A rite whose spell the hero already knows (or that teaches none) drops an essence rune
 * of its element instead: offerings for the runic altars.
 */
export const COTW_KILL_RITES: Record<string, KillRiteDefinition> = {
  // ─── The night raid (prologue.ts) ─────────────────────────────────────
  prologue_rime_wolf: {
    essenceElement: 'cold',
    requiredDamageElement: 'arcane',
    hintVerse: 'A rime-wolf that runs is a wolf that lives.\nSend a rune-bolt after it.',
  },
  prologue_coven_thrall: {
    essenceElement: 'shadow',
    requiredDamageElement: 'physical',
    hintVerse: 'The bound dead go back to the snow\nunder plain iron.',
  },
  prologue_coven_warlock: {
    essenceElement: 'arcane',
    requiredDamageElement: 'arcane',
    hintVerse: 'She stands lost in her rite at the fountain.\nBreak it with a rune-bolt.',
  },

  // ─── Rime Hollows (1-9) ────────────────────────────────────────────────
  giant_rat: {
    essenceElement: 'physical',
    requiredDamageElement: 'physical',
    hintVerse: 'The gnawer of winter stores yields its grit\nonly to plain, honest iron.',
  },
  kobold: {
    essenceElement: 'arcane',
    requiredDamageElement: 'arcane',
    hintVerse: 'The little trickster fears the galdr-shaft most:\nfell it with a bolt of pure rune-force.',
  },
  skratti: {
    essenceElement: 'arcane',
    requiredDamageElement: 'arcane',
    requiresOverkillPercent: 50,
    hintVerse: 'Snuff the imp with a rune-bolt far heavier than it deserves:\nstrike past its last breath by half its strength again.',
  },
  hoarfrost_skraeling: {
    essenceElement: 'cold',
    requiredDamageElement: 'physical',
    hintVerse: 'Frost cannot bite what frost begot.\nOnly cold iron parts a skraeling from its rime.',
  },
  goblin: {
    essenceElement: 'physical',
    requiredDamageElement: 'physical',
    hintVerse: 'A goblin respects nothing but the blade.\nGive it one.',
  },
  orc: {
    essenceElement: 'physical',
    requiredDamageElement: 'physical',
    maxCasterHpPercent: 50,
    hintVerse: 'Blood for blood: strike the orc down with iron\nwhile your own wounds run past half your life.',
  },
  brim_howler: {
    teachesSpellId: 'slow',
    essenceElement: 'cold',
    requiredDamageElement: 'arcane',
    hintVerse: 'The howler of the brim runs down all it hunts.\nStop it with a bolt of pure rune-force, and its leaden breath is yours.',
  },
  glacier_borer: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: 'What bores through glaciers cannot bear the ember.\nBurn it, and keep its heart of ice.',
  },
  skeleton: {
    essenceElement: 'shadow',
    requiredDamageElement: 'arcane',
    requiredVictimStatus: 'slow',
    hintVerse: 'Weigh the rattling bones down with slowness,\nthen scatter them with a rune-bolt.',
  },
  miniboss_frost_warden: {
    teachesSpellId: 'cold_ray',
    essenceElement: 'cold',
    requiredDamageElement: 'arcane',
    hintVerse: 'No slowness binds Gálmr, but pure galdr pierces his frost.\nFell him with a rune-bolt, and his freezing beam is yours.',
  },
  kobold_shaman: {
    teachesSpellId: 'firebolt',
    essenceElement: 'fire',
    requiredDamageElement: 'physical',
    requiredVictimStatus: 'slow',
    hintVerse: "Slow the shaman's chanting tongue,\nthen end him with honest iron to wrest the firebolt from his hands.",
  },
  nisse: {
    essenceElement: 'healing',
    requiredVictimStatus: 'slow',
    hintVerse: 'A nisse is never caught while it is quick.\nSlow the vengeful hearth-spirit before its end.',
  },
  wolf: {
    essenceElement: 'physical',
    requiredDamageElement: 'fire',
    hintVerse: 'Every wolf of the north remembers the campfire.\nLet flame be its last sight.',
  },
  winter_hag: {
    teachesSpellId: 'cold_ray',
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: "Melt the Vetrarkona with flame,\nand her freezing beam is loosed into your keeping.",
  },
  huldra_hollow_back: {
    teachesSpellId: 'phase_door',
    essenceElement: 'arcane',
    requiredDamageElement: 'arcane',
    requiredVictimStatus: 'slow',
    hintVerse: 'The hollow-backed maid steps between trees at will.\nSlow her, strike her down with rune-force, and learn her vanishing step.',
  },
  huldra: {
    teachesSpellId: 'detect_monsters',
    essenceElement: 'arcane',
    requiredDamageElement: 'cold',
    hintVerse: 'The forest maid senses every living thing in her wood.\nStill her heart with frost, and that sense is yours.',
  },

  // ─── Abandoned Dwarven Works (10-17) ───────────────────────────────────
  cinder_gilded_duergar: {
    teachesSpellId: 'detect_objects',
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'The gilded smith smells gold through stone.\nQuench his cinders with frost to inherit that greed.',
  },
  forge_wretch: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'The wretch has stoked the forge for a hundred years.\nLet cold end its labor.',
  },
  myling: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'The unburied child begs for rest.\nGive it the pyre it never had.',
  },
  ogre: {
    essenceElement: 'physical',
    requiredDamageElement: 'physical',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the lumbering brute further still,\nthen bring it down with iron.',
  },
  bellows_automaton: {
    teachesSpellId: 'lightning_bolt',
    essenceElement: 'lightning',
    requiredDamageElement: 'cold',
    hintVerse: "Freeze the automaton's bellows mid-breath,\nand the lightning in its coils leaps to you.",
  },
  kirkegrim: {
    teachesSpellId: 'heal_medium',
    essenceElement: 'healing',
    requiredDamageElement: 'fire',
    hintVerse: 'Cleanse the tomb-vættir with flame,\nand its blessing of mending passes to the living.',
  },
  slag_amorphous: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the molten slag until it cools,\nthen shatter it with frost.',
  },
  haugbui: {
    teachesSpellId: 'identify',
    essenceElement: 'arcane',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'The mound-dweller knows every treasure it guards.\nSlow it, burn it, and read the runes it hoarded.',
  },
  draugr_warrior: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'A draugr rises again unless it is burned.\nBurn this one.',
  },
  draugr: {
    teachesSpellId: 'heal_medium',
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the ancient draugr, then give it the pyre,\nand the life it stole mends your own wounds.',
  },
  nacken: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: "Break the Näcken's river-song with fire,\nand the cold of its brook is yours.",
  },
  troll_wife_warlock: {
    teachesSpellId: 'lightning_bolt',
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the troll-wife, then burn her,\nand the storm she stole from the sky is yours.',
  },
  fylgja: {
    essenceElement: 'healing',
    requiredDamageElement: 'arcane',
    maxCasterHpPercent: 50,
    hintVerse: 'A fylgja shows itself when death is near.\nSlay it with rune-force while your own life is below half.',
  },
  cave_troll: {
    essenceElement: 'physical',
    requiredDamageElement: 'lightning',
    hintVerse: 'Trolls fear the Thunderer above all things.\nStrike this one down with lightning.',
  },

  // ─── Obsidian Siphon (18-25) ───────────────────────────────────────────
  sol_brand_zealot: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'The zealot burns with a stolen sun.\nPut out that sun with frost.',
  },
  ironwood_troll_wife: {
    essenceElement: 'shadow',
    requiredDamageElement: 'lightning',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the Ironwood crone,\nthen let the Thunderer finish her.',
  },
  fire_giant: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    requiredVictimStatus: 'slow',
    hintVerse: "Slow Múspell's son, then smother his fire with frost.",
  },
  prismatic_mirror_skulker: {
    teachesSpellId: 'teleport',
    essenceElement: 'arcane',
    requiredDamageElement: 'lightning',
    hintVerse: 'Shatter the mirror-skulker with lightning,\nand learn the far step it takes between its prisms.',
  },
  glod: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    requiresOverkillPercent: 20,
    hintVerse: 'The ember-salamander must be drowned in frost:\nstrike it past its last breath by a fifth of its strength.',
  },
  captive_of_the_chariot: {
    teachesSpellId: 'fireball',
    essenceElement: 'fire',
    requiresOverkillPercent: 15,
    hintVerse: 'Free the chained spirit with one blow that overshoots its life\nby a sixth of its strength, and the sun-fire it guarded bursts to you.',
  },
  frost_drake: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: 'The rime-worm yields only to flame.',
  },
  sun_chariot_warden: {
    teachesSpellId: 'fireball',
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'Extinguish the stolen sun in the iron warden with frost,\nand seize the fire it burned with.',
  },

  // ─── Tarnished Silver Veins (26-33) ────────────────────────────────────
  quicksilver_leech: {
    essenceElement: 'arcane',
    requiredDamageElement: 'fire',
    hintVerse: 'Boil the quicksilver out of the leech with flame.',
  },
  nar: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'A corpse that walks must be burned where it falls.',
  },
  choke_damp_phantasm: {
    essenceElement: 'shadow',
    requiredDamageElement: 'lightning',
    hintVerse: 'The choke-damp gathers in dead air.\nScatter it with a thunderbolt.',
  },
  root_wraith: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the wraith in its roots, then set them alight.',
  },
  dark_sorcerer: {
    teachesSpellId: 'paralyze',
    essenceElement: 'arcane',
    requiresCasterDebt: true,
    hintVerse: 'The sorcerer respects only those who spend beyond their means.\nSlay him while you owe the Void, and his binding is yours.',
  },
  deep_lode_pit_draugr: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    maxCasterHpPercent: 50,
    hintVerse: 'Burn the pit-draugr while your own life runs below half:\nonly the desperate can match its hunger.',
  },
  silver_wight: {
    teachesSpellId: 'clairvoyance',
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the silver wight, then burn it,\nand its all-seeing gaze over the veins is yours.',
  },
  bark_husk_miner: {
    essenceElement: 'physical',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'paralysis',
    hintVerse: 'Hold the husk rigid and still, then burn the bark from its bones.',
  },

  // ─── World Bark Descent (34-42) ────────────────────────────────────────
  amber_sap_weeper: {
    essenceElement: 'healing',
    requiredDamageElement: 'fire',
    hintVerse: 'Warm the weeping amber with fire until its healing sap runs free.',
  },
  yggdrasil_parasite: {
    essenceElement: 'healing',
    requiredDamageElement: 'arcane',
    requiresOverkillPercent: 30,
    hintVerse: "Tear the parasite from the World Tree with a rune-bolt\nthat overshoots its life by a third of its strength.",
  },
  ancient_wyrm: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the ancient wyrm, then freeze the fire in its belly.',
  },
  root_bound_berserker: {
    essenceElement: 'physical',
    requiredDamageElement: 'cold',
    maxCasterHpPercent: 50,
    hintVerse: 'Nothing binds a berserker; only rage answers rage.\nStill it with frost while your own life runs below half.',
  },
  miniboss_rot_matriarch: {
    teachesSpellId: 'lightning_bolt',
    essenceElement: 'shadow',
    requiredDamageElement: 'lightning',
    hintVerse: 'Split the taproot matriarch with lightning,\nand wield the storm she drank from the sky.',
  },
  rotwood_crawler: {
    essenceElement: 'healing',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the crawler in the rotwood, then burn it.',
  },
  ividja: {
    teachesSpellId: 'paralyze',
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'Burn Iviðja, the Ironwood witch,\nand her binding gaze passes to you.',
  },
  jotun_champion: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: 'No binding holds a jötunn, but slowness can weigh him down.\nSlow the champion, then burn the frost from his blood.',
  },

  // ─── Maw of Malice (43-50) ─────────────────────────────────────────────
  grave_wyrmling: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: "Burn Níðhögg's brood before it grows.",
  },
  garmling: {
    essenceElement: 'shadow',
    requiredDamageElement: 'cold',
    maxCasterHpPercent: 50,
    hintVerse: 'The hell-hound runs only with the dying.\nFreeze it while your own life is below half.',
  },
  nastrond_feaster: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiredVictimStatus: 'paralysis',
    hintVerse: 'Hold the Náströnd feaster rigid at its meal, then burn it.',
  },
  miniboss_tar_abomination: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiresOverkillPercent: 20,
    hintVerse: 'Gloom-Tarr must burn all at once:\nset it alight with a blow past its last breath by a fifth of its strength.',
  },
  malice_weaver: {
    teachesSpellId: 'clairvoyance',
    essenceElement: 'arcane',
    requiredDamageElement: 'lightning',
    hintVerse: 'Cut the malice-weaver from its web with lightning,\nand see as far as it saw.',
  },
  miniboss_maw_herald: {
    essenceElement: 'lightning',
    requiredDamageElement: 'cold',
    requiredVictimStatus: 'slow',
    hintVerse: "Slow the Wyrm's herald, then freeze his tongue before he speaks.",
  },
  shadow_fiend: {
    essenceElement: 'shadow',
    requiredDamageElement: 'lightning',
    requiresCasterDebt: true,
    hintVerse: 'Only one who owes the Void may see a shadow fiend clearly.\nStrike it with lightning while in debt.',
  },
  hel_warden: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiresOverkillPercent: 20,
    hintVerse: "Hel's warden cannot be bound, only overwhelmed:\nburn it with a blow past its last breath by a fifth of its strength.",
  },
  miniboss_marrow_eater: {
    essenceElement: 'shadow',
    requiredDamageElement: 'arcane',
    requiresOverkillPercent: 25,
    hintVerse: 'Sköll gnaws the void-bone. Strike him with a rune-bolt\nthat overshoots his life by a quarter of his strength.',
  },
  nidhogg: {
    essenceElement: 'shadow',
    requiredDamageElement: 'lightning',
    hintVerse: 'The root-gnawer fears the Thunderer.\nStrike him down with lightning.',
  },
};
