import type { Item } from '../engine';
import { itemFrameTone, type FrameTone } from '../ui/inventory/itemTone';
import type { ThemeTokens } from './theme';

/** Which of the pack's theme roles each icon-frame tone draws in (N29). */
const FRAME_ROLE: Record<FrameTone, keyof ThemeTokens> = {
  cursed: 'rarityCursed',
  hexed: 'rarityHexed',
  unholy: 'rarityUnholy',
  holy: 'rarityHoly',
  enchanted: 'rarityEnchanted',
  blessed: 'rarityBlessed',
  chaotic: 'rarityChaotic',
  artifact: 'rarityArtifact',
};

/** The color an item's frame takes on the canvas, as its name does in the DOM; null when it has none. */
export function itemFrameColor(theme: ThemeTokens, item: Item): string | null {
  const tone = itemFrameTone(item);
  return tone ? String(theme[FRAME_ROLE[tone]]) : null;
}
