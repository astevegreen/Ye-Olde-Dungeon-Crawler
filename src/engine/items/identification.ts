import { Item } from './item';
import type { GameContentManifest } from '../types/manifest';

export type ItemInstance = Item;

/**
 * Identifies items. Identification is per item (owner decision Q7, 2026-10-06): an item's own
 * `identified` flag is the only truth, so knowing one bottle never names another of its kind,
 * and there is no per-definition store. An unidentified item shows its definition's
 * `unidentifiedName`; the procedural alias pools this class once built had no reader.
 */
export class IdentificationManager {
  /** The manifest parameter is kept for `GameEngine`'s call site (a §8.1 protected file). */
  constructor(_manifest?: GameContentManifest) {}

  /** Identifies one item: its true name, stats and worth show from now on. */
  public identifyItem(item: ItemInstance): void {
    item.identified = true;
  }
}
