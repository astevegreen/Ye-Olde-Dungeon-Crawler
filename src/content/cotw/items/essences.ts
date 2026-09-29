import type { ItemDefinition } from '../../../engine';

/** Essence runes: what a kill rite yields when it teaches no new spell (`COTW_MAGIC.killRites.essenceItems`).
 * Offerings for the runic altars. Quest-category, so random loot never rolls them. */
const essence = (id: string, rune: string, meaning: string): ItemDefinition => ({
  id,
  name: `${rune} Essence-Rune`,
  category: 'quest',
  weight: 20,
  bulk: 10,
  identified: true,
  value: 0,
  description: `A rune of ${meaning} torn from a slain foe by its rite. Offer it at a runic altar.`,
});

export const COTW_ESSENCE_RUNES: ItemDefinition[] = [
  essence('essence_uruz', 'Uruz', 'raw strength (physical)'),
  essence('essence_ansuz', 'Ansuz', "Odin's own galdr (arcane)"),
  essence('essence_kenaz', 'Kenaz', 'living flame (fire)'),
  essence('essence_isa', 'Isa', 'unmelting ice (cold)'),
  essence('essence_thurisaz', 'Thurisaz', "the Thunderer's wrath (lightning)"),
  essence('essence_nauthiz', 'Nauthiz', 'need and darkness (shadow)'),
  essence('essence_berkano', 'Berkano', 'the birch-mother’s renewal (healing)'),
];

/** Essence item id per element, for the kill-rite config. */
export const COTW_ESSENCE_BY_ELEMENT: Record<string, string> = {
  physical: 'essence_uruz',
  arcane: 'essence_ansuz',
  fire: 'essence_kenaz',
  cold: 'essence_isa',
  lightning: 'essence_thurisaz',
  shadow: 'essence_nauthiz',
  healing: 'essence_berkano',
};
