/** What the soak bot knows when it weighs its quick bar: what it can cast, and what it has cast. */
export interface QuickBarCheck {
  /** The spells the hero can cast: the grimoire-slotted ones, or every spell known without grimoires. */
  castable: string[];
  /** The quick bar, keys 1 to 0: a spell id or null per slot. */
  quickBar: Array<string | null>;
  /** The run's casts by spell id (magicTap.ts). */
  casts: Record<string, number>;
  /** Which of the castable spells heal (`spellType: 'heal'`). */
  heals: string[];
}

/** Put `spellId` on quick slot `slot` (0 is key 1, 9 is key 0). */
export interface QuickBarMove {
  spellId: string;
  slot: number;
}

/**
 * The next spell to put on the quick bar, so every spell the hero can cast gets cast: the bot
 * casts only from the bar. The spell is the least-cast one off the bar (the first on a tie);
 * its slot is an empty one, else one holding a spell the hero cannot cast, else that of the
 * most-cast spell on the bar that is neither Magic Arrow (the bot's snipe) nor the bar's only
 * Heal, and only when that spell has been cast more than the one coming in, so the bar never
 * swaps back and forth. The lowest slot wins a tie. Null when there is nothing to move.
 *
 * Rebuilt in the page from its source text like `shouldHeal`: no imports, no outside calls.
 */
export function quickBarMove(c: QuickBarCheck): QuickBarMove | null {
  const slots = 10;
  const bar: Array<string | null> = [];
  for (let i = 0; i < slots; i++) bar.push(c.quickBar[i] ?? null);
  const count = (id: string) => c.casts[id] ?? 0;
  let spellId: string | null = null;
  for (const id of c.castable) {
    if (bar.includes(id)) continue;
    if (spellId === null || count(id) < count(spellId)) spellId = id;
  }
  if (spellId === null) return null;

  const empty = bar.indexOf(null);
  if (empty >= 0) return { spellId, slot: empty };
  const dead = bar.findIndex((id) => id !== null && !c.castable.includes(id));
  if (dead >= 0) return { spellId, slot: dead };

  const healsOnBar = bar.filter((id) => id !== null && c.heals.includes(id)).length;
  let slot = -1;
  for (let i = 0; i < slots; i++) {
    const id = bar[i] as string;
    if (id === 'magic_arrow' || (c.heals.includes(id) && healsOnBar < 2)) continue;
    if (count(id) <= count(spellId)) continue;
    if (slot < 0 || count(id) > count(bar[slot] as string)) slot = i;
  }
  return slot >= 0 ? { spellId, slot } : null;
}
