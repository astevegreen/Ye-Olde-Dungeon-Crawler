import type { KillRiteDefinition } from '../../engine';

/**
 * Galdr of the Slain: how each monster must die to yield its magic (engine `KillRiteDefinition`).
 *
 * Every condition is something the hero controls: the killing blow's element (arcane =
 * Magic Arrow, physical = a weapon), a status the hero's own spells inflict (slow,
 * paralysis), the size of the blow, or the hero's own state. None depends on where a
 * monster happens to stand.
 *
 * Spells come from learning stones (`magic.ts`, P-34), not from rites. A rite is a
 * carrier's shortcut: the kind that carries a floor's shard, killed its way, opens the
 * stone's card on the spot, and a kind's first such kill gives an Essence-Rune of its
 * element. Every carrier kind below can be met by any hero: Magic Arrow, a weapon, a kill
 * in its sleep, or a spell the hero has by the kind's first floor. Other kinds' rites
 * yield nothing while stones are on.
 */
export const COTW_KILL_RITES: Record<string, KillRiteDefinition> = {
  // The night raid's creatures (prologue.ts) have no rite: they appear only in the raid,
  // before the hero can call fire, and are gone when it ends, so a rite could never be met.

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
    requiresVictimAsleep: true,
    hintVerse: 'Awake, the imp outruns every pursuer.\nFind it asleep, and end it before it stirs.',
  },
  hoarfrost_skraeling: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: 'Frost cannot bite what frost begot.\nOnly flame parts a skraeling from its rime.',
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
    essenceElement: 'cold',
    requiredDamageElement: 'physical',
    hintVerse: 'The howler of the brim runs down all it hunts.\nStop it with honest iron, and its leaden breath is spent.',
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
    essenceElement: 'cold',
    requiredDamageElement: 'arcane',
    hintVerse: 'No slowness binds Gálmr, but pure galdr pierces his frost.\nFell him with a rune-bolt, and his freezing beam is yours.',
  },
  kobold_shaman: {
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
    hintVerse: 'Every wolf of the north remembers the campfire.\nLet flame be its last sight, and the pack will answer your howl.',
  },
  winter_hag: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: "Melt the Vetrarkona with flame,\nand her freezing beam is loosed into your keeping.",
  },
  huldra_hollow_back: {
    essenceElement: 'arcane',
    requiredDamageElement: 'arcane',
    requiredVictimStatus: 'slow',
    hintVerse: 'The hollow-backed maid steps between trees at will.\nSlow her, strike her down with rune-force, and learn her vanishing step.',
  },
  huldra: {
    essenceElement: 'arcane',
    requiredDamageElement: 'cold',
    hintVerse: 'The forest maid senses every living thing in her wood.\nStill her heart with frost, and that sense is yours.',
  },

  // ─── Abandoned Dwarven Works (10-17) ───────────────────────────────────
  cinder_gilded_duergar: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: "The gilded smith steps out of his own forge-smoke and into yours.\nQuench his cinders with frost, and learn the trickster's trade of places.",
  },
  forge_wretch: {
    essenceElement: 'fire',
    requiresVictimAsleep: true,
    hintVerse: 'The wretch has stoked the forge for a hundred years.\nLet it die at its bellows, asleep, and not wake to its labor.',
  },
  myling: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'The unburied child begs for rest.\nGive it the pyre it never had, and the moon will draw its veil for you.',
  },
  ogre: {
    essenceElement: 'physical',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the lumbering brute,\nthen bring it down while it drags.',
  },
  bellows_automaton: {
    essenceElement: 'lightning',
    requiredDamageElement: 'lightning',
    hintVerse: "Answer the automaton's bellows with the storm that fills them,\nand the lightning in its coils is spent.",
  },
  kirkegrim: {
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
    hintVerse: 'Trolls fear the Thunderer above all things.\nStrike this one down with lightning, and carry his clap in your fist.',
  },

  // ─── Obsidian Siphon (18-25) ───────────────────────────────────────────
  sol_brand_zealot: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'The zealot burns with a stolen sun.\nPut out that sun with frost.',
  },
  miniboss_zealot_leader: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'Vigdís carries the stolen sun burned into her palm.\nQuench the brand with frost.',
  },
  ironwood_troll_wife: {
    essenceElement: 'shadow',
    requiredDamageElement: 'physical',
    hintVerse: 'The Ironwood crone fears nothing but plain iron.\nGive her a blade.',
  },
  fire_giant: {
    essenceElement: 'fire',
    requiredVictimStatus: 'slow',
    hintVerse: "Slow Múspell's son,\nand end him while his stride is heavy.",
  },
  prismatic_mirror_skulker: {
    essenceElement: 'arcane',
    requiredDamageElement: 'arcane',
    hintVerse: 'Shatter the mirror-skulker with a bolt of pure rune-force,\nand every prism it stepped between goes dark.',
  },
  glod: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    requiresOverkillPercent: 10,
    hintVerse: 'The ember-salamander must be drowned in frost:\nstrike it past its last breath by a tenth of its strength.',
  },
  captive_of_the_chariot: {
    essenceElement: 'fire',
    requiresOverkillPercent: 15,
    hintVerse: 'Free the chained spirit with one blow that overshoots its life\nby a sixth of its strength, and the sun-fire it guarded bursts to you.',
  },
  frost_drake: {
    essenceElement: 'cold',
    requiredDamageElement: 'fire',
    hintVerse: 'The rime-worm yields only to flame,\nand the venom of the worm of Gnitaheid is the gift.',
  },
  sun_chariot_warden: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    hintVerse: 'Extinguish the stolen sun in the iron warden with frost,\nand seize the fire it burned with.',
  },

  // ─── Tarnished Silver Veins (26-33) ────────────────────────────────────
  quicksilver_leech: {
    essenceElement: 'arcane',
    requiredDamageElement: 'lightning',
    hintVerse: 'Quicksilver answers to the storm.\nStrike the leech with lightning.',
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
    hintVerse: 'Tear the parasite from the World Tree\nwith a bolt of pure rune-force.',
  },
  ancient_wyrm: {
    essenceElement: 'fire',
    requiredDamageElement: 'cold',
    requiredVictimStatus: 'slow',
    hintVerse: 'Slow the ancient wyrm, then freeze the fire in its belly.',
  },
  root_bound_berserker: {
    essenceElement: 'physical',
    requiredDamageElement: 'physical',
    maxCasterHpPercent: 50,
    hintVerse: 'Nothing binds a berserker; only rage answers rage.\nFell it with iron while your own life runs below half.',
  },
  miniboss_rot_matriarch: {
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
    requiredDamageElement: 'arcane',
    hintVerse: 'The hell-hound runs from nothing but a clean bolt of rune-force.\nLoose one.',
  },
  nastrond_feaster: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'Burn the Náströnd feaster at its meal.',
  },
  miniboss_tar_abomination: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    hintVerse: 'Gloom-Tarr must burn.\nSet the tar alight and the dark goes with it.',
  },
  malice_weaver: {
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
    requiredVictimStatus: 'slow',
    hintVerse: 'A shadow fiend flits too fast to strike.\nSlow it, then end it.',
  },
  hel_warden: {
    essenceElement: 'shadow',
    requiredDamageElement: 'fire',
    requiresOverkillPercent: 2,
    hintVerse: "Hel's warden cannot be bound, only overwhelmed:\nburn it with a blow that runs well past its last breath.",
  },
  miniboss_marrow_eater: {
    essenceElement: 'shadow',
    requiredDamageElement: 'arcane',
    requiresOverkillPercent: 0.5,
    hintVerse: 'Sköll gnaws the void-bone. Strike him with a rune-bolt\nthat runs well past his last breath.',
  },
  nidhogg: {
    essenceElement: 'shadow',
    requiredDamageElement: 'lightning',
    hintVerse: 'The root-gnawer fears the Thunderer.\nStrike him down with lightning.',
  },
};
