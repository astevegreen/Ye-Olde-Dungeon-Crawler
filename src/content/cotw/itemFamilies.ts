import type { ItemFamilyConfig } from '../../engine';

/**
 * The seven item families of Castle of the Winds (Q1 "A", ADR-0012): what each tier is
 * called, what it does, the floor it starts on, and how many of each a game offers
 * (Q20 + Q33 "B": 60 Positive, 45 Negative, 10 Chaotic a game; no curses before floor 3).
 * +N is a separate roll (`calculateEnchantmentLevel`), so a Blessed Broadsword +2 happens.
 *
 * `itemsPerGame` is the measured count of eligible items a full clear offers at the current
 * loot volume (`npm run balance`, 20 seeds, medium); tracker item 2.4 changes the volume and
 * re-measures it. Chaotic's eight Loki-touched effects and Hel-touched Unholy arrive in 2.3.
 */
export const COTW_ITEM_FAMILIES: ItemFamilyConfig = {
  categories: ['weapon', 'armor', 'shield', 'helmet', 'boots', 'gauntlets', 'bracers', 'cloak', 'amulet', 'ring'],
  itemsPerGame: 650,
  families: [
    {
      category: 'blessed',
      alignment: 'positive',
      perGame: 22,
      tiers: [
        {
          minFloor: 1,
          name: 'Blessed',
          prefix: 'Blessed',
          statDeltas: { attackBonus: 2 },
          meleeDamageMultiplier: 1.15,
          meleeDamageFlatBonus: 1,
          description: 'Consecrated steel: +15% melee damage and +1, +2 attack.',
        },
        {
          minFloor: 10,
          name: 'Sanctified',
          prefix: 'Sanctified',
          statDeltas: { attackBonus: 4, strengthBonus: 1 },
          meleeDamageMultiplier: 1.25,
          meleeDamageFlatBonus: 2,
          description: 'Righteous force: +25% melee damage and +2, +4 attack, +1 strength.',
        },
        {
          minFloor: 25,
          name: 'Celestial',
          prefix: 'Celestial',
          statDeltas: { attackBonus: 6, strengthBonus: 2 },
          meleeDamageMultiplier: 1.4,
          meleeDamageFlatBonus: 4,
          description: 'Divine might: +40% melee damage and +4, +6 attack, +2 strength.',
        },
      ],
    },
    {
      category: 'enchanted',
      alignment: 'positive',
      perGame: 22,
      tiers: [
        {
          minFloor: 1,
          name: 'Enchanted',
          prefix: 'Enchanted',
          spellDamageMultiplier: 1.2,
          manaCostDiscount: 2,
          description: 'Arcane conductivity: +20% spell damage, spells cost 2 less.',
        },
        {
          minFloor: 10,
          name: 'Arcane',
          prefix: 'Arcane',
          spellDamageMultiplier: 1.35,
          manaCostDiscount: 4,
          description: 'Potent mana resonance: +35% spell damage, spells cost 4 less.',
        },
        {
          minFloor: 25,
          name: "Archmage's",
          prefix: "Archmage's",
          spellDamageMultiplier: 1.5,
          manaCostDiscount: 6,
          description: 'Supreme mystic mastery: +50% spell damage, spells cost 6 less.',
        },
      ],
    },
    {
      category: 'holy',
      alignment: 'positive',
      perGame: 16,
      tiers: [
        {
          minFloor: 1,
          name: 'of the Templar',
          suffix: 'of the Templar',
          tagBonuses: [
            { tag: 'undead', multiplier: 1.3, flatBonus: 2 },
            { tag: 'demon', multiplier: 1.3, flatBonus: 2 },
          ],
          description: 'Radiant warding: +30% damage and +2 against the undead and demons.',
        },
        {
          minFloor: 10,
          name: 'of Dawn',
          suffix: 'of Dawn',
          tagBonuses: [
            { tag: 'undead', multiplier: 1.5, flatBonus: 4 },
            { tag: 'demon', multiplier: 1.5, flatBonus: 4 },
          ],
          description: 'Blazing sunlight: +50% damage and +4 against the undead and demons.',
        },
        {
          minFloor: 25,
          name: 'of Radiant Glory',
          suffix: 'of Radiant Glory',
          tagBonuses: [
            { tag: 'undead', multiplier: 1.8, flatBonus: 8 },
            { tag: 'demon', multiplier: 1.8, flatBonus: 8 },
          ],
          description: 'Archon radiance: +80% damage and +8 against the undead and demons.',
        },
      ],
    },
    {
      category: 'cursed',
      alignment: 'negative',
      perGame: 20,
      minFloor: 3,
      binds: true,
      tiers: [
        {
          minFloor: 1,
          name: 'Cursed',
          prefix: 'Cursed',
          statDeltas: { attackBonus: -2, defenseBonus: -1 },
          description: 'A foul binding: -2 attack, -1 defense, and it will not come off until cleansed.',
        },
        {
          minFloor: 15,
          name: 'Blighted',
          prefix: 'Blighted',
          statDeltas: { attackBonus: -4, defenseBonus: -3, speedBonus: -10 },
          description: 'A crippling binding: -4 attack, -3 defense, -10 speed, and it will not come off until cleansed.',
        },
      ],
    },
    {
      category: 'hexed',
      alignment: 'negative',
      perGame: 15,
      minFloor: 3,
      tiers: [
        {
          minFloor: 1,
          name: 'Hexed',
          prefix: 'Hexed',
          damageTakenMultiplier: 1.25,
          damageTakenFlatBonus: 2,
          description: 'A hex of vulnerability: the bearer takes +25% and +2 from every blow.',
        },
        {
          minFloor: 15,
          name: 'Doom-touched',
          prefix: 'Doom-touched',
          damageTakenMultiplier: 1.5,
          damageTakenFlatBonus: 4,
          description: 'A fatal vulnerability: the bearer takes +50% and +4 from every blow.',
        },
      ],
    },
    {
      category: 'unholy',
      alignment: 'negative',
      perGame: 10,
      minFloor: 3,
      tiers: [
        {
          minFloor: 1,
          name: 'Unholy',
          prefix: 'Unholy',
          tagBonuses: [
            { tag: 'clergy', multiplier: 1.4, flatBonus: 3, renownCategory: 'dark_renown', renownAmount: 1 },
            { tag: 'innocent', multiplier: 1.4, flatBonus: 3, renownCategory: 'dark_renown', renownAmount: 1 },
          ],
          consecratedGroundPenalty: { damagePenalty: 0.5, selfDamagePerAttack: 3 },
          description: 'Dark blasphemy: +40% damage against the righteous, and holy ground burns the bearer.',
        },
        {
          minFloor: 15,
          name: 'Profane',
          prefix: 'Profane',
          tagBonuses: [
            { tag: 'clergy', multiplier: 1.7, flatBonus: 6, renownCategory: 'dark_renown', renownAmount: 2 },
            { tag: 'innocent', multiplier: 1.7, flatBonus: 6, renownCategory: 'dark_renown', renownAmount: 2 },
          ],
          consecratedGroundPenalty: { damagePenalty: 0.7, selfDamagePerAttack: 6 },
          description: 'Dread sacrilege: +70% damage against the righteous, and holy ground burns the bearer badly.',
        },
      ],
    },
    {
      category: 'chaotic',
      alignment: 'chaotic',
      perGame: 10,
      tiers: [
        {
          minFloor: 1,
          name: 'Frenetic',
          prefix: 'Frenetic',
          statDeltas: { attackBonus: 5 },
          meleeDamageMultiplier: 1.35,
          chaoticProc: { procChance: 0.2, type: 'backlash', param: 4, description: 'Volatile recoil backlash' },
          description: 'Frantic power: +35% melee damage, +5 attack; one swing in five recoils for 4.',
        },
        {
          minFloor: 12,
          name: 'Warping',
          prefix: 'Warping',
          statDeltas: { speedBonus: 15 },
          meleeDamageMultiplier: 1.25,
          chaoticProc: { procChance: 0.15, type: 'teleport', param: 3, description: 'Erratic spatial jump' },
          description: 'Spatial instability: +25% melee damage, +15 speed; some swings fling the bearer up to 3 tiles.',
        },
        {
          minFloor: 25,
          name: 'Cataclysmic',
          prefix: 'Cataclysmic',
          statDeltas: { attackBonus: 8 },
          meleeDamageMultiplier: 1.6,
          chaoticProc: { procChance: 0.25, type: 'backlash', param: 8, description: 'Cataclysmic detonation backlash' },
          description: 'Unbridled havoc: +60% melee damage, +8 attack; one swing in four recoils for 8.',
        },
      ],
    },
  ],
};
