import { CoinItem, type Item, parseCoinItem } from '../../engine';

/**
 * What an item's name is colored by, as a role: one of seven families (three negative,
 * three positive, chaotic), else an artifact, else a coin's denomination; null when
 * nothing applies or the item is unidentified (it looks plain until you know it).
 *
 * Each check is its own family; `isEnchanted()` also counts a +N or elemental affix, so
 * it runs after the families that name themselves, and a "Blessed Broadsword +1" is blue.
 */
export type ItemTone =
  | 'cursed'
  | 'hexed'
  | 'unholy'
  | 'holy'
  | 'enchanted'
  | 'blessed'
  | 'chaotic'
  | 'artifact'
  | 'copper'
  | 'silver'
  | 'gold';

export function itemTone(item: Item | null | undefined): ItemTone | null {
  if (!item || !item.identified) return null;
  if (item instanceof CoinItem || item.category === 'currency') {
    const parsed = parseCoinItem(item);
    if (parsed) return parsed.denomination;
  }
  if (item.isCursed()) return 'cursed';
  if (item.isHexed()) return 'hexed';
  if (item.isUnholy()) return 'unholy';
  if (item.isHoly()) return 'holy';
  if (item.isBlessed()) return 'blessed';
  if (item.isChaotic()) return 'chaotic';
  if (item.isEnchanted()) return 'enchanted';
  if (item.quality === 'artifact') return 'artifact';
  return null;
}

/** ` it-tone-<tone>` for an element's class list (menu.css), or '' for a plain item. */
export function itemToneClass(item: Item | null | undefined): string {
  const tone = itemTone(item);
  return tone ? ` it-tone-${tone}` : '';
}
