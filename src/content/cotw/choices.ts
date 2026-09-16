import type { ChoiceDefinition } from '../../engine';

export const COTW_CHOICES: Record<string, ChoiceDefinition> = {
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
  },
};
