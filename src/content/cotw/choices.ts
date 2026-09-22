import type { ChoiceDefinition } from '../../engine';
import { BLOOD_ALTAR_CHOICE } from './hostageRitual';

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

  altar_tyr: {
    id: 'altar_tyr',
    title: 'Ancient Altar of Tyr',
    description:
      'You stand before a weather-worn stone altar dedicated to Tyr, god of justice and martial honor. Crude dried blood and foul desecration crust over the sacred runes. You sense potent divine currents waiting to be swayed.',
    options: [
      {
        id: 'purify',
        label: 'Purify the Altar with Sacred Waters',
        description:
          'Cleanse the defilement with holy ritual. Grants divine haste and +10 Temple of Thor standing.',
        consequences: [
          { type: 'setFlag', flag: 'tyr_purified', value: true },
          { type: 'modifyFaction', faction: 'temple_standing', delta: 10 },
          { type: 'applyBuff', statusType: 'haste', duration: 30 },
          {
            type: 'logMessage',
            message:
              '✦ A golden light blazes across the altar! Tyr’s righteous favor fills your spirit (+10 Temple Standing, Haste)! ✦',
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
        message: 'The purified Altar of Tyr radiates peace. The runes remain holy and silent.',
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
      'Your muscles surge with the brute vigor of Hrungnir’s kin. Stone breaks beneath your grip. Will you pour this colossal might into shattering offenses, or turn your frame into an impenetrable fortress?',
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
};

