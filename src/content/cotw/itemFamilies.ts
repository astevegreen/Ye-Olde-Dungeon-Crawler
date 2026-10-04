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
      binds: true,
      tiers: [
        {
          minFloor: 1,
          name: 'Hexed',
          prefix: 'Hexed',
          damageTakenMultiplier: 1.25,
          damageTakenFlatBonus: 2,
          description: 'A hex of vulnerability: the bearer takes +25% and +2 from every blow, and it will not come off until cleansed.',
        },
        {
          minFloor: 15,
          name: 'Doom-touched',
          prefix: 'Doom-touched',
          damageTakenMultiplier: 1.5,
          damageTakenFlatBonus: 4,
          description: 'A fatal vulnerability: the bearer takes +50% and +4 from every blow, and it will not come off until cleansed.',
        },
      ],
    },
    {
      // Q23 + Q34: Hel-touched. Binds; the temple serves the bearer only to cleanse it, at
      // double the price; true holy ground (the temple, the gods' altars) burns the bearer.
      category: 'unholy',
      alignment: 'negative',
      perGame: 10,
      minFloor: 3,
      binds: true,
      tiers: [
        {
          minFloor: 1,
          name: 'Hel-touched',
          prefix: 'Hel-touched',
          tagBonuses: [{ tag: 'living', multiplier: 1.3, flatBonus: 0, healPercentOfDamage: 0.2 }],
          sacredGroundBurn: 5,
          templeShunned: true,
          description:
            "Hel's hunger: +30% damage against the living, and the bearer drinks a fifth of it; the undead are immune. It binds, holy ground burns the bearer for 5 a step, and the temple will only cleanse it, at double the price.",
        },
      ],
    },
    {
      // Q22 "Approved": eight Loki-touched rule-benders, none of which binds. All eight share
      // floor 1, so the roller picks one at random (variants, not depth tiers). Numbers are
      // the owner's; the balance report and the next soak measure them.
      category: 'chaotic',
      alignment: 'chaotic',
      perGame: 10,
      tiers: [
        {
          minFloor: 1,
          name: 'Wildfire',
          prefix: 'Wildfire',
          randomSpellElement: true,
          spellDamageMultiplier: 1.4,
          description: 'Wildfire: every damaging spell you cast takes a random element, at +40% power.',
        },
        {
          minFloor: 1,
          name: 'Bloodthirst',
          prefix: 'Bloodthirsty',
          killHealPercent: 0.15,
          forbidsRest: true,
          description: 'Bloodthirst: each kill heals 15% of your HP, and you cannot rest while it is worn.',
        },
        {
          minFloor: 1,
          name: 'Twinstrike',
          prefix: 'Twinstrike',
          extraMeleeStrikes: 1,
          missSelfDamage: 3,
          description: 'Twinstrike: every melee attack strikes twice; each blow that misses costs you 3 HP.',
        },
        {
          minFloor: 1,
          name: 'Glass Fury',
          suffix: 'of Glass Fury',
          meleeDamageMultiplier: 1.5,
          spellDamageMultiplier: 1.5,
          damageTakenMultiplier: 1.5,
          description: 'Glass Fury: +50% to all damage you deal, and +50% to all damage you take.',
        },
        {
          minFloor: 1,
          name: "Trickster's Step",
          suffix: "of the Trickster's Step",
          evasionBonus: 0.25,
          blinkEverySteps: 10,
          blinkRange: [2, 4],
          description: "Trickster's Step: a quarter of melee blows miss you, and every tenth step flings you 2–4 tiles.",
        },
        {
          minFloor: 1,
          name: 'Fickle Fortune',
          suffix: 'of Fickle Fortune',
          meleeDamageRoll: [0, 2.5],
          description: 'Fickle Fortune: each melee blow you land does anywhere from a scratch to two and a half times its damage.',
        },
        {
          minFloor: 1,
          name: 'Void-Kissed',
          prefix: 'Void-Kissed',
          overflowNoDebt: true,
          overflowTierShift: 1,
          description: 'Void-Kissed: casting past your mana leaves no debt, but every surge comes a tier worse.',
        },
        {
          minFloor: 1,
          name: 'Mirror Hide',
          suffix: 'of the Mirror Hide',
          reflectMeleePercent: 0.25,
          healingReceivedMultiplier: 0.5,
          description: 'Mirror Hide: a quarter of every melee blow you take is turned back on the attacker, and all healing on you is halved.',
        },
      ],
    },
  ],
};
