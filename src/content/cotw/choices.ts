import type { ChoiceDefinition } from '../../engine';
import { BLOOD_ALTAR_CHOICE } from './hostageRitual';
import { SKALDIC_RUNESTONE_CHOICES } from './runestones';
import { VIDNIR_REVELATION_CHOICE } from './narrative';
import { IRON_CLANS_BARROW_CHOICES, IVALDA_CHOICE, IVALDA_TOWN_CHOICE } from './ironClans';

export const COTW_CHOICES: Record<string, ChoiceDefinition> = {
  /**
   * The Oath's climax (ARCHITECTURE.md §3, `oath.ts`): triggered when enough
   * troll-wife warlocks have fallen, not by finding a specific tile — see
   * `oath.ts`'s `OATH_HOOK` for why. `cancelable: false` because the moment this
   * fires, the matriarch's offer and the village's fate are already in motion; there
   * is no "ask me later" — hesitating is what the `oath_climax` timed event's
   * `expireConsequences` model, and this choice pre-empts that timer entirely by
   * firing before it can expire.
   */
  oath_hearth: {
    id: 'oath_hearth',
    title: "The Matriarch's Blood-Oath",
    description:
      "Amid the ruin of fallen warlocks, an ancient troll-wife matriarch rises from the shadows of the forge. “Your blood runs with Thrym's own,” she rasps, “as does mine, once. I can sever the siphon binding your village — but the choice of how will cost you something lasting. Hot, and you strike harder, your own flesh straining against everything you are. Cold, and you stand firm, as your blood always has.” The forge groans. There is no third door.",
    options: [
      {
        id: 'honor',
        label: 'Honor the Oath — Embrace the Cold',
        description:
          'Stand with your nature. Permanently -2 Attack, +3 Defense. Bonds you with a Frost-Ward Hound.',
        consequences: [
          { type: 'setFlag', flag: 'blood_oath', value: true },
          { type: 'setFlag', flag: 'blood_oath_honored', value: true },
          { type: 'setFlag', flag: 'oath_resolved', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: -2 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 3 },
          { type: 'grantCompanion', companionId: 'hearth_frost_hound' },
          {
            type: 'logMessage',
            message:
              '❄ You grip the matriarch’s frost-rimed hand. The siphon shatters like winter glass — the cold in you deepens, steady and sure. A Frost-Ward Hound pads to your side. ❄',
          },
        ],
      },
      {
        id: 'break',
        label: 'Break the Oath — Embrace the Fire',
        description:
          'Fight your own blood. Permanently +3 Attack, -2 Defense. Bonds you with an Ember-Fang Wolf.',
        consequences: [
          { type: 'setFlag', flag: 'blood_oath', value: true },
          { type: 'setFlag', flag: 'blood_oath_broken', value: true },
          { type: 'setFlag', flag: 'oath_resolved', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 3 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: -2 },
          { type: 'grantCompanion', companionId: 'ember_fang_wolf' },
          {
            type: 'logMessage',
            message:
              '\u{1f525} You seize the stolen chariot-fire instead of her hand. It burns — your own giant-blood curdling against the heat — but the siphon breaks all the same. An Ember-Fang Wolf answers the flame. \u{1f525}',
          },
        ],
      },
    ],
    cancelable: false,
  },

  /**
   * Floor 3's defiled altar (`fixedTilePlacements`). Every option settles it for good.
   * The "Altar of Tyr Cleansed" milestone (`tyr_purified`) asks what Tyr gave, a
   * measure of the sword hand, so the oath costs Attack for its Defense and standing;
   * washing is the safe, lesser rite, and leaves the runes dark.
   */
  altar_tyr: {
    id: 'altar_tyr',
    title: 'The Defiled Altar of Tyr',
    description:
      'A weather-worn altar to Tyr, god of oaths and justice. Its carving shows him with his hand in the wolf Fenrir’s jaws: the hand he gave so the gods could bind the wolf. Someone has fouled it with dried blood and gnawed wolf bones, and the runes beneath are dark. Water would lift the filth. Only an oath, sealed with something of your own, will wake the runes.',
    options: [
      {
        id: 'purify',
        label: 'Swear an Oath on Your Sword Hand',
        description:
          'Lay your sword hand on the stone and give Tyr what he gave: a measure of its strength. Cleanses the altar. Permanently -1 Attack and +2 Defense, +15 Temple standing, and haste.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_purified', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: -1 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 2 },
          { type: 'modifyFaction', faction: 'temple_standing', delta: 15 },
          { type: 'applyBuff', statusType: 'haste', duration: 30 },
          {
            type: 'logMessage',
            message:
              '✦ You swear on your sword hand, and the stone drinks a measure of its strength. The runes wake gold and burn the defilement away. Tyr holds your oath (-1 Attack, +2 Defense, +15 Temple standing, Haste). ✦',
          },
        ],
      },
      {
        id: 'wash',
        label: 'Wash the Stone with Water',
        description: 'Scrub away the blood and bones and swear nothing. The runes stay dark for good, but the Temple will hear of it. +5 Temple standing.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_washed', value: true },
          { type: 'modifyFaction', faction: 'temple_standing', delta: 5 },
          {
            type: 'logMessage',
            message:
              'You scrub the altar clean of blood and bones. The runes stay dark: water was never what Tyr asked for (+5 Temple standing).',
          },
        ],
      },
      {
        id: 'desecrate',
        label: 'Desecrate the Altar for Dark Relics',
        description:
          'Shatter the sacred seals to seize the sacrifice dagger. Inflicts 5 backlash damage, -10 Temple standing, and alerts crypt undead.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_desecrated', value: true },
          { type: 'modifyFaction', faction: 'temple_standing', delta: -10 },
          { type: 'grantItem', itemId: 'dagger', toInventory: true },
          { type: 'damagePlayer', amount: 5 },
          { type: 'alertMonsters', radius: 14 },
          {
            type: 'logMessage',
            message:
              '☠ You smash Tyr’s sacred runes! Arcane backlash wounds you (-5 HP), a dagger is wrenched free, and an unholy wail alerts the crypts (-10 Temple Standing)! ☠',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave Untouched for Now',
    resolvedStates: [
      {
        flag: 'tyr_purified',
        message: 'The cleansed Altar of Tyr glows faintly gold. Your oath is kept here.',
      },
      {
        flag: 'tyr_washed',
        message: 'The washed Altar of Tyr is clean, but its runes stay dark.',
      },
      {
        flag: 'tyr_desecrated',
        message: 'The shattered Altar of Tyr lies cold and ruined. Its power is spent.',
      },
    ],
  },

  milestone_dex_15: {
    id: 'milestone_dex_15',
    title: 'Dexterity Milestone: Mastery of the Swift Wind',
    description:
      'Your hands move with uncanny swiftness and your step makes no sound upon the frost. The spirits of the hunt take note of your nimble blood. Will you hone your reflexes into lethal precision, or elusive evasion?',
    options: [
      {
        id: 'precision',
        label: 'Precision Strikes (+2 Attack)',
        description: 'Permanently increases base attack by +2.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_dex_15_precision', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 2 },
          {
            type: 'logMessage',
            message: '✦ Your strikes pierce through the smallest gaps in enemy armor! Permanently +2 Attack. ✦',
          },
        ],
      },
      {
        id: 'evasion',
        label: 'Evasive Grace (+2 Defense)',
        description: 'Permanently increases base defense by +2.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_dex_15_evasion', value: true },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 2 },
          {
            type: 'logMessage',
            message: '✦ You dance aside incoming blows like falling snow on the wind! Permanently +2 Defense. ✦',
          },
        ],
      },
    ],
    cancelable: false,
  },

  milestone_str_15: {
    id: 'milestone_str_15',
    title: 'Strength Milestone: Might of the Mountain Giant',
    description:
      'Your muscles surge with the brute vigor of the hill giants. Stone breaks beneath your grip. Will you pour this colossal might into shattering offenses, or turn your frame into an impenetrable fortress?',
    options: [
      {
        id: 'raw_power',
        label: 'Crushing Might (+3 Attack)',
        description: 'Permanently increases base attack by +3.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_str_15_power', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 3 },
          {
            type: 'logMessage',
            message: '⚒ Your ferocious blow shakes the bedrock! Permanently +3 Attack. ⚒',
          },
        ],
      },
      {
        id: 'iron_bulwark',
        label: 'Iron Bulwark (+3 Defense)',
        description: 'Permanently increases base defense by +3.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_str_15_bulwark', value: true },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 3 },
          {
            type: 'logMessage',
            message: '🛡 You brace like a monolith of granite! Permanently +3 Defense. 🛡',
          },
        ],
      },
    ],
    cancelable: false,
  },

  milestone_con_15: {
    id: 'milestone_con_15',
    title: 'Constitution Milestone: Vigor of the Ancient Oak',
    description:
      'The bitter cold of the deep north cannot chill your veins. Your flesh is hard as bog iron and your heart beats with unyielding endurance. Will you temper yourself for total resilience, or hardened vigor?',
    options: [
      {
        id: 'stone_resilience',
        label: 'Stone Resilience (+3 Defense)',
        description: 'Permanently increases base defense by +3.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_con_15_resilience', value: true },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 3 },
          {
            type: 'logMessage',
            message: '🛡 Your hide turns aside blades and claws alike! Permanently +3 Defense. 🛡',
          },
        ],
      },
      {
        id: 'battle_hardened',
        label: 'Battle-Hardened Vigor (+2 Attack, +1 Defense)',
        description: 'Permanently increases base attack by +2 and base defense by +1.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_con_15_hardened', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 2 },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 1 },
          {
            type: 'logMessage',
            message: '⚔ Pain only stokes your relentless momentum! Permanently +2 Attack and +1 Defense. ⚔',
          },
        ],
      },
    ],
    cancelable: false,
  },

  milestone_int_15: {
    id: 'milestone_int_15',
    title: 'Intelligence Milestone: Runic Illumination',
    description:
      'The whispered wisdom of Mimir and the secrets of the Elder Futhark burn into your consciousness. Will you etch runes of devastating potency, or weave ethereal wards of warding spirit?',
    options: [
      {
        id: 'runic_strike',
        label: 'Runic Destruction (+3 Attack)',
        description: 'Permanently increases base attack by +3.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_int_15_destruction', value: true },
          { type: 'modifyPermanentStat', stat: 'attack', delta: 3 },
          {
            type: 'logMessage',
            message: '⚡ Eldritch runes flare bright upon your weapons! Permanently +3 Attack. ⚡',
          },
        ],
      },
      {
        id: 'warded_spirit',
        label: 'Warded Spirit (+3 Defense)',
        description: 'Permanently increases base defense by +3.',
        consequences: [
          { type: 'setFlag', flag: 'milestone_int_15_ward', value: true },
          { type: 'modifyPermanentStat', stat: 'defense', delta: 3 },
          {
            type: 'logMessage',
            message: '✨ Glowing runes deflect incoming sorcery and blades! Permanently +3 Defense. ✨',
          },
        ],
      },
    ],
    cancelable: false,
  },
  blood_altar_ritual: BLOOD_ALTAR_CHOICE,
  vidnir_revelation: VIDNIR_REVELATION_CHOICE,
  ...SKALDIC_RUNESTONE_CHOICES,
  ...IRON_CLANS_BARROW_CHOICES,
  [IVALDA_CHOICE.id]: IVALDA_CHOICE,
  [IVALDA_TOWN_CHOICE.id]: IVALDA_TOWN_CHOICE,

  choice_dwarven_hearth: {
    id: 'choice_dwarven_hearth',
    title: 'The Dwarven Hearth',
    description:
      'An ancient iron-banded stone hearth glows with banked embers in this quiet mountain hollow. The roar of the waterfall outside is muted to a steady, rhythmic rush. A kettle sits beside a tin of dried herbs, and soot-carved inscriptions cover the stones.',
    options: [
      {
        id: 'warmth',
        label: 'Rest by the Coals',
        description:
          'Warm your hands over the embers and listen to the water. Grants a moment of deep peace and adds +10 Exploration Renown.',
        consequences: [
          { type: 'setFlag', flag: 'dwarven_hearth_rested', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          {
            type: 'logMessage',
            message:
              '♨ You sit by the steady embers, letting the warmth soak into cold bones. The oppressive weight of the abandoned works recedes.',
          },
        ],
      },
      {
        id: 'read_notes',
        label: 'Read the Wayfarer’s Scratched Notes',
        description: 'Examine the runes carved into the mantle by previous travelers.',
        consequences: [
          { type: 'setFlag', flag: 'dwarven_hearth_notes_read', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 5 },
          {
            type: 'logMessage',
            message:
              '✦ WAYFARER’S RUNES: “Beyond the works, where the rock turns black as glass, fire and cold war continuously. Do not cast frost upon the magma hounds; strike them with blunt iron instead, or let the steam drown their fires.” ✦',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Step Away from the Hearth',
    resolvedStates: [
      {
        flag: 'dwarven_hearth_rested',
        message: 'The banked coals of the Dwarven Hearth still glow with tranquil warmth.',
      },
    ],
  },

  choice_dwarven_spring: {
    id: 'choice_dwarven_spring',
    title: 'Thermal Mountain Spring',
    description:
      'Steam rises softly from a basin of crystal-clear mineral water. The rock beneath your feet is smooth and warm.',
    options: [
      {
        id: 'sip',
        label: 'Drink the Mineral Water',
        description: 'Take a long draught of pure mountain water and let the quiet settle over you.',
        consequences: [
          { type: 'setFlag', flag: 'dwarven_spring_drank', value: true },
          {
            type: 'logMessage',
            message:
              '💧 The water tastes of sweet rain and deep mountain stone. A refreshing calm settles over your senses.',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Spring Untouched',
    resolvedStates: [
      {
        flag: 'dwarven_spring_drank',
        message: 'The thermal spring bubbles peacefully in its stone basin.',
      },
    ],
  },

  choice_world_bark_hearth: {
    id: 'choice_world_bark_hearth',
    title: 'The Amber Root Fire',
    description:
      'Deep within a hollow knot of Yggdrasil, a low fire of fragrant peat and golden pine resin crackles quietly. Polished root talismans sway overhead in the gentle breath of the tree.',
    options: [
      {
        id: 'meditate',
        label: 'Meditate in the Heartwood Warmth',
        description:
          'Close your eyes and breathe the sweet resin smoke. Dispels blindness and confusion, and adds +10 Exploration Renown.',
        consequences: [
          { type: 'setFlag', flag: 'world_bark_hearth_rested', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 10 },
          {
            type: 'logMessage',
            message:
              '🌳 The sweet resin incense steadies your breath. You feel the slow, colossal pulse of the World Tree under your feet, ancient and enduring.',
          },
        ],
      },
      {
        id: 'listen_chimes',
        label: 'Listen to the Swaying Talismans',
        description: 'Interpret the rhythmic clicks of the carved alder charms.',
        consequences: [
          { type: 'setFlag', flag: 'world_bark_chimes_listened', value: true },
          { type: 'modifyCounter', counter: 'renown:exploration', delta: 5 },
          {
            type: 'logMessage',
            message:
              '✦ SONG OF THE ROOTS: “Where the Maw begins, the ancient wyrms sleep lightly. If you do not disturb their hoard, they will often let a quiet traveler pass without rising to strike.” ✦',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Hollow Quiet',
    resolvedStates: [
      {
        flag: 'world_bark_hearth_rested',
        message: 'The amber peat fire burns with quiet, fragrant dignity.',
      },
    ],
  },

  choice_world_bark_font: {
    id: 'choice_world_bark_font',
    title: 'Living Sap Font',
    description:
      'A natural cup in the living wood catches slow, golden drops of pure uncorrupted Yggdrasil sap.',
    options: [
      {
        id: 'taste',
        label: 'Taste the Pure Sap',
        description: 'Take a single drop of golden sap. It hums with vital harmony.',
        consequences: [
          { type: 'setFlag', flag: 'world_bark_sap_tasted', value: true },
          {
            type: 'logMessage',
            message:
              '✨ A taste like wild clover honey and sunlit leaves. The creeping dread of the abyss fades from your heart.',
          },
        ],
      },
    ],
    cancelable: true,
    cancelLabel: 'Leave the Font',
    resolvedStates: [
      {
        flag: 'world_bark_sap_tasted',
        message: 'The pure sap font gathers golden drops in rhythmic silence.',
      },
    ],
  },
};

