/** What the soak bot knows when it weighs a Heal: its life, its Seiðr, the Heal it can cast now. */
export interface HealCheck {
  hp: number;
  maxHp: number;
  mana: number;
  /** The castable Heal's actual cost, after the learning-stone share (`castables` in playerBot.ts). */
  healCost: number;
  /** The most the Heal restores: the spell's `basePower`. */
  healPower: number;
  /** Two or more awake foes, or one worth half the hero's own life (`bigFight` in playerBot.ts). */
  bigFight: boolean;
}

/**
 * Whether the bot casts Heal now. Hurt to 55% or below, always. In a big fight it also tops up
 * early, as a careful player would, once it holds Seiðr for two Heals and misses a whole Heal's
 * worth of life: against Gálmr's Rime Shockwave heroes died with Seiðr left for two or three Heals.
 *
 * The bot rebuilds this in the page from its source text (playerBot.ts), so it imports nothing
 * and calls nothing outside itself.
 */
export function shouldHeal(c: HealCheck): boolean {
  if (c.hp <= c.maxHp * 0.55) return true;
  return c.bigFight && c.mana >= 2 * c.healCost && c.maxHp - c.hp >= c.healPower;
}

/** What the bot knows when it weighs the Seiðr a damage spell must leave untouched. */
export interface ReserveCheck {
  hp: number;
  maxHp: number;
  bigFight: boolean;
  /** The castable Heal's actual cost (`castables`), or null when no Heal can be cast now. */
  healCost: number | null;
  /** The quick-slotted Heal's listed `manaCost`, or null when no Heal is quick-slotted. */
  listedHealCost: number | null;
}

/**
 * The Seiðr a damage spell must leave for a Heal. In a big fight, one Heal's actual cost at any
 * life; otherwise one listed cost, and only while under 70% life. A big fight with no castable
 * Heal keeps the second rule.
 *
 * Rebuilt in the page from its source text like `shouldHeal`: no imports, no outside calls.
 */
export function healReserve(c: ReserveCheck): number {
  if (c.bigFight && c.healCost !== null) return c.healCost;
  return c.listedHealCost !== null && c.hp < c.maxHp * 0.7 ? c.listedHealCost : 0;
}
