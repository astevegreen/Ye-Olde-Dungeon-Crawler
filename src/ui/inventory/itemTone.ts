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

/** The tones an icon frame shows (N29): an item's family tone, never a coin's metal. */
export type FrameTone = Exclude<ItemTone, 'copper' | 'silver' | 'gold'>;

/** The frame an item's icon gets: its name's tone once identified; null for plain items and coins. */
export function itemFrameTone(item: Item | null | undefined): FrameTone | null {
  const tone = itemTone(item);
  return tone === null || tone === 'copper' || tone === 'silver' || tone === 'gold' ? null : tone;
}

/** ` it-frame it-frame-<tone>` for an icon's (or its cell's) class list (menu.css), or ''. */
export function itemFrameClass(item: Item | null | undefined): string {
  const tone = itemFrameTone(item);
  return tone ? ` it-frame it-frame-${tone}` : '';
}

/** What each frame color means, in the inventory's legend: in two columns, the positive
 *  families and artifacts, then the negative ones and chaotic. */
export const FRAME_LEGEND: ReadonlyArray<{ tone: FrameTone; label: string }> = [
  { tone: 'blessed', label: 'Blessed' },
  { tone: 'enchanted', label: 'Enchanted or +N' },
  { tone: 'holy', label: 'Holy' },
  { tone: 'artifact', label: 'Artifact' },
  { tone: 'cursed', label: 'Cursed' },
  { tone: 'hexed', label: 'Hexed' },
  { tone: 'unholy', label: 'Unholy' },
  { tone: 'chaotic', label: 'Chaotic' },
];
