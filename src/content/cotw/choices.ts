import type { ChoiceDefinition } from '../../engine';

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
};
