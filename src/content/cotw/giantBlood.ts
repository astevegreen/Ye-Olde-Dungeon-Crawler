import {
  AttributeCalculator,
  type AttributeModifier,
  type StatusHandler,
  type StatusTickOutput,
  type ActionHook,
  type Entity,
} from '../../engine';

/**
 * The Hearth-Tear of Járnviðr, felt as a bonus instead of a debuff (ARCHITECTURE.md
 * §3 — replaces the old `hazards.ts` permafrost/obsidian damage tick, 2026-09-18):
 * the protagonist's frost-giant heritage grants extra attack and defense in the
 * dungeon's colder early zones, fading in steps as the dungeon warms toward the
 * stolen sun-chariot at floor 25 and gone entirely once Act 2 begins at floor 26 —
 * Act 2's difficulty comes from monster power alone (`monsterScaling.ts`), with no
 * thematic tie-in of its own.
 */
export const GIANT_BLOOD_STATUS = 'cotw:giant_blood';

interface GiantBloodTier {
  floor: number;
  attackBonus: number;
  defenseBonus: number;
  /** Logged once, the first tick this tier becomes active (not on every tick). */
  onEnterMessage?: string;
}

const APPLY_MESSAGE =
  'The blood of Thrym stirs in your veins — the permafrost cannot touch you as it does lesser folk.';

/** Ascending floor order. The last entry whose floor <= current floor applies (a
 * step curve, same idiom as `stats/levelScaledResistance.ts`). */
const GIANT_BLOOD_TIERS: GiantBloodTier[] = [
  { floor: 1, attackBonus: 3, defenseBonus: 3 },
  {
    floor: 10,
    attackBonus: 2,
    defenseBonus: 2,
    onEnterMessage: "Your blood's frost-born strength begins to fade as the tunnels grow warmer.",
  },
  {
    floor: 18,
    attackBonus: 1,
    defenseBonus: 1,
    onEnterMessage: 'Only a faint ember of your ancestor’s chill still stirs in your veins.',
  },
];

/** Act 2 begins here (`quest.ts`'s `COTW_QUEST`) — the buff has no presence past this point. */
const FADE_FLOOR = 26;
const REMOVAL_MESSAGE =
  'The last warmth of your giant forebear’s blood gutters out as the depths turn to root and rot.';

function resolveTier(floor: number): GiantBloodTier | undefined {
  let result: GiantBloodTier | undefined;
  for (const tier of GIANT_BLOOD_TIERS) {
    if (floor >= tier.floor) result = tier;
    else break;
  }
  return result;
}

export const giantBloodHandler: StatusHandler = {
  // No onApply: action hooks (`ActionHook.execute`) receive the narrower
  // `EngineContext`, not a full `GameEngine` (ARCHITECTURE.md §3), so the
  // bootstrap hook below applies this status without an entity/engine pair —
  // `StatusManager.applyStatus` only fires `onApply` when both are supplied. The
  // "buff granted" flavor line is delivered from the first `onTick` instead, which
  // does get the full `GameEngine`.
  onTick(entity: Entity, effect, engine): StatusTickOutput {
    // Ambient while active, like the hazard it replaced — it never counts down on
    // its own; onTick below removes it explicitly once Act 2 begins.
    effect.duration = 9999;

    const floor = engine.currentFloor;
    if (floor >= FADE_FLOOR) {
      // Self-removal from inside onTick, the same documented pattern the Rune of
      // Return's interrupt-fizzle uses (statusManager.ts) — no engine change needed
      // for a status to end itself mid-tick instead of expiring naturally.
      entity.statusManager.removeStatus(GIANT_BLOOD_STATUS);
      return { damageTaken: 0, killed: false, message: REMOVAL_MESSAGE };
    }

    const isFirstTick = effect.data === undefined;
    const tier = resolveTier(floor);
    const previousTierFloor = effect.data?.tierFloor as number | undefined;
    const attackBonus = tier?.attackBonus ?? 0;
    const defenseBonus = tier?.defenseBonus ?? 0;
    effect.data = { attackBonus, defenseBonus, tierFloor: tier?.floor };

    let message: string | undefined;
    if (isFirstTick) {
      message = APPLY_MESSAGE;
    } else if (tier !== undefined && tier.floor !== previousTierFloor) {
      message = tier.onEnterMessage;
    }

    return { damageTaken: 0, killed: false, message };
  },
};

/**
 * Applies the buff to the player on their very first action and never again
 * (guarded by `hasStatus`) — content's own bootstrap, same shape as the hazard it
 * replaced.
 */
export const GIANT_BLOOD_BOOTSTRAP_HOOK: ActionHook = {
  id: 'giant-blood-bootstrap',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    const player = engine.player;
    if (actor === player && !player.statusManager.hasStatus(GIANT_BLOOD_STATUS)) {
      player.statusManager.applyStatus({ type: GIANT_BLOOD_STATUS, duration: 9999 });
    }
  },
};

function giantBloodBonus(actor: Entity, key: 'attackBonus' | 'defenseBonus'): number {
  const status = actor.statusManager?.getStatus(GIANT_BLOOD_STATUS);
  const value = status?.data?.[key];
  return typeof value === 'number' ? value : 0;
}

/**
 * Two flat `AttributeModifier`s (`stats/attributeCalculator.ts`) read the bonus
 * `giantBloodHandler.onTick` refreshes into `effect.data` each turn.
 * `calculateAttribute(actor, 'attack'/'defense')` is called with no context
 * (`entities/player.ts`, `entities/monster.ts`), so a modifier alone can't see the
 * current floor — onTick is what has engine access and does that work, the
 * modifier just adds whatever it already computed, the same generic flat-additions
 * phase equipment and pact bonuses already run through. Registered at module load,
 * the same process-wide-registry-at-import-time idiom `MonsterRegistry.registerAll`
 * already uses in `monsters/index.ts`.
 */
const GIANT_BLOOD_ATTACK_MODIFIER: AttributeModifier = {
  id: 'cotw-giant-blood-attack',
  attributeKey: 'attack',
  phase: 'flat',
  apply: (currentValue, actor) => currentValue + giantBloodBonus(actor, 'attackBonus'),
};

const GIANT_BLOOD_DEFENSE_MODIFIER: AttributeModifier = {
  id: 'cotw-giant-blood-defense',
  attributeKey: 'defense',
  phase: 'flat',
  apply: (currentValue, actor) => currentValue + giantBloodBonus(actor, 'defenseBonus'),
};

AttributeCalculator.registerModifier(GIANT_BLOOD_ATTACK_MODIFIER);
AttributeCalculator.registerModifier(GIANT_BLOOD_DEFENSE_MODIFIER);
