import type { ChoiceDefinition, FixedTilePlacement, LoreEntryDefinition, TileDefinition } from '../../engine';

/**
 * Six Skaldic Runestones distributed across the descent (floors 8, 14, 20, 28, 38, 48).
 * Each runestone delivers an episodic chapter of the campaign saga, coupled with an
 * explicit RUNIC SPELL HINT detailing kill rites, hybrid elemental fusions at Odin's
 * Gallows-Stone, and grimoire glyph strategies.
 */

export const SKALDIC_RUNESTONE_TILES: TileDefinition[] = [
  {
    type: 'skaldic_runestone_1',
    name: 'Skaldic Runestone: Lay of the Frost King',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'ᚱ',
    visual: 'altar',
    description: 'An ancient permafrost runestone inscribed with Elder Futhark runes of King Thrym and the secrets of frost magic.',
    interactionHandlerId: 'skaldic_runestone_1',
    landmarkLabel: 'Runestone: Frost King ᚱ',
  },
  {
    type: 'skaldic_runestone_2',
    name: 'Skaldic Runestone: The Smithy’s Accord',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'ᚱ',
    visual: 'altar',
    description: 'A soot-blackened duergar stele detailing the ancient giant-dwarven alliance and the fusion of fire and cold.',
    interactionHandlerId: 'skaldic_runestone_2',
    landmarkLabel: 'Runestone: Deep Smithy ᚱ',
  },
  {
    type: 'skaldic_runestone_3',
    name: 'Skaldic Runestone: Lay of the Stolen Dawn',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'ᚱ',
    visual: 'altar',
    description: 'A glowing obsidian slab recording how Sól’s sun-chariot was snared, and the secret of Surtr’s rebounding thunder-flame.',
    interactionHandlerId: 'skaldic_runestone_3',
    landmarkLabel: 'Runestone: Stolen Dawn ᚱ',
  },
  {
    type: 'skaldic_runestone_4',
    name: 'Skaldic Runestone: The Scorched Root’s Lament',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'ᚱ',
    visual: 'altar',
    description: 'A silver-veined monument weeping mercury, warning how forge heat woke Níðhögg, and imparting the Rime Shard formula.',
    interactionHandlerId: 'skaldic_runestone_4',
    landmarkLabel: 'Runestone: Weeping Roots ᚱ',
  },
  {
    type: 'skaldic_runestone_5',
    name: 'Skaldic Runestone: The Threads of Urðr',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'ᚱ',
    visual: 'altar',
    description: 'A living world-bark pillar carved with glowing threads of fate, revealing the Hagalaz Hail tempest rite.',
    interactionHandlerId: 'skaldic_runestone_5',
    landmarkLabel: 'Runestone: The Norns ᚱ',
  },
  {
    type: 'skaldic_runestone_6',
    name: 'Skaldic Runestone: The Twilight Prophecy',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'ᚱ',
    visual: 'altar',
    description: 'The final abyssal runestone above Náströnd, prophesying the duel at the Heartwood and teaching the Thunder Maul.',
    interactionHandlerId: 'skaldic_runestone_6',
    landmarkLabel: 'Runestone: Twilight Doom ᚱ',
  },
];

/**
 * What each runestone teaches, kept in the hero's Story (manifest.loreEntries, Carved Verses)
 * once its flag is set, and announced in the log when the stone is read.
 */
export const SKALDIC_RUNESTONE_LORE: LoreEntryDefinition[] = [
  {
    flag: 'skaldic_runestone_1_resolved',
    title: 'Lay of the Frost King',
    verse: 'When the Aesir stole the Hammer, King Thrym’s frost turned to brittle stone.\nYet in his children’s veins, the winter never died—it waited.\nWoe to the crawler who walks the rime without respect for the cold!',
    lore: 'Brim-Howlers felled by pure rune-force yield the Slow galdr, while a Winter Hag melted with flame yields Cold Ray. In your grimoire, the Isa glyph (from cold essence) causes all damaging spells to slow their targets!',
  },
  {
    flag: 'skaldic_runestone_2_resolved',
    title: 'The Smithy’s Accord',
    verse: 'Here the sons of Ivaldi and the smiths of Jötunheim struck the treaty of steel.\nWhere fire meets ice, neither destroys the other—they fuse into scalding mist.\nThe Hanged God taught us: give what is dear at his Gallows-Stone, and a greater craft is born.',
    lore: 'At Odin’s Gallows-Stone, offering Cold to Firebolt (or Fire to Cold Ray) reforges the spell into "Steam Lance"—dealing 10 fire and 10 cold damage to pierce single-element resistance!',
  },
  {
    flag: 'skaldic_runestone_3_resolved',
    title: 'Lay of the Stolen Dawn',
    verse: 'In the high sky, Sól’s horses galloped, until iron nets dragged the golden chariot low.\nThe coven built the Siphon to harness the sun’s blinding wrath,\nheedless that the fires below would burn through the deep roots of the world.',
    lore: 'At Odin’s Gallows-Stone, offering Lightning to Fire (or Fire to Lightning Bolt) fuses into "Surtr’s Brand"—a thunderbolt wreathed in fire that rebounds off stone walls for 12 lightning and 8 fire damage!',
  },
  {
    flag: 'skaldic_runestone_4_resolved',
    title: 'The Scorched Root’s Lament',
    verse: 'Hear, traveler of the silver lode: the sun-chariot’s fire has done its work.\nThe permafrost wards that held the Root-Gnawer in torpor have boiled away.\nNíðhögg has awakened. Its jaws drip necrotic venom into Yggdrasil’s taproot.\nReclaiming the Hearth-Tear was only the prelude—the dying World Tree calls below!',
    lore: 'At Odin’s Gallows-Stone, offering Arcane to Cold (or Cold to Arcane) creates "Rime Shard"—inflicting 6 arcane and 8 cold damage while slowing the target for 3 turns!',
  },
  {
    flag: 'skaldic_runestone_5_resolved',
    title: 'The Threads of Urðr',
    verse: 'Urðr sees what was, Verðandi what is, and Skuld what must be.\nThey whisper: the blood of Thrym was not made to serve the Aesir nor the Wyrm.\nIt was made to stand between them when the world-pillars crack.\nUnfurl the tempest of hail before entering the dragon’s lair!',
    lore: 'At Odin’s Gallows-Stone, fusing Cold and Lightning creates "Hagalaz Hail"—a devastating 3x3 blizzard tempest dealing 10 cold and 8 lightning damage and stunning targets for 1 turn!',
  },
  {
    flag: 'skaldic_runestone_6_resolved',
    title: 'The Twilight Prophecy',
    verse: 'Beyond lies the Heartwood on Floor 50, where Níðhögg uncoils upon the shredded World Root.\nHe who slays the dragon with blind fury shall split the dying root and usher in Ragnarök.\nOnly the warrior who masters both wrath and restraint may preserve Midgard.\nArm yourself with the Thunderer’s wrath for the battle of your saga!',
    lore: 'At Odin’s Gallows-Stone, fusing Lightning and Physical power creates "Thunder Maul"—striking with the force of Thor for 14 lightning and 8 physical damage with guaranteed stun!',
  },
];

const runicHint = (n: number): string => `✦ RUNIC SPELL HINT: ${SKALDIC_RUNESTONE_LORE[n - 1].lore} ✦`;

export const SKALDIC_RUNESTONE_CHOICES: Record<string, ChoiceDefinition> = {
  skaldic_runestone_1: {
    id: 'skaldic_runestone_1',
    title: 'Skaldic Runestone: Lay of the Frost King',
    description:
      'Elder Futhark runes are chipped into the permafrost monolith:\n\n“When the Aesir stole the Hammer, King Thrym’s frost turned to brittle stone.\nYet in his children’s veins, the winter never died—it waited.\nWoe to the crawler who walks the rime without respect for the cold!”\n\nBeneath the poem, runic diagrams reveal how beast-spirits yield galdr.',
    options: [
      {
        id: 'commune_frost',
        label: 'Commune with the Frost Runes',
        description:
          'Absorb ancestral fortitude. Permanently increases base Defense by +1, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_1_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(1),
          },
        ],
      },
      {
        id: 'study_frost',
        label: 'Transcribe the Skald’s Verse',
        description:
          'Study the inscription carefully. Earns +10 Exploration Renown, grants a Scroll of Identify, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_1_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'grantItem', itemId: 'scroll_identify', toInventory: true },
          {
            type: 'logMessage',
            message:
              runicHint(1),
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'skaldic_runestone_1_resolved',
        message: 'The Runestone of the Frost King hums softly. Its skaldic verse and runic secrets have been committed to memory.',
      },
    ],
  },

  skaldic_runestone_2: {
    id: 'skaldic_runestone_2',
    title: 'Skaldic Runestone: The Smithy’s Accord',
    description:
      'Duergar chisel-marks score the blackened iron slab:\n\n“Here the sons of Ivaldi and the smiths of Jötunheim struck the treaty of steel.\nWhere fire meets ice, neither destroys the other—they fuse into scalding mist.\nThe Hanged God taught us: give what is dear at his Gallows-Stone, and a greater craft is born.”\n\nRunic diagrams illustrate elemental fusion at Odin’s Gallows-Stone.',
    options: [
      {
        id: 'absorb_forge',
        label: 'Absorb the Forge Galdr',
        description:
          'Channel the forge’s martial discipline. Permanently increases base Attack by +1, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_2_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(2),
          },
        ],
      },
      {
        id: 'sharpen_forge',
        label: 'Hone Weapons with Smithing Lore',
        description:
          'Apply duergar whetting techniques. Earns +10 Exploration Renown, grants a Bog-Iron Whetstone, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_2_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'grantItem', itemId: 'bog_iron_whetstone', toInventory: true },
          {
            type: 'logMessage',
            message:
              runicHint(2),
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'skaldic_runestone_2_resolved',
        message: 'The Runestone of the Deep Smithy stands silent. The secrets of Steam Lance remain engraved in your mind.',
      },
    ],
  },

  skaldic_runestone_3: {
    id: 'skaldic_runestone_3',
    title: 'Skaldic Runestone: Lay of the Stolen Dawn',
    description:
      'Obsidian glass mirrors reflect heat-ripples around this volcanic stele:\n\n“In the high sky, Sól’s horses galloped, until iron nets dragged the golden chariot low.\nThe coven built the Siphon to harness the sun’s blinding wrath,\nheedless that the fires below would burn through the deep roots of the world.”\n\nBlazing runes outline the tempestuous thunder-fire galdr.',
    options: [
      {
        id: 'solar_haste',
        label: 'Attune to the Solar Conduit',
        description:
          'Invigorate your stride with radiant chariot heat. Grants divine Haste for 35 turns, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_3_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'applyBuff', statusType: 'haste', duration: 35 },
          {
            type: 'logMessage',
            message:
              runicHint(3),
          },
        ],
      },
      {
        id: 'solar_vigor',
        label: 'Draw Upon the Hearth Embers',
        description:
          'Siphon ambient heat into permanent striking might. Permanently increases base Attack by +1, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_3_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(3),
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'skaldic_runestone_3_resolved',
        message: 'The Runestone of the Stolen Dawn cools to a gentle hum. The formula of Surtr’s Brand is inscribed in your memory.',
      },
    ],
  },

  skaldic_runestone_4: {
    id: 'skaldic_runestone_4',
    title: 'Skaldic Runestone: The Scorched Root’s Lament',
    description:
      'Tarnished silver veining wraps around a cracked stele weeping pungent mercury:\n\n“Hear, traveler of the silver lode: the sun-chariot’s fire has done its work.\nThe permafrost wards that held the Root-Gnawer in torpor have boiled away.\nNíðhögg has awakened. Its jaws drip necrotic venom into Yggdrasil’s taproot.\nReclaiming the Hearth-Tear was only the prelude—the dying World Tree calls below!”\n\nSilvered runes spell out warding frost-arcana.',
    options: [
      {
        id: 'ward_root',
        label: 'Fortify Your Flesh with Root Wards',
        description:
          'Absorb the resilience of petrified wood. Permanently increases base Defense by +1, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_4_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(4),
          },
        ],
      },
      {
        id: 'elixir_root',
        label: 'Harvest the Condensed Sap Draught',
        description:
          'Collect an invigorating elixir of warm broth and root sap. Grants a Hearth-Broth Flask, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_4_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'grantItem', itemId: 'hearth_broth_flask', toInventory: true },
          {
            type: 'logMessage',
            message:
              runicHint(4),
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'skaldic_runestone_4_resolved',
        message: 'The Runestone of the Weeping Roots drips silent sap. The secret of Rime Shard is firmly etched in your mind.',
      },
    ],
  },

  skaldic_runestone_5: {
    id: 'skaldic_runestone_5',
    title: 'Skaldic Runestone: The Threads of Urðr',
    description:
      'Living world-bark covers this monolith, save for three glowing runic threads:\n\n“Urðr sees what was, Verðandi what is, and Skuld what must be.\nThey whisper: the blood of Thrym was not made to serve the Aesir nor the Wyrm.\nIt was made to stand between them when the world-pillars crack.\nUnfurl the tempest of hail before entering the dragon’s lair!”\n\nLightning-frost runes crackle across the bark.',
    options: [
      {
        id: 'tempest_strike',
        label: 'Grasp the Storm’s Fury',
        description:
          'Channel the wrath of the heavens. Permanently increases base Attack by +1, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_5_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(5),
          },
        ],
      },
      {
        id: 'taproot_ward',
        label: 'Anchor to the World-Bark',
        description:
          'Root your spirit to withstand the abyssal corruption. Permanently increases base Defense by +1, earns +10 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_5_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(5),
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'skaldic_runestone_5_resolved',
        message: 'The Runestone of the Norns pulses with cosmic harmony. The formula of Hagalaz Hail is recorded in your journal.',
      },
    ],
  },

  skaldic_runestone_6: {
    id: 'skaldic_runestone_6',
    title: 'Skaldic Runestone: The Twilight Prophecy',
    description:
      'Perched above the yawning black chasm of Náströnd, the final runestone glares with ominous violet light:\n\n“Beyond lies the Heartwood on Floor 50, where Níðhögg uncoils upon the shredded World Root.\nHe who slays the dragon with blind fury shall split the dying root and usher in Ragnarök.\nOnly the warrior who masters both wrath and restraint may preserve Midgard.\nArm yourself with the Thunderer’s wrath for the battle of your saga!”\n\nViolent lightning runes spark with primordial kinetic thunder.',
    options: [
      {
        id: 'thunder_maul',
        label: 'Embrace the Thunder Maul',
        description:
          'Claim the Thunderer’s crushing strike. Permanently increases base Attack by +1 and base Defense by +1, earns +15 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_6_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 15 },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 1 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 1 },
          {
            type: 'logMessage',
            message:
              runicHint(6),
          },
        ],
      },
      {
        id: 'champion_resolve',
        label: 'Steel Your Soul for the Heartwood',
        description:
          'Channel celestial swiftness for the final confrontation. Grants divine Haste for 50 turns, earns +15 Exploration Renown, and commits the Runic Spell Hint to memory.',
        consequences: [
          { type: 'setFlag', flag: 'skaldic_runestone_6_resolved', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 15 },
          { type: 'applyBuff', statusType: 'haste', duration: 50 },
          {
            type: 'logMessage',
            message:
              runicHint(6),
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'skaldic_runestone_6_resolved',
        message: 'The Runestone of the Twilight Doom shines steadily against the dark. The final lesson of Thunder Maul is mastered.',
      },
    ],
  },
};

export const SKALDIC_RUNESTONE_PLACEMENTS: FixedTilePlacement[] = [
  { floor: 8, tileId: 'skaldic_runestone_1', placement: 'middle_room_center', requiresChoiceId: 'skaldic_runestone_1' },
  { floor: 14, tileId: 'skaldic_runestone_2', placement: 'middle_room_center', requiresChoiceId: 'skaldic_runestone_2' },
  { floor: 20, tileId: 'skaldic_runestone_3', placement: 'middle_room_center', requiresChoiceId: 'skaldic_runestone_3' },
  { floor: 28, tileId: 'skaldic_runestone_4', placement: 'middle_room_center', requiresChoiceId: 'skaldic_runestone_4' },
  { floor: 38, tileId: 'skaldic_runestone_5', placement: 'middle_room_center', requiresChoiceId: 'skaldic_runestone_5' },
  { floor: 48, tileId: 'skaldic_runestone_6', placement: 'middle_room_center', requiresChoiceId: 'skaldic_runestone_6' },
];
