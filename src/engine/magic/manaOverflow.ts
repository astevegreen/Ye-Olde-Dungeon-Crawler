import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import type { VisualEffectDescriptor } from '../types';
import { DeathResolver } from '../combat/deathResolver';
import { formatMagicMessage, type ManaOverflowConfig, type OverflowOutcome, type OverflowTier } from './magicConfig';

export interface ManaOverflowResolution {
  occurred: boolean;
  /** Index into the pack's tiers, 1-based; 0 when no tier was reached. */
  tier: number;
  deficit: number;
  totalDebt: number;
  message?: string;
  effects: VisualEffectDescriptor[];
  damageToCaster: number;
}

/** The pack's overflow config, or undefined when the pack keeps a hard mana wall. */
export function getOverflowConfig(engine: GameEngine): ManaOverflowConfig | undefined {
  return engine.manifest?.magic?.overflow;
}

/** True when a cast may go past zero mana into debt (the pack declares overflow). */
export function canOvercast(engine: GameEngine): boolean {
  return getOverflowConfig(engine) !== undefined;
}

/** The highest tier `debt` has reached, with its 1-based index, or undefined below the first. */
export function getOverflowTier(
  config: ManaOverflowConfig | undefined,
  debt: number
): { tier: OverflowTier; index: number } | undefined {
  if (!config) return undefined;
  let found: { tier: OverflowTier; index: number } | undefined;
  config.tiers.forEach((tier, i) => {
    if (debt >= tier.minDebt) found = { tier, index: i + 1 };
  });
  return found;
}

/**
 * The lowest debt a rest may leave: 0 in town, else the pack's lingering floor once the
 * debt has reached it.
 */
export function lingeringDebtFloor(engine: GameEngine, debt: number): number {
  const lingering = getOverflowConfig(engine)?.lingeringDebt;
  if (lingering === undefined || engine.currentFloor === 0) return 0;
  return debt >= lingering ? lingering : 0;
}

/**
 * Resolves a cast that spent past zero mana: accrues the deficit as debt, then rolls a
 * surge from the pack's tier table. Deterministic: draws only from `engine.prng`.
 */
export class ManaOverflowManager {
  /**
   * `options` are what the caster wears (Void-Kissed): `accrueDebt: false` rolls the surge as
   * if the deficit were owed but leaves the debt alone; `tierShift` rolls it that many tiers
   * up the pack's table (clamped to the last), but no higher than `tierShiftCap` when one is
   * worn; a surge already above the cap stays where it is.
   */
  public static evaluateOverflow(
    engine: GameEngine,
    caster: Entity,
    deficit: number,
    options?: { accrueDebt?: boolean; tierShift?: number; tierShiftCap?: number }
  ): ManaOverflowResolution {
    const player = caster instanceof Player ? caster : undefined;
    const accrue = options?.accrueDebt ?? true;
    const totalDebt = player ? (accrue ? player.accrueVoidDebt(deficit) : player.voidDebt + deficit) : deficit;
    const effects: VisualEffectDescriptor[] = [];

    const config = getOverflowConfig(engine);
    let reached = getOverflowTier(config, totalDebt);
    const shift = options?.tierShift ?? 0;
    if (reached && shift > 0 && config) {
      const ceiling = Math.min(config.tiers.length, options?.tierShiftCap ?? config.tiers.length);
      const index = Math.max(reached.index, Math.min(ceiling, reached.index + shift));
      reached = { tier: config.tiers[index - 1], index };
    } else if (reached && shift < 0 && config) {
      // A milder surge (Arch-Seiðkona); below the first tier there is none.
      const index = reached.index + shift;
      reached = index >= 1 ? { tier: config.tiers[index - 1], index } : undefined;
    }
    if (!reached || reached.tier.outcomes.length === 0) {
      return { occurred: false, tier: 0, deficit, totalDebt, effects, damageToCaster: 0 };
    }
    const { tier, index } = reached;

    effects.push({
      type: 'burst',
      epicenter: { x: caster.x, y: caster.y },
      radius: tier.burstRadius,
      color: tier.color,
      durationMs: tier.burstDurationMs,
      style: 'shockwave',
    });

    const outcome = rollOutcome(engine, tier.outcomes);
    const values: Record<string, string | number> = { caster: caster.name, debt: totalDebt };
    const { message, damageToCaster } = applyOutcome(engine, caster, player, deficit, outcome, values, effects);

    engine.log(message);
    return { occurred: true, tier: index, deficit, totalDebt, message, effects, damageToCaster };
  }
}

function rollOutcome(engine: GameEngine, outcomes: OverflowOutcome[]): OverflowOutcome {
  const total = outcomes.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
  let roll = engine.prng.nextInt(1, Math.max(1, total));
  for (const o of outcomes) {
    roll -= Math.max(0, o.weight);
    if (roll <= 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

function applyOutcome(
  engine: GameEngine,
  caster: Entity,
  player: Player | undefined,
  deficit: number,
  outcome: OverflowOutcome,
  values: Record<string, string | number>,
  effects: VisualEffectDescriptor[]
): { message: string; damageToCaster: number } {
  const format = (template: string) => formatMagicMessage(template, values);
  const hurt = (amount: number, flashColor?: string): number => {
    const res = caster.takeDamage(amount);
    if (flashColor) effects.push({ type: 'screen_flash', color: flashColor, durationMs: 250 });
    if (res.killed) DeathResolver.resolveDeath(engine, undefined, caster, { cause: 'magical backlash' });
    return res.damageDealt;
  };

  switch (outcome.kind) {
    case 'spill': {
      const neighbors = [
        { x: caster.x + 1, y: caster.y },
        { x: caster.x - 1, y: caster.y },
        { x: caster.x, y: caster.y + 1 },
        { x: caster.x, y: caster.y - 1 },
      ].filter((p) => engine.map.inBounds(p.x, p.y) && engine.map.isPassable(p.x, p.y));
      if (neighbors.length === 0 || !engine.surfaces || outcome.spills.length === 0) {
        return { message: format(outcome.blockedMessage), damageToCaster: 0 };
      }
      const cell = engine.prng.choice(neighbors);
      const spill = engine.prng.choice(outcome.spills);
      if (spill.gas) {
        engine.surfaces.setGas(cell.x, cell.y, spill.gas as Parameters<typeof engine.surfaces.setGas>[2], spill.duration, spill.potency);
      } else if (spill.surface) {
        engine.surfaces.setSurface(cell.x, cell.y, spill.surface, spill.duration, spill.potency);
      }
      return { message: format(spill.message), damageToCaster: 0 };
    }
    case 'backlash': {
      const damage = hurt(Math.max(outcome.minDamage, Math.floor(deficit * outcome.deficitMultiplier)), outcome.flashColor);
      values.damage = damage;
      return { message: format(outcome.message), damageToCaster: damage };
    }
    case 'status': {
      caster.statusManager.applyStatus(
        { type: outcome.statusId, duration: outcome.duration, potency: 1 },
        caster.statusImmunities,
        caster,
        engine
      );
      return { message: format(outcome.message), damageToCaster: 0 };
    }
    case 'surface_under_caster': {
      engine.surfaces?.setSurface(caster.x, caster.y, outcome.surface, outcome.duration, outcome.potency);
      return { message: format(outcome.message), damageToCaster: 0 };
    }
    case 'max_hp_burn': {
      if (player && player.maxHp - outcome.amount >= outcome.minMaxHp) {
        player.maxHp = player.baseMaxHpValue - outcome.amount;
        player.hp = Math.min(player.hp, player.maxHp);
        values.maxHp = player.maxHp;
        if (outcome.flashColor) effects.push({ type: 'screen_flash', color: outcome.flashColor, durationMs: 300 });
        return { message: format(outcome.message), damageToCaster: 0 };
      }
      const damage = hurt(outcome.fallbackDamage, outcome.flashColor);
      values.damage = damage;
      return { message: format(outcome.fallbackMessage), damageToCaster: damage };
    }
    case 'displace': {
      const cells: Array<{ x: number; y: number }> = [];
      for (let dy = -outcome.radius; dy <= outcome.radius; dy++) {
        for (let dx = -outcome.radius; dx <= outcome.radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) < 2) continue;
          const tx = caster.x + dx;
          const ty = caster.y + dy;
          if (engine.map.inBounds(tx, ty) && engine.map.isPassable(tx, ty) && !engine.map.getEntityAt(tx, ty)) {
            cells.push({ x: tx, y: ty });
          }
        }
      }
      if (cells.length === 0) return { message: format(outcome.blockedMessage), damageToCaster: 0 };
      const dest = engine.prng.choice(cells);
      engine.map.moveEntity(caster, dest.x, dest.y);
      if (player) engine.updateFov();
      return { message: format(outcome.message), damageToCaster: 0 };
    }
    case 'message':
      return { message: format(outcome.message), damageToCaster: 0 };
  }
}
