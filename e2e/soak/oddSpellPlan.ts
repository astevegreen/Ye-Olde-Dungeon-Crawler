/** What the soak bot knows when it weighs a self spell with no `spellType` (Hliðskjálf's reveal). */
export interface RevealCheck {
  /** An awake foe stands in sight. */
  awakeFoeInSight: boolean;
  /** The floor's down stairs are explored. */
  downStairsSeen: boolean;
  /** Casts of this spell on this floor so far, spent or failed (magicTap.ts). */
  triedThisFloor: number;
}

/**
 * Whether the bot casts a self spell with no type now: once a floor, with no awake foe in sight,
 * while the way down is still unseen, which is when a look over the floor helps.
 *
 * Rebuilt in the page from its source text like `shouldHeal`: no imports, no outside calls.
 */
export function shouldReveal(c: RevealCheck): boolean {
  return c.triedThisFloor === 0 && !c.awakeFoeInSight && !c.downStairsSeen;
}

/** An awake foe in sight, as a control spell sees it. */
export interface ControlFoe {
  id: string;
  /** Chebyshev distance from the hero. */
  dist: number;
  hp: number;
  maxHp: number;
  /** The spell reaches it (range, and its flight or sight line). */
  reached: boolean;
  /** It already has the spell's status (always false for a swap). */
  hasStatus: boolean;
}

/** What the bot knows when it weighs one control spell. */
export interface ControlCheck {
  /** Two or more awake foes, or one worth half the hero's own life (`bigFight` in playerBot.ts). */
  bigFight: boolean;
  /** Past the control cooldown (`COOLDOWN.control`). */
  ready: boolean;
  /** The status the spell lays, or null when it lays none (Loki's Switch swaps places). */
  status: string | null;
  /** `shouldHeal` says heal now (healPlan.ts). */
  wantsHeal: boolean;
  /** The awake foes in sight, nearest first, ties by id. */
  foes: ControlFoe[];
}

/**
 * The foe a control spell goes on, by id, or null. Only in a big fight, past the cooldown.
 * A status spell holds the biggest foe (most max HP, the nearest on a tie) while it has more
 * than 30% of its life, lacks the status and is in reach. A spell with no status (a swap) goes
 * on the farthest foe it reaches at range 2 or more (the first on a tie), never while the hero
 * wants a Heal.
 *
 * Rebuilt in the page from its source text like `shouldHeal`: no imports, no outside calls.
 */
export function controlTarget(c: ControlCheck): string | null {
  if (!c.bigFight || !c.ready) return null;
  if (c.status === null) {
    if (c.wantsHeal) return null;
    let far: ControlFoe | null = null;
    for (const f of c.foes) if (f.reached && f.dist >= 2 && (far === null || f.dist > far.dist)) far = f;
    return far ? far.id : null;
  }
  let biggest: ControlFoe | null = null;
  for (const f of c.foes) if (biggest === null || f.maxHp > biggest.maxHp) biggest = f;
  if (!biggest || biggest.hp <= biggest.maxHp * 0.3 || biggest.hasStatus || !biggest.reached) return null;
  return biggest.id;
}
