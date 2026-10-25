/** What the soak bot knows when it weighs an escape spell (Phase Door): its life, the foes beside it, its Seiðr. */
export interface EscapeCheck {
  hp: number;
  maxHp: number;
  /** The hostiles on the eight tiles around the hero (`adjHostiles` in playerBot.ts). */
  adjacentFoes: number;
  mana: number;
  /** The castable self-targeted movement spell's actual cost (`castables`), or null when none can be cast now. */
  escapeCost: number | null;
  /** The cost of the Heal the bot would cast now (castable, and `shouldHeal` says so), or null. */
  healCost: number | null;
  /** The bot chose a Heal on one of its last two turns (`lastCast` in playerBot.ts). */
  justHealed: boolean;
}

/**
 * Whether the bot casts its escape spell now. Only with a foe beside it, and badly hurt: at 30% of
 * its life or below, or at 60% when three foes ring it. A Heal the bot would cast comes first;
 * the escape follows when that Heal left the hero still below the line, or when the Seiðr pays
 * for only one of the two. Heal and Phase Door both cost 4 and every R4 hero knew both, so with
 * the Heal always first Phase Door was never cast (R4: 0 casts in 41 runs), and a hero whose
 * Heal fell behind a giant's blows healed until it died.
 *
 * Rebuilt in the page from its source text like `shouldHeal`: no imports, no outside calls.
 */
export function shouldEscape(c: EscapeCheck): boolean {
  if (c.escapeCost === null || c.mana < c.escapeCost || c.adjacentFoes === 0) return false;
  const low = c.hp <= c.maxHp * 0.3 || (c.adjacentFoes >= 3 && c.hp <= c.maxHp * 0.6);
  if (!low) return false;
  return c.healCost === null || c.justHealed || c.mana < c.healCost + c.escapeCost;
}
