import type { ItemDefinition } from '../../../engine';

/** Essence runes: what a kill rite yields when it teaches no new spell (`COTW_MAGIC.killRites.essenceItems`).
 * Offerings for the runic altars. Quest-category, so random loot never rolls them. The first
 * one of each a hero carries shows `firstPickupHint`: its element and an altar below, no rules. */
const essence = (id: string, rune: string, meaning: string, hint: string): ItemDefinition => ({
  id,
  name: `${rune} Essence-Rune`,
  category: 'quest',
  stackable: true,
  weight: 20,
  bulk: 10,
  identified: true,
  value: 0,
  description: `A rune of ${meaning} torn from a slain foe by its rite. Offer it at a runic altar.`,
  firstPickupHint: { title: `${rune} Essence-Rune`, text: hint },
});

export const COTW_ESSENCE_RUNES: ItemDefinition[] = [
  essence(
    'essence_uruz', 'Uruz', 'raw strength (physical)',
    "Uruz, the aurochs. The stone sits warm and stubborn in your hand, like a beast that will not be led. It is not yours to keep: somewhere below, stones raised to the gods wait for strength to be laid on them."
  ),
  essence(
    'essence_ansuz', 'Ansuz', "Odin's own galdr (arcane)",
    "Ansuz, the god's mouth. Hold it close and you almost hear a word. Odin paid an eye and nine nights for words like this one; there are altars below that would take it from you and pay you back in galdr."
  ),
  essence(
    'essence_kenaz', 'Kenaz', 'living flame (fire)',
    "Kenaz, the torch. It burns without heat in your palm, waiting for something worth setting alight. Spellcraft of flame would answer it, if it were burnt where the gods could see."
  ),
  essence(
    'essence_isa', 'Isa', 'unmelting ice (cold)',
    "Isa, the ice. A single stroke, still as a frozen lake. Whatever it binds stays bound, and an oath-stone would know what to bind with it."
  ),
  essence(
    'essence_thurisaz', 'Thurisaz', "the Thunderer's wrath (lightning)",
    "Thurisaz, the Thunderer's thorn. It stings your fingers. Few things below carry this rune, and fewer give it up: spend it where it counts."
  ),
  essence(
    'essence_nauthiz', 'Nauthiz', 'need and darkness (shadow)',
    "Nauthiz, need. It is heavy with everything the dead were owed. Hel keeps a reckoning of such debts, and she takes payment in kind."
  ),
  essence(
    'essence_berkano', 'Berkano', 'the birch-mother’s renewal (healing)',
    "Berkano, the birch-mother. Something green stirs in it, faint as spring under snow. Laid on the right altar, renewal could be woven into your own craft."
  ),
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
