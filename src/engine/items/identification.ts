import { Item } from './item';
import type { GameContentManifest, ItemAliasPools } from '../types/manifest';

export type ItemInstance = Item;

export const DEFAULT_ALIAS_POOLS: ItemAliasPools = {
  potions: [
    'bubbly cyan draught',
    'milky white elixir',
    'effervescent amber potion',
    'viscous emerald brew',
    'fizzy violet mixture',
    'smoky crimson phial',
    'clear shimmering liquid',
    'turbid indigo tonic',
    'golden glowing philter',
  ],
  scrolls: [
    'papyrus scroll labeled XYZZY',
    'vellum scroll labeled ZOD',
    'parchment scroll labeled ELBERETH',
    'illuminated scroll labeled THACO',
    'brittle scroll labeled FOOBAR',
    'waxed scroll labeled GLYPH',
    'ancient roll labeled KLAATU',
  ],
  wands: [
    'gnarled oak wand',
    'slender brass rod',
    'notched pine wand',
    'twisted bone baton',
    'inscribed crystal wand',
    'rusted iron rod',
    'tapered silver cane',
  ],
  rings: [
    'twisted iron band',
    'dull copper loop',
    'faceted obsidian ring',
    'smooth jade circlet',
    'etched pewter band',
    'spiral electrum ring',
  ],
  amulets: [
    'serpentine medallion',
    'carved bone talisman',
    'faceted sapphire pendant',
    'leaden locket',
    'bronze ankh',
  ],
};

/**
 * Identifies items and assigns procedural aliases. Identification is per item (owner
 * decision Q7, 2026-10-06): an item's own `identified` flag is the only truth, so knowing
 * one bottle never names another of its kind, and there is no per-definition store.
 */
export class IdentificationManager {
  private readonly assignedAliases = new Map<string, string>();
  private readonly manifest?: GameContentManifest;

  constructor(manifest?: GameContentManifest, seed: number = 1337) {
    this.manifest = manifest;
    this.initializeAliases(seed);
  }

  private pseudoRandom(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  private shuffle<T>(array: T[], rng: () => number): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  public initializeAliases(seed: number = 1337): void {
    const rng = this.pseudoRandom(seed);
    const pools = this.manifest?.itemAliasPools ?? DEFAULT_ALIAS_POOLS;
    const items = this.manifest?.items ?? [];

    // Group manifest items by category (e.g. potion, scroll, wand, ring, amulet)
    const categoryMap: Record<string, string[]> = {
      potion: pools.potions ?? DEFAULT_ALIAS_POOLS.potions ?? [],
      scroll: pools.scrolls ?? DEFAULT_ALIAS_POOLS.scrolls ?? [],
      wand: pools.wands ?? DEFAULT_ALIAS_POOLS.wands ?? [],
      ring: pools.rings ?? DEFAULT_ALIAS_POOLS.rings ?? [],
      amulet: pools.amulets ?? DEFAULT_ALIAS_POOLS.amulets ?? [],
    };

    for (const [cat, aliasList] of Object.entries(categoryMap)) {
      const shuffled = this.shuffle(aliasList, rng);
      const matchingItems = items.filter(
        (i) =>
          i.category === cat ||
          i.itemType === cat ||
          (cat === 'potion' && (i.id.startsWith('potion_') || i.itemType === 'potion')) ||
          (cat === 'wand' && (i.id.startsWith('wand_') || i.itemType === 'wand')) ||
          (cat === 'scroll' && (i.id.startsWith('scroll_') || i.itemType === 'scroll'))
      );

      matchingItems.forEach((item, idx) => {
        if (idx < shuffled.length) {
          const alias = shuffled[idx];
          // Title case alias
          const titled = alias.replace(/\b\w/g, (c) => c.toUpperCase());
          this.assignedAliases.set(item.id, titled);
        }
      });
    }
  }

  /** Identifies one item: its true name, stats and worth show from now on. */
  public identifyItem(item: ItemInstance): void {
    item.identified = true;
  }

  /**
   * Gets the procedural alias assigned to an item definition, if any.
   * If not yet assigned and itemDef is provided, dynamically assigns a deterministic alias.
   */
  public getAlias(definitionId: string, itemDef?: { category?: string; itemType?: string }): string | undefined {
    let existing = this.assignedAliases.get(definitionId);
    if (!existing && itemDef) {
      const cat = (itemDef.category || itemDef.itemType || '').toLowerCase();
      const pools = this.manifest?.itemAliasPools ?? DEFAULT_ALIAS_POOLS;
      const key = (cat.endsWith('s') ? cat : `${cat}s`) as keyof typeof DEFAULT_ALIAS_POOLS;
      const list = pools[key] ?? DEFAULT_ALIAS_POOLS[key];
      if (list && list.length > 0) {
        let hash = 0;
        for (let i = 0; i < definitionId.length; i++) {
          hash = (hash << 5) - hash + definitionId.charCodeAt(i);
          hash |= 0;
        }
        const idx = Math.abs(hash) % list.length;
        const titled = list[idx].replace(/\b\w/g, (c: string) => c.toUpperCase());
        this.assignedAliases.set(definitionId, titled);
        existing = titled;
      }
    }
    return existing;
  }
}
