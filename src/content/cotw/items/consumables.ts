import type { ItemDefinition } from '../../../engine';

export const COTW_CONSUMABLES: ItemDefinition[] = [
  // ==========================================
  // CURATIVES (5)
  // ==========================================
  {
    id: 'birch_tar_poultice',
    name: 'Birch-Tar Poultice',
    unidentifiedName: 'Black Herbal Paste',
    category: 'consumable',
    tier: 1,
    minFloor: 2,
    weight: 150,
    bulk: 100,
    identified: true,
    description: 'Antiseptic birch-tar and moss paste that neutralizes venom instantly, though it numbs the limb and slows you for a few turns.',
    value: 25,
    itemType: 'potion',
    potionConfig: {
      effects: [
        { type: 'cure_status', status: 'poison' },
        { type: 'apply_status', status: 'slow', duration: 3 },
      ],
    },
  },
  {
    id: 'hearth_broth_flask',
    name: 'Hearth-Broth Flask',
    unidentifiedName: 'Warm Ceramic Flask',
    category: 'consumable',
    tier: 1,
    minFloor: 2,
    weight: 250,
    bulk: 150,
    identified: true,
    description: 'Savory root and bone broth simmered over village hearthfires, restoring 20 Hit Points as it warms chilled veins.',
    value: 20,
    itemType: 'potion',
    potionConfig: {
      potionType: 'health',
      potency: 20,
      effects: [{ type: 'restore_hp', amount: 20 }],
    },
  },
  {
    id: 'bog_myrtle_tonic',
    name: 'Bog-Myrtle Tonic',
    unidentifiedName: 'Murky Amber Draft',
    category: 'consumable',
    tier: 2,
    minFloor: 11,
    weight: 200,
    bulk: 120,
    identified: false,
    description: 'Fermented swamp herbs and honey that restore 30 Seiðr.',
    value: 45,
    itemType: 'potion',
    potionConfig: {
      potionType: 'mana',
      potency: 30,
      effects: [{ type: 'restore_mana', amount: 30 }],
    },
  },
  {
    id: 'marrow_rich_stew',
    name: 'Marrow-Rich Stew',
    unidentifiedName: 'Heavy Clay Pot',
    category: 'consumable',
    tier: 3,
    minFloor: 26,
    weight: 400,
    bulk: 250,
    identified: false,
    description: 'Hearty mammoth marrow stew that restores 60 Hit Points.',
    value: 90,
    itemType: 'potion',
    potionConfig: {
      potionType: 'health',
      potency: 60,
      effects: [{ type: 'restore_hp', amount: 60 }],
    },
  },
  {
    id: 'draught_of_thawed_blood',
    name: 'Draught of Thawed Blood',
    unidentifiedName: 'Steaming Crimson Vial',
    category: 'consumable',
    tier: 4,
    minFloor: 34,
    weight: 300,
    bulk: 180,
    identified: false,
    description: 'A steaming primordial draft that purges every affliction and debilitating venom from the bloodstream, though its chill slows you for a few turns.',
    value: 180,
    itemType: 'potion',
    potionConfig: {
      effects: [
        { type: 'cure_status', status: 'all' },
        { type: 'apply_status', status: 'slow', duration: 4 },
      ],
    },
  },

  // ==========================================
  // COMBAT & TACTICAL (6)
  // ==========================================
  {
    id: 'bellows_skin_canteen',
    name: 'Bellows-Skin Canteen',
    unidentifiedName: 'Black Leather Bellows',
    category: 'consumable',
    tier: 2,
    minFloor: 12,
    weight: 500,
    bulk: 400,
    identified: false,
    description:
      'Discharges a dense plume of soot and ash: monsters within 3 paces are blinded for 3 turns, and the cloud around you hides you from sight for 5. Step away while they grope for you.',
    value: 65,
    itemType: 'potion',
    potionConfig: {
      effects: [
        { type: 'radial_status', radius: 3, tags: ['monster'], status: 'blindness', duration: 3 },
        // Q13 "A": the smoke is real. An opaque cloud hides whoever stands in it.
        { type: 'release_gas', gas: 'dense_steam', radius: 2, duration: 5 },
      ],
    },
  },
  {
    // Q25 (tracker 3.1): the rare level potion. Odin stole the mead of poetry from the
    // giant Suttungr; a mouthful is a level, and levels 48–50 are meant to come this way
    // or from revisiting floors. About one turns up in a full clear (1.05 over 20 seeds,
    // measured in da2f185), on floors 20–24 while it is among the newest definitions; it is
    // never sold.
    id: 'mead_of_suttungr',
    name: 'Mead of Suttungr',
    unidentifiedName: 'Honey-Gold Draught',
    category: 'consumable',
    tier: 3,
    minFloor: 20,
    weight: 300,
    bulk: 150,
    identified: false,
    lootWeight: 0.5,
    description: 'A mouthful of the mead of poetry that Odin stole from the giant Suttungr. One draught, and the drinker rises a whole level.',
    value: 400,
    itemType: 'potion',
    potionConfig: {
      effects: [{ type: 'gain_level' }],
    },
  },
  {
    id: 'zealots_sun_flare',
    name: "Zealot's Sun-Flare",
    unidentifiedName: 'Wrapped Solar Spindle',
    category: 'consumable',
    tier: 3,
    minFloor: 20,
    weight: 300,
    bulk: 200,
    identified: false,
    description: 'A radiant incendiary spindle that bursts in scorching holy fire, setting every beast within three paces ablaze. The flames are quiet: sleeping beasts burn without waking.',
    value: 120,
    itemType: 'potion',
    potionConfig: {
      effects: [
        // 6 fire a turn for 4 turns to every monster within 3 tiles (burning.ts).
        { type: 'radial_status', radius: 3, tags: ['monster'], status: 'burning', duration: 4, potency: 6 },
      ],
    },
  },
  {
    id: 'vial_of_choke_damp',
    name: 'Vial of Choke-Damp',
    unidentifiedName: 'Sealed Green Phial',
    category: 'consumable',
    tier: 3,
    minFloor: 27,
    weight: 250,
    bulk: 150,
    identified: false,
    description: 'Pressurized subterranean mine gas that shatters into a burst of suffocating poison, sickening every other creature within three paces, friend or foe.',
    value: 140,
    itemType: 'potion',
    potionConfig: {
      effects: [
        { type: 'radial_status', radius: 3, tags: ['monster', 'player'], status: 'poison', duration: 5 },
      ],
    },
  },
  {
    id: 'grave_salt_pouch',
    name: 'Grave-Salt Pouch',
    unidentifiedName: 'Pouch of Coarse Grey Salt',
    category: 'consumable',
    tier: 4,
    minFloor: 35,
    weight: 300,
    bulk: 200,
    identified: false,
    description: 'A barrow-keeper’s pouch of blessed warding salt. Whatever it warded is long gone, but a merchant will pay for it.',
    value: 160,
  },

  // ==========================================
  // UTILITY & KNOWLEDGE (5)
  // ==========================================
  {
    id: 'grave_wax_candle',
    name: 'Grave-Wax Candle',
    unidentifiedName: 'Pale Tallow Candle',
    category: 'consumable',
    tier: 2,
    minFloor: 16,
    weight: 150,
    bulk: 100,
    identified: false,
    description: 'A corpse-fat candle from the barrows that burns with an eerie pale blue flame. It does nothing for the living, but a merchant will pay for a barrow-relic.',
    value: 95,
  },
  {
    id: 'mead_of_the_corpse_tongue',
    name: 'Mead of the Corpse-Tongue',
    unidentifiedName: 'Black Fermented Horn',
    category: 'consumable',
    tier: 2,
    minFloor: 17,
    weight: 350,
    bulk: 250,
    identified: false,
    description: 'A heady hallucinogenic brew: for a while your sight shrinks to arm’s reach, but you hear whatever moves around you.',
    value: 130,
    itemType: 'potion',
    potionConfig: {
      effects: [
        { type: 'apply_status', status: 'sensory_masked', duration: 10 },
      ],
    },
  },
  {
    id: 'duergar_lodestone',
    name: 'Duergar Lodestone',
    unidentifiedName: 'Magnetic Iron Pebble',
    category: 'consumable',
    tier: 3,
    minFloor: 22,
    weight: 200,
    bulk: 150,
    identified: false,
    description: 'A duergar lodestone, its attunement long faded. A merchant will still pay for the iron.',
    value: 110,
  },
  {
    id: 'wand_of_the_ironwood_bough',
    name: 'Wand of the Ironwood Bough',
    unidentifiedName: 'Gnarled Twig Wand',
    category: 'consumable',
    tier: 4,
    minFloor: 36,
    weight: 400,
    bulk: 250,
    identified: false,
    description: 'A petrified wand from the Ironwood boughs that shoots grasping tendrils of root, immobilizing a target in place.',
    value: 290,
    itemType: 'wand',
    // The grasping roots hold the target fast: Paralyze (3 turns, a ray of range 5).
    // `entangle` was never defined, so every zap burned a charge on "Unknown spell".
    wandConfig: {
      spellId: 'paralyze',
      charges: 6,
      maxCharges: 6,
    },
  },
];

