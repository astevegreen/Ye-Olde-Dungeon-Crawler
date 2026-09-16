import type { Item, ItemCategory } from './item';
import type { ItemModifier, ModifierCategory } from './modifiers';

export interface ModifierTemplate extends Omit<ItemModifier, 'id'> {
  minFloor?: number;
  tier: number;
  allowedCategories?: ItemCategory[];
}

export const MODIFIER_TEMPLATES: Record<ModifierCategory, ModifierTemplate[]> = {
  blessed: [
    {
      tier: 1,
      minFloor: 1,
      name: 'Blessed',
      alignment: 'positive',
      category: 'blessed',
      prefix: 'Blessed',
      statDeltas: { attackBonus: 2 },
      meleeDamageMultiplier: 1.15,
      meleeDamageFlatBonus: 1,
      description: 'Consecrated physical empowerment (+15% melee damage, +1 flat, +2 ATK).',
    },
    {
      tier: 2,
      minFloor: 10,
      name: 'Sanctified',
      alignment: 'positive',
      category: 'blessed',
      prefix: 'Sanctified',
      statDeltas: { attackBonus: 4, strengthBonus: 1 },
      meleeDamageMultiplier: 1.25,
      meleeDamageFlatBonus: 2,
      description: 'Righteous physical force (+25% melee damage, +2 flat, +4 ATK, +1 STR).',
    },
    {
      tier: 3,
      minFloor: 25,
      name: 'Celestial',
      alignment: 'positive',
      category: 'blessed',
      prefix: 'Celestial',
      statDeltas: { attackBonus: 6, strengthBonus: 2 },
      meleeDamageMultiplier: 1.4,
      meleeDamageFlatBonus: 4,
      description: 'Divine warrior puissance (+40% melee damage, +4 flat, +6 ATK, +2 STR).',
    },
  ],
  enchanted: [
    {
      tier: 1,
      minFloor: 1,
      name: 'Enchanted',
      alignment: 'positive',
      category: 'enchanted',
      prefix: 'Enchanted',
      spellDamageMultiplier: 1.2,
      manaCostDiscount: 2,
      description: 'Arcane conductivity (+20% spell damage, -2 mana cost).',
    },
    {
      tier: 2,
      minFloor: 10,
      name: 'Arcane',
      alignment: 'positive',
      category: 'enchanted',
      prefix: 'Arcane',
      spellDamageMultiplier: 1.35,
      manaCostDiscount: 4,
      description: 'Potent mana resonance (+35% spell damage, -4 mana cost).',
    },
    {
      tier: 3,
      minFloor: 25,
      name: "Archmage's",
      alignment: 'positive',
      category: 'enchanted',
      prefix: "Archmage's",
      spellDamageMultiplier: 1.5,
      manaCostDiscount: 6,
      description: 'Supreme mystic mastery (+50% spell damage, -6 mana cost).',
    },
  ],
  holy: [
    {
      tier: 1,
      minFloor: 1,
      name: 'of the Templar',
      alignment: 'positive',
      category: 'holy',
      suffix: 'of the Templar',
      tagBonuses: [
        { tag: 'undead', multiplier: 1.3, flatBonus: 2 },
        { tag: 'demon', multiplier: 1.3, flatBonus: 2 },
      ],
      description: 'Radiant warding against the unholy (+30% dmg, +2 flat vs Undead/Demons).',
    },
    {
      tier: 2,
      minFloor: 10,
      name: 'of Dawn',
      alignment: 'positive',
      category: 'holy',
      suffix: 'of Dawn',
      tagBonuses: [
        { tag: 'undead', multiplier: 1.5, flatBonus: 4 },
        { tag: 'demon', multiplier: 1.5, flatBonus: 4 },
      ],
      description: 'Blazing sunlight purging corruption (+50% dmg, +4 flat vs Undead/Demons).',
    },
    {
      tier: 3,
      minFloor: 25,
      name: 'of Radiant Glory',
      alignment: 'positive',
      category: 'holy',
      suffix: 'of Radiant Glory',
      tagBonuses: [
        { tag: 'undead', multiplier: 1.8, flatBonus: 8 },
        { tag: 'demon', multiplier: 1.8, flatBonus: 8 },
      ],
      description: 'Archon radiance eradicating fiends (+80% dmg, +8 flat vs Undead/Demons).',
    },
  ],
  cursed: [
    {
      tier: 1,
      minFloor: 1,
      name: 'Cursed',
      alignment: 'negative',
      category: 'cursed',
      prefix: 'Cursed',
      cursed: true,
      statDeltas: { attackBonus: -2, defenseBonus: -1 },
      description: 'Foul binding curse (Equip-locked, -2 ATK, -1 DEF).',
    },
    {
      tier: 2,
      minFloor: 15,
      name: 'Blighted',
      alignment: 'negative',
      category: 'cursed',
      prefix: 'Blighted',
      cursed: true,
      statDeltas: { attackBonus: -4, defenseBonus: -3, speedBonus: -10 },
      description: 'Crippling malignant binding (Equip-locked, -4 ATK, -3 DEF, -10 SPD).',
    },
  ],
  hexed: [
    {
      tier: 1,
      minFloor: 1,
      name: 'Hexed',
      alignment: 'negative',
      category: 'hexed',
      prefix: 'Hexed',
      damageTakenMultiplier: 1.25,
      damageTakenFlatBonus: 2,
      description: 'Hex of vulnerability (Bearer takes +25% + 2 damage from all attacks).',
    },
    {
      tier: 2,
      minFloor: 15,
      name: 'Doom-touched',
      alignment: 'negative',
      category: 'hexed',
      prefix: 'Doom-touched',
      damageTakenMultiplier: 1.5,
      damageTakenFlatBonus: 4,
      description: 'Fatal vulnerability (Bearer takes +50% + 4 damage from all attacks).',
    },
  ],
  unholy: [
    {
      tier: 1,
      minFloor: 1,
      name: 'Unholy',
      alignment: 'negative',
      category: 'unholy',
      prefix: 'Unholy',
      tagBonuses: [
        {
          tag: 'clergy',
          multiplier: 1.4,
          flatBonus: 3,
          renownCategory: 'dark_renown',
          renownAmount: 1,
        },
        {
          tag: 'innocent',
          multiplier: 1.4,
          flatBonus: 3,
          renownCategory: 'dark_renown',
          renownAmount: 1,
        },
      ],
      consecratedGroundPenalty: {
        damagePenalty: 0.5,
        selfDamagePerAttack: 3,
      },
      description: 'Dark blasphemy (+40% dmg vs clergy/innocents, +1 dark renown, suffers on holy ground).',
    },
    {
      tier: 2,
      minFloor: 15,
      name: 'Profane',
      alignment: 'negative',
      category: 'unholy',
      prefix: 'Profane',
      tagBonuses: [
        {
          tag: 'clergy',
          multiplier: 1.7,
          flatBonus: 6,
          renownCategory: 'dark_renown',
          renownAmount: 2,
        },
        {
          tag: 'innocent',
          multiplier: 1.7,
          flatBonus: 6,
          renownCategory: 'dark_renown',
          renownAmount: 2,
        },
      ],
      consecratedGroundPenalty: {
        damagePenalty: 0.7,
        selfDamagePerAttack: 6,
      },
      description: 'Dread sacrilege (+70% dmg vs clergy/innocents, +2 dark renown, severe consecrated ground penalty).',
    },
  ],
  chaotic: [
    {
      tier: 1,
      minFloor: 1,
      name: 'Frenetic',
      alignment: 'chaotic',
      category: 'chaotic',
      prefix: 'Frenetic',
      statDeltas: { attackBonus: 5 },
      meleeDamageMultiplier: 1.35,
      chaoticProc: {
        procChance: 0.2,
        type: 'backlash',
        param: 4,
        description: 'Volatile recoil backlash',
      },
      description: 'Frantic power (+35% melee dmg, +5 ATK, 20% chance of 4 backlash self-damage).',
    },
    {
      tier: 2,
      minFloor: 12,
      name: 'Warping',
      alignment: 'chaotic',
      category: 'chaotic',
      prefix: 'Warping',
      statDeltas: { speedBonus: 15 },
      meleeDamageMultiplier: 1.25,
      chaoticProc: {
        procChance: 0.15,
        type: 'teleport',
        param: 3,
        description: 'Erratic spatial jump',
      },
      description: 'Spatial instability (+25% melee dmg, +15 SPD, 15% chance of random tactical teleport).',
    },
    {
      tier: 3,
      minFloor: 25,
      name: 'Cataclysmic',
      alignment: 'chaotic',
      category: 'chaotic',
      prefix: 'Cataclysmic',
      statDeltas: { attackBonus: 8 },
      meleeDamageMultiplier: 1.6,
      chaoticProc: {
        procChance: 0.25,
        type: 'backlash',
        param: 8,
        description: 'Cataclysmic detonation backlash',
      },
      description: 'Unbridled havoc (+60% melee dmg, +8 ATK, 25% chance of 8 recoil self-damage).',
    },
  ],
};

let modifierCounter = 0;

export function createModifier(category: ModifierCategory, tier = 1): ItemModifier {
  const templates = MODIFIER_TEMPLATES[category];
  if (!templates || templates.length === 0) {
    throw new Error(`Unknown modifier category: ${category}`);
  }
  const matching = templates.find((t) => t.tier === tier) ?? templates[templates.length - 1];
  const id = `mod_${category}_t${matching.tier}_${++modifierCounter}`;
  return {
    ...matching,
    id,
  };
}

/**
 * Procedurally rolls modifiers for an item using deterministic seeded PRNG.
 */
export function rollItemModifiers(
  item: Item,
  currentFloor: number,
  rng: () => number
): ItemModifier[] {
  const isEquipment =
    item.category === 'weapon' ||
    item.category === 'armor' ||
    item.category === 'shield' ||
    item.category === 'helmet' ||
    item.category === 'boots' ||
    item.category === 'gauntlets' ||
    item.category === 'amulet' ||
    item.category === 'ring';

  if (!isEquipment) {
    return [];
  }

  // Determine tier based on floor depth
  let tier = 1;
  if (currentFloor >= 25) {
    tier = 3;
  } else if (currentFloor >= 10) {
    tier = 2;
  }

  const categories: ModifierCategory[] = [
    'blessed',
    'enchanted',
    'holy',
    'cursed',
    'hexed',
    'unholy',
    'chaotic',
  ];

  const catIdx = Math.floor(rng() * categories.length);
  const chosenCat = categories[catIdx];

  const modifier = createModifier(chosenCat, tier);
  return [modifier];
}

/**
 * Rolls and attaches procedural modifiers to the item instance.
 */
export function applyProceduralModifiers(
  item: Item,
  currentFloor: number,
  rng: () => number
): Item {
  const mods = rollItemModifiers(item, currentFloor, rng);
  for (const m of mods) {
    item.addModifier(m);
  }
  return item;
}
