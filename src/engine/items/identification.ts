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

export interface IdentificationSerializedState {
  identified: string[];
  aliases: Array<[string, string]>;
}

/**
 * Manages item identification state, procedural alias assignment, and run-level discovery.
 */
export class IdentificationManager {
  private readonly identifiedDefinitions = new Set<string>();
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

  /**
   * Checks whether a specific item instance or item definition ID is identified.
   */
  public isIdentified(itemOrId: ItemInstance | string): boolean {
    if (typeof itemOrId === 'string') {
      return this.identifiedDefinitions.has(itemOrId);
    }
    if (itemOrId.identified) return true;
    if (this.identifiedDefinitions.has(itemOrId.id)) return true;
    if (itemOrId.definitionId && this.identifiedDefinitions.has(itemOrId.definitionId)) return true;
    return false;
  }

  /**
   * Identifies a specific item instance and flags its definition type as known.
   */
  public identifyItem(item: ItemInstance): void {
    item.identified = true;
    this.identifiedDefinitions.add(item.id);
    if (item.definitionId) {
      this.identifiedDefinitions.add(item.definitionId);
    }
  }

  /**
   * Identifies all items of a given definition ID.
   */
  public identifyDefinition(definitionId: string): void {
    this.identifiedDefinitions.add(definitionId);
  }

  /**
   * Resolves the proper display name for an item based on its identification status.
   */
  public resolveDisplayName(item: ItemInstance): string {
    if (this.isIdentified(item)) {
      return item.displayName;
    }
    const alias = (item.definitionId && this.assignedAliases.get(item.definitionId)) || this.assignedAliases.get(item.id);
    if (alias) {
      return alias;
    }
    return item.unidentifiedName || 'Unidentified Item';
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

  /**
   * Serializes identification state for saving.
   */
  public serialize(): IdentificationSerializedState {
    return {
      identified: Array.from(this.identifiedDefinitions),
      aliases: Array.from(this.assignedAliases.entries()),
    };
  }

  /**
   * Deserializes identification state from save data.
   */
  public deserialize(data?: Partial<IdentificationSerializedState>): void {
    if (!data) return;
    if (Array.isArray(data.identified)) {
      this.identifiedDefinitions.clear();
      for (const id of data.identified) {
        this.identifiedDefinitions.add(id);
      }
    }
    if (Array.isArray(data.aliases)) {
      this.assignedAliases.clear();
      for (const [k, v] of data.aliases) {
        this.assignedAliases.set(k, v);
      }
    }
  }
}
