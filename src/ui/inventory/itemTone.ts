import { CoinItem, type Item, parseCoinItem, type ThemeTokens } from '../../engine';

/**
 * What an item's name is colored by, as a role: one of eight alignments (three negative,
 * three positive, chaotic), else a quality tier, else a coin's denomination; null when
 * nothing applies or the item is unidentified (it looks plain until you know it).
 *
 * Within a polarity the most specific check runs first: `isBlessed()` also matches any
 * positive-alignment modifier (a broader gameplay bucket used by combat.ts and
 * Item.displayName), so `isHoly()`/`isEnchanted()` must be tested before it, or every
 * holy or enchanted item would read as plain blessed.
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
  | 'broken'
  | 'copper'
  | 'silver'
  | 'gold'
  | 'platinum';

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
  if (item.isEnchanted()) return 'enchanted';
  if (item.isBlessed()) return 'blessed';
  if (item.isChaotic()) return 'chaotic';
  if (item.quality === 'artifact') return 'artifact';
  if (item.isBroken()) return 'broken';
  return null;
}

/** The theme token behind each tone, for canvas code. */
export const ITEM_TONE_TOKEN: Record<ItemTone, keyof ThemeTokens> = {
  cursed: 'rarityCursed',
  hexed: 'rarityHexed',
  unholy: 'rarityUnholy',
  holy: 'rarityHoly',
  enchanted: 'rarityEnchanted',
  blessed: 'rarityBlessed',
  chaotic: 'rarityChaotic',
  artifact: 'rarityArtifact',
  broken: 'rarityBroken',
  copper: 'coinCopper',
  silver: 'coinSilver',
  gold: 'coinGold',
  platinum: 'coinPlatinum',
};

/** ` it-tone-<tone>` for an element's class list (menu.css), or '' for a plain item. */
export function itemToneClass(item: Item | null | undefined): string {
  const tone = itemTone(item);
  return tone ? ` it-tone-${tone}` : '';
}
