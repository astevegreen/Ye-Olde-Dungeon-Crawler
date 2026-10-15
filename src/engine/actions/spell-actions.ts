import { resolveManaTerms } from '../types/manifest';
import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { GameEngine } from '../engine';
import { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import { Player } from '../entities/player';
import { getSpell } from '../magic/spellRegistry';
import { SpellPipeline, type CastShaping } from '../magic/spellPipeline';
import { pickMaterial, type ResolvedCast } from '../magic/neighbourLending';
import { WandItem, ScrollItem, PotionItem } from '../items/consumables';
import { flightRecorder } from '../debug/flightRecorder';
import { awardPlayerXp } from '../combat/deathResolver';
import { findTaggedEntitiesInRadius } from '../combat/radialAuraFilter';
import { traceProjectile } from '../magic/targeting';
import { ManaOverflowManager, canOvercast } from '../magic/manaOverflow';
import { lowestWorn, sumWorn, wearsFlag } from '../items/wornModifiers';
import {
  castSlotStats,
  effectiveHpCost as effectiveHpCostOf,
  effectiveManaCost as effectiveManaCostOf,
  heroResolvedCast,
  withForgedElements,
  withSlotStats,
  withSpellRangeBonus,
} from '../magic/castNumbers';
import type { GrimoireAxis } from '../magic/magicConfig';
import { forgedTitle, type StatPickOutcome } from '../magic/grimoires';
import { forgeOfferElements, forgeRefusal } from '../magic/altars';
import { StatusHandlerRegistry } from '../status/statusHandlers';

/**
 * A resolved cast as the pipeline takes it: its own power, and what it borrowed. A terrain
 * spell takes one borrowed material per cast, at random.
 */
function castShaping(engine: GameEngine, cast: ResolvedCast): CastShaping {
  const powerMultiplier = cast.stats.powerMultiplier * cast.lentPowerMultiplier;
  if (!cast.delivery || cast.lends.length === 0) return { powerMultiplier };
  const lent = cast.delivery === 'material' ? [pickMaterial(cast, engine.prng.next())!] : cast.lends;
  return { powerMultiplier, lends: { delivery: cast.delivery, effects: lent.flatMap((l) => l.effects) } };
}

export class CastSpellAction implements Action {
  public readonly caster: Entity;
  public readonly spellId: string;
  public readonly targetX: number;
  public readonly targetY: number;
  public readonly itemTargetId?: string;
  public readonly freeCast: boolean;
  public readonly allowVitalityBurn: boolean;

  /** The acting entity, as the pipeline resolves it for hooks (§4). */
  get actor(): Entity {
    return this.caster;
  }

  constructor(
    caster: Entity,
    spellId: string,
    targetX: number,
    targetY: number,
    itemTargetId?: string,
    freeCast = false,
    allowVitalityBurn = false
  ) {
    this.caster = caster;
    this.spellId = spellId;
    this.targetX = targetX;
    this.targetY = targetY;
    this.itemTargetId = itemTargetId;
    this.freeCast = freeCast;
    this.allowVitalityBurn = allowVitalityBurn;
  }

  public perform(engine: GameEngine): ActionResult {
    const isPlayer = this.caster instanceof Player;
    const player = isPlayer ? (this.caster as Player) : null;

    let spell = engine.manifest?.spells?.find((s) => s.id === this.spellId) ?? getSpell(this.spellId);
    if (!spell) {
      return { success: false, cost: 0, message: `Unknown spell: ${this.spellId}` };
    }
    // The three grimoires (P-29, P-30): a hero casts a spell from its slot, whose stats shape
    // the spell's own effect while its neighbours lend theirs. Hook-driven free casts, scrolls
    // and wands stay unmodified.
    const resolved = player && !this.freeCast ? heroResolvedCast(engine, this.spellId) : undefined;
    if (player && !this.freeCast && player.grimoireSystem && !resolved) {
      return { success: false, cost: 0, message: `${spell.name} is in no grimoire slot. Place it in the spellbook to cast it.` };
    }
    if (resolved) spell = withForgedElements(withSlotStats(spell, resolved.stats), resolved.elements.slice(1));
    // Reach the caster wears and holds (Odin's Eye), as `resolveCast` shows it.
    spell = withSpellRangeBonus(this.caster, spell);

    // Wildfire: a damaging spell takes a random element of the pack's.
    if (wearsFlag(this.caster, 'randomSpellElement') && spell.element && spell.effects?.some((e) => e.type === 'damage')) {
      const elements = engine.affinityMatrix
        .getAllElements()
        .filter((e) => !e.excludeFromRandom)
        .map((e) => e.id)
        .filter((e) => e !== 'healing' && e !== 'physical');
      if (elements.length > 0) {
        const element = elements[Math.floor(engine.rng() * elements.length)];
        spell = { ...spell, element, effects: spell.effects.map((e) => ('element' in e && e.element ? { ...e, element } : e)) };
        engine.log(`Wildfire turns ${spell.name} to ${element}!`);
      }
    }

    // Find targeted entity if applicable
    let targetEntity = engine.map.getEntityAt(this.targetX, this.targetY);
    if (!targetEntity && (spell.targetingMode === 'ray' || spell.targetType === 'ray')) {
      const rayResult = traceProjectile(
        engine.map,
        this.caster.x,
        this.caster.y,
        this.targetX,
        this.targetY,
        spell.range,
        spell.reflects,
        this.caster.id
      );
      if (rayResult.hitEntityId) {
        targetEntity = engine.map.getEntityById(rayResult.hitEntityId);
      }
    }

    // Check near-death condition if required by spell (e.g. execution spells like Blood Reap)
    if (spell.maxTargetHpPercent !== undefined) {
      if (!targetEntity || !targetEntity.isAlive()) {
        return {
          success: false,
          cost: 0,
          message: `No living target found to reap!`,
        };
      }
      const maxHp = targetEntity.maxHp;
      const threshold = Math.max(10, Math.floor(maxHp * spell.maxTargetHpPercent));
      if (targetEntity.hp > threshold) {
        return {
          success: false,
          cost: 0,
          message: `${targetEntity.name} is too healthy to reap! The victim must be near death (<= ${Math.round(spell.maxTargetHpPercent * 100)}% HP).`,
        };
      }
    }

    // What the caster wears, and a hero's perks (`effectiveManaCost`, which the HUD reads too).
    const effectiveManaCost = player ? effectiveManaCostOf(player, spell) : spell.manaCost;

    // Validate every cost (mana, volatile energy, vitality) before paying any of them,
    // so a cast rejected on its second cost never leaves the first one spent.
    const paysCosts = player !== null && !this.freeCast;
    const volatileCost = paysCosts ? (spell.volatileEnergyCost ?? 0) : 0;
    const vitalityCost = paysCosts ? (spell.vitalityCost ?? 0) : 0;
    const hpCost = player && paysCosts ? effectiveHpCostOf(player, spell, resolved?.lentHpCost) : 0;
    let emergencyHpBurn = 0;
    let manaDeficit = 0;
    if (player && paysCosts) {
      if (effectiveManaCost > 0 && player.mana < effectiveManaCost) {
        if (!canOvercast(engine)) {
          return {
            success: false,
            cost: 0,
            message: `Not enough ${resolveManaTerms(engine.manifest).name} to cast ${spell.name}! (Requires ${effectiveManaCost} ${resolveManaTerms(engine.manifest).unit}, have ${player.mana})`,
          };
        }
        manaDeficit = effectiveManaCost - player.mana;
      }
      const volatileAvailable = player.energyModel?.volatileEnergy ?? 0;
      if (volatileCost > 0 && volatileAvailable < volatileCost) {
        if (!this.allowVitalityBurn) {
          return {
            success: false,
            cost: 0,
            message: `Not enough Volatile Energy to cast ${spell.name}! (Requires ${volatileCost}, have ${volatileAvailable}). You can burn Vitality Tender for emergency power.`,
          };
        }
        emergencyHpBurn = Math.max(2, Math.ceil((volatileCost - volatileAvailable) / 5));
      }
      if (player.maxHp <= emergencyHpBurn + vitalityCost) {
        return {
          success: false,
          cost: 0,
          message: `Cannot cast ${spell.name}: insufficient vitality to burn without perishing!`,
        };
      }
      // A blood price is paid from current HP, and never with the last of it.
      if (hpCost > 0 && player.hp <= hpCost) {
        return {
          success: false,
          cost: 0,
          message: `Not enough life to cast ${spell.name}! (Requires ${hpCost} HP, have ${player.hp})`,
        };
      }
    }

    let pendingCorruption = 0;
    if (player && paysCosts) {
      if (effectiveManaCost > 0) {
        if (manaDeficit > 0) {
          player.consumeMana(player.mana);
        } else {
          player.consumeMana(effectiveManaCost);
        }
      }

      if (volatileCost > 0) {
        const energyModel = player.energyModel ?? player.initEnergyModel();
        if (emergencyHpBurn > 0) {
          energyModel.burnVitalityTender(player, emergencyHpBurn, 0);
          energyModel.volatileEnergy = 0;
          pendingCorruption += (spell.corruptionGain ?? volatileCost) + emergencyHpBurn;
          engine.log(
            `Volatile Energy depleted! You burn ${emergencyHpBurn} permanent Max HP as emergency power to cast ${spell.name}! (Max HP: ${player.maxHp})`
          );
        } else {
          energyModel.volatileEnergy -= volatileCost;
          pendingCorruption += spell.corruptionGain ?? volatileCost;
        }
      }

      if (vitalityCost > 0) {
        const energyModel = player.energyModel ?? player.initEnergyModel();
        energyModel.burnVitalityTender(player, vitalityCost, 0);
        pendingCorruption += spell.corruptionGain ?? vitalityCost;
        engine.log(`You burn ${vitalityCost} permanent Max HP to fuel ${spell.name}! (Max HP: ${player.maxHp})`);
      }

      if (hpCost > 0) {
        player.hp -= hpCost;
        engine.log(`You pay ${hpCost} HP in blood to cast ${spell.name}. (HP: ${player.hp}/${player.maxHp})`);
      }

      if (spell.volatileEnergyGain && spell.volatileEnergyGain > 0 && !spell.requiresKillForEnergy) {
        const energyModel = player.energyModel ?? player.initEnergyModel();
        energyModel.volatileEnergy = Math.min(
          energyModel.maxVolatileEnergy,
          energyModel.volatileEnergy + spell.volatileEnergyGain
        );
        if (spell.corruptionGain && (!spell.volatileEnergyCost || spell.volatileEnergyCost <= 0)) {
          pendingCorruption += spell.corruptionGain;
        }
      }
    }

    // Swift: a hero's cast from a slot with it takes a share of a turn. Statuses still tick
    // once per action, as under haste.
    const castTime = player && !this.freeCast ? castSlotStats(player, spell.id).castTimeFraction : 1;
    const actionCost = Math.max(1, Math.round(this.caster.getActionCost(100) * castTime));
    this.caster.consumeEnergy(actionCost);

    flightRecorder.recordSpell(
      this.caster.name,
      spell.name,
      { x: this.targetX, y: this.targetY },
      spell.element
    );

    const result = SpellPipeline.executeSpell(
      engine,
      spell,
      this.caster,
      { x: this.targetX, y: this.targetY },
      this.itemTargetId,
      actionCost,
      resolved ? castShaping(engine, resolved) : undefined
    );

    // A cast paid partly from debt rolls a surge from the pack's overflow table
    if (player && paysCosts && manaDeficit > 0) {
      const overflowRes = ManaOverflowManager.evaluateOverflow(engine, this.caster, manaDeficit, {
        accrueDebt: !wearsFlag(player, 'overflowNoDebt'),
        tierShift: sumWorn(player, 'overflowTierShift'),
        tierShiftCap: lowestWorn(player, 'overflowTierShiftCap'),
      });
      if (overflowRes.effects.length > 0) {
        result.effects = [...(result.effects ?? []), ...overflowRes.effects];
      }
    }

    // If spell requires killing the target to harvest volatile energy (e.g. Blood Reap)
    if (player && player.energyModel && spell.requiresKillForEnergy && spell.volatileEnergyGain) {
      const isDead = targetEntity ? !targetEntity.isAlive() : false;
      if (isDead && player.energyModel) {
        player.energyModel.volatileEnergy = Math.min(
          player.energyModel.maxVolatileEnergy,
          player.energyModel.volatileEnergy + spell.volatileEnergyGain
        );
        if (spell.corruptionGain && (!spell.volatileEnergyCost || spell.volatileEnergyCost <= 0)) {
          pendingCorruption += spell.corruptionGain;
        }
        engine.log(
          `${player.name} finishes off ${targetEntity?.name ?? 'the victim'} from close range, reaping their vital essence into +${spell.volatileEnergyGain} Volatile Energy (${player.energyModel.volatileEnergy}/${player.energyModel.maxVolatileEnergy})!`
        );
      } else if (targetEntity) {
        engine.log(
          `${targetEntity.name} clung to life! No volatile energy could be harvested.`
        );
      }
    }

    if (player && player.energyModel && pendingCorruption > 0) {
      player.energyModel.addCorruption(player, pendingCorruption);
      engine.log(`Casting ${spell.name} surges with dark power (+${pendingCorruption} Corruption, Total: ${player.corruptionScore})!`);
    }

    return result;
  }
}

export class ZapWandAction implements Action {
  public readonly user: Actor;
  public readonly wand: WandItem;
  public readonly targetX: number;
  public readonly targetY: number;

  /** The acting entity, as the pipeline resolves it for hooks (§4). */
  get actor(): Actor {
    return this.user;
  }

  constructor(user: Actor, wand: WandItem, targetX: number, targetY: number) {
    this.user = user;
    this.wand = wand;
    this.targetX = targetX;
    this.targetY = targetY;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.wand.canZap()) {
      const msg = `The ${this.wand.name} is depleted of charges and produces only a faint fizzle.`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    this.wand.useCharge();
    this.wand.identified = true;
    if (this.user instanceof Player) {
      engine.log(`You zap the ${this.wand.displayName}!`);
    } else {
      engine.log(`${this.user.name} zaps the ${this.wand.displayName}!`);
    }

    // Cast wand's spell directly with 0 mana cost
    const castAction = new CastSpellAction(
      this.user,
      this.wand.spellId,
      this.targetX,
      this.targetY,
      undefined,
      true
    );
    return castAction.perform(engine);
  }
}

export class ReadScrollAction implements Action {
  public readonly user: Actor;
  public readonly scroll: ScrollItem;
  public readonly targetX: number;
  public readonly targetY: number;
  public readonly itemTargetId?: string;

  /** The acting entity, as the pipeline resolves it for hooks (§4). */
  get actor(): Actor {
    return this.user;
  }

  constructor(
    user: Actor,
    scroll: ScrollItem,
    targetX = 0,
    targetY = 0,
    itemTargetId?: string
  ) {
    this.user = user;
    this.scroll = scroll;
    this.targetX = targetX;
    this.targetY = targetY;
    this.itemTargetId = itemTargetId;
  }

  public perform(engine: GameEngine): ActionResult {
    this.scroll.identified = true;
    const name = this.scroll.unitDisplayName;
    const isPlayer = this.user instanceof Player;
    engine.log(isPlayer ? `You read the ${name}.` : `${this.user.name} reads the ${name}.`);

    const castAction = new CastSpellAction(
      this.user,
      this.scroll.spellId,
      this.targetX,
      this.targetY,
      this.itemTargetId,
      true
    );
    const result = castAction.perform(engine);
    // Only a cast that takes spends the scroll, and only one of a stack.
    if (!result.success) return result;
    this.user.inventory.consumeOne(this.scroll.id);
    engine.log(isPlayer ? 'The parchment turns to ash in your hands!' : 'The parchment turns to ash!');
    return result;
  }
}

export class DrinkPotionAction implements Action {
  public readonly user: Actor;
  public readonly potion: PotionItem;

  /** The acting entity, as the pipeline resolves it for hooks (§4). */
  get actor(): Actor {
    return this.user;
  }

  constructor(user: Actor, potion: PotionItem) {
    this.user = user;
    this.potion = potion;
  }

  public perform(engine: GameEngine): ActionResult {
    // A draught that can only grant levels is refused, and kept, once there are none to grant.
    if (
      this.user instanceof Player &&
      this.user.isAtLevelCap &&
      this.potion.effects.length > 0 &&
      this.potion.effects.every((effect) => effect.type === 'gain_level')
    ) {
      return { success: false, cost: 0, message: `${this.user.name} is already at the height of their power; the draught would be wasted.` };
    }

    this.potion.identified = true;

    // One draught of a stack; a single bottle leaves the inventory.
    this.user.inventory.consumeOne(this.potion.id);

    const actionCost = this.user.getActionCost(100);
    this.user.consumeEnergy(actionCost);

    const messages: string[] = [];

    // Sequentially resolve all declarative consumable effects
    for (const effect of this.potion.effects) {
      switch (effect.type) {
        case 'restore_hp': {
          const amount = typeof effect.amount === 'number' ? effect.amount : parseInt(effect.amount, 10) || 20;
          const healed = this.user.heal(amount);
          messages.push(`recovering ${healed} HP (${this.user.hp}/${this.user.maxHp})`);
          break;
        }
        case 'restore_mana': {
          const amount = typeof effect.amount === 'number' ? effect.amount : parseInt(effect.amount, 10) || 15;
          if (this.user instanceof Player) {
            const restored = this.user.restoreMana(amount);
            messages.push(`restoring ${restored} ${resolveManaTerms(engine.manifest).name} (${this.user.mana}/${this.user.maxMana})`);
          }
          break;
        }
        case 'cure_status': {
          if (effect.status === 'all') {
            // Every affliction (`StatusHandler.affliction`), not a status named "all".
            const afflictions = this.user.statusManager.getAll().filter((s) => StatusHandlerRegistry.get(s.type)?.affliction);
            for (const s of afflictions) this.user.statusManager.removeStatus(s.type);
            messages.push(afflictions.length ? `purging ${afflictions.map((s) => s.type).join(', ')}` : 'finding nothing to purge');
          } else {
            this.user.statusManager.removeStatus(effect.status);
            messages.push(`purging ${effect.status}`);
          }
          break;
        }
        case 'apply_status': {
          // Through the drinker, as every other path applies a status: its immunities (worn
          // ones too) refuse it, and the handler's `onApply` runs.
          const applied = this.user.statusManager.applyStatus(
            { type: effect.status, duration: effect.duration, potency: effect.potency ?? 1 },
            [],
            this.user,
            engine
          );
          messages.push(applied ? `gaining ${effect.status} for ${effect.duration} turns` : `shrugging off ${effect.status}`);
          break;
        }
        case 'gain_xp': {
          if (this.user instanceof Player) {
            // Through the one award path, so a level-up logs, toasts and emits like a kill's.
            awardPlayerXp(engine, effect.amount);
            messages.push(`gaining ${effect.amount} ${engine.manifest?.branding?.xpName ?? 'XP'}`);
          }
          break;
        }
        case 'gain_level': {
          if (this.user instanceof Player) {
            const from = this.user.level;
            for (let i = 0; i < (effect.levels ?? 1) && !this.user.isAtLevelCap; i++) {
              awardPlayerXp(engine, Math.max(1, this.user.xpToNextLevel - this.user.xp));
            }
            const gained = this.user.level - from;
            messages.push(gained > 0 ? `rising to level ${this.user.level}` : 'finding nothing left to rise to');
          }
          break;
        }
        case 'gain_stat': {
          // Previously called a `modifyAttribute` method no entity defines, so the
          // effect silently did nothing. Applies to the player's core attributes.
          if (this.user instanceof Player) {
            this.user[effect.stat] += effect.amount;
            messages.push(`increasing ${effect.stat} by ${effect.amount}`);
          }
          break;
        }
        case 'teleport': {
          SpellPipeline.teleportEntity(engine, this.user, effect.range ?? 6, effect.random ?? true);
          messages.push(`teleporting through space`);
          break;
        }
        case 'radial_status': {
          const targets = findTaggedEntitiesInRadius(
            engine,
            { x: this.user.x, y: this.user.y },
            effect.radius,
            effect.tags
          );
          let affected = 0;
          for (const target of targets) {
            // Everyone in range but the user, allies included (the hero's companion), as a
            // spell burst's friendly fire.
            if (target.id === this.user.id) continue;
            const applied = target.statusManager.applyStatus(
              { type: effect.status, duration: effect.duration, potency: effect.potency },
              target.statusImmunities,
              target,
              engine
            );
            if (applied) affected++;
          }
          if (affected > 0) {
            messages.push(`afflicting ${affected} nearby ${effect.tags.join('/')} creature(s) with ${effect.status}`);
          }
          break;
        }
        case 'release_gas': {
          const r = effect.radius;
          for (let y = this.user.y - r; y <= this.user.y + r; y++) {
            for (let x = this.user.x - r; x <= this.user.x + r; x++) {
              if (Math.hypot(x - this.user.x, y - this.user.y) > r + 0.5 || !engine.map.isPassable(x, y)) continue;
              engine.surfaces.setGas(x, y, effect.gas, effect.duration);
            }
          }
          messages.push(`releasing a cloud of ${effect.gas.replace(/_/g, ' ')}`);
          break;
        }
        case 'restore_volatile_energy': {
          const energyModel = this.user instanceof Player ? this.user.energyModel : undefined;
          if (energyModel) {
            const prev = energyModel.volatileEnergy;
            energyModel.volatileEnergy =
              effect.amount === 'full' || effect.amount === undefined
                ? energyModel.maxVolatileEnergy
                : Math.min(energyModel.maxVolatileEnergy, energyModel.volatileEnergy + effect.amount);
            const gained = energyModel.volatileEnergy - prev;
            messages.push(
              `surging with volatile energy (+${gained}, ${energyModel.volatileEnergy}/${energyModel.maxVolatileEnergy})`
            );
          }
          break;
        }
      }
    }

    const detailMsg = messages.length > 0 ? `: ${messages.join(', ')}.` : '.';
    const isPlayer = this.user instanceof Player;
    const finalMsg = isPlayer
      ? `You drink the ${this.potion.unitDisplayName}${detailMsg}`
      : `${this.user.name} drinks the ${this.potion.unitDisplayName}${detailMsg}`;
    engine.log(finalMsg);
    return { success: true, cost: actionCost, message: finalMsg };
  }
}

/** Whether the hero can rearrange the grimoires without spending a turn: in town, or with no foe in view. */
function canEditGrimoireFreely(engine: GameEngine, player: Player): boolean {
  if (engine.currentFloor === 0) return true;
  return !engine.map.getAllEntities().some((e) => e.isAlive() && e.isHostileTo(player) && engine.fov.isVisible(e.x, e.y));
}

/** A grimoire edit is free in town or with no foe in view, and takes a turn otherwise. */
function grimoireEditCost(engine: GameEngine, player: Player, inFightMessage: string): ActionResult {
  if (canEditGrimoireFreely(engine, player)) return { success: true, cost: 0 };
  const cost = player.getActionCost(BASE_ACTION_COST);
  player.consumeEnergy(cost);
  engine.log(inFightMessage);
  return { success: true, cost, message: inFightMessage };
}

/**
 * Places a known spell in a slot of an open grimoire, under the three-grimoire model
 * (`Player.placeGrimoireSpell`): placing it again moves it, and a spell already in the
 * slot swaps into its old one.
 */
export class PlaceGrimoireSpellAction implements Action {
  public readonly player: Player;
  public readonly spellId: string;
  public readonly grimoireId: string;
  public readonly x: number;
  public readonly y: number;

  get actor(): Entity {
    return this.player;
  }

  constructor(player: Player, spellId: string, grimoireId: string, x: number, y: number) {
    this.player = player;
    this.spellId = spellId;
    this.grimoireId = grimoireId;
    this.x = x;
    this.y = y;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) return { success: false, cost: 0, message: 'The dead write nothing in their grimoire.' };
    if (!this.player.placeGrimoireSpell(this.spellId, { grimoireId: this.grimoireId, x: this.x, y: this.y })) {
      return { success: false, cost: 0, message: 'That slot cannot take that spell.' };
    }
    return grimoireEditCost(engine, this.player, 'With foes in sight, rewriting your grimoire takes a turn.');
  }
}

/** Forgets a known spell for the rest of the run (`Player.forgetSpell`). */
export class ForgetSpellAction implements Action {
  public readonly player: Player;
  public readonly spellId: string;

  get actor(): Entity {
    return this.player;
  }

  constructor(player: Player, spellId: string) {
    this.player = player;
    this.spellId = spellId;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) return { success: false, cost: 0, message: 'The dead forget nothing more.' };
    if (!this.player.spellsKnown.includes(this.spellId)) return { success: false, cost: 0, message: 'You do not know that spell.' };
    this.player.forgetSpell(this.spellId);
    return grimoireEditCost(engine, this.player, 'With foes in sight, letting a spell go takes a turn.');
  }
}

/**
 * Learns a spell the hero was offered while every slot was full, once one is free (the
 * placement card: forget one, then accept). Not now is simply not calling this.
 */
export class AcceptSpellOfferAction implements Action {
  public readonly player: Player;
  public readonly spellId: string;

  get actor(): Entity {
    return this.player;
  }

  constructor(player: Player, spellId: string) {
    this.player = player;
    this.spellId = spellId;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) return { success: false, cost: 0, message: 'The dead learn nothing more.' };
    if (!this.player.pendingSpellOffers.includes(this.spellId)) return { success: false, cost: 0, message: 'No one is offering you that spell.' };
    const result = this.player.learnSpellResult(this.spellId);
    if (result.outcome !== 'learned') return { success: false, cost: 0, message: 'Every slot is still full. Forget a spell to make room.' };
    const name = engine.manifest?.spells?.find((s) => s.id === this.spellId)?.name ?? this.spellId;
    engine.log(`You have learned ${name}!`);
    return grimoireEditCost(engine, this.player, 'With foes in sight, learning a spell takes a turn.');
  }
}

/**
 * Claims a free forge a choice offered (Ivalda's, Skuld's): `element` onto a known spell,
 * the offer's own element when it fixes one. Not now is simply not calling this.
 */
export class ClaimForgeOfferAction implements Action {
  public readonly player: Player;
  /** The offer's place in `Player.pendingForgeOffers`. */
  public readonly offerIndex: number;
  public readonly spellId: string;
  public readonly element: string;

  get actor(): Entity {
    return this.player;
  }

  constructor(player: Player, offerIndex: number, spellId: string, element: string) {
    this.player = player;
    this.offerIndex = offerIndex;
    this.spellId = spellId;
    this.element = element;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) return { success: false, cost: 0, message: 'The dead forge nothing more.' };
    const offer = this.player.pendingForgeOffers[this.offerIndex];
    if (!offer) return { success: false, cost: 0, message: 'No one is offering you a forge.' };
    if (!forgeOfferElements(engine, offer).includes(this.element)) return { success: false, cost: 0, message: `This forge cannot add ${this.element}.` };
    const refusal = forgeRefusal(engine, this.player, this.spellId, this.element);
    if (refusal) return { success: false, cost: 0, message: refusal };
    this.player.takeForgeOffer(this.offerIndex);
    this.player.forgeSpell(this.spellId, this.element, offer.fated);
    const spell = engine.manifest?.spells?.find((s) => s.id === this.spellId) ?? getSpell(this.spellId);
    if (spell) engine.log(`${offer.source}: ${spell.name} is now ${forgedTitle(this.player.grimoireSystem!, this.player.grimoireState!, spell)}.`);
    return grimoireEditCost(engine, this.player, 'With foes in sight, forging a spell takes a turn.');
  }
}

/**
 * Picks the stat for a grimoire axis that has none yet: Máni's first at the start of the run,
 * each other grimoire's when it opens. Free; changing a picked stat is a service, not this.
 */
export class PickGrimoireStatAction implements Action {
  public readonly player: Player;
  public readonly grimoireId: string;
  public readonly axis: GrimoireAxis;
  public readonly statId: string;

  get actor(): Entity {
    return this.player;
  }

  constructor(player: Player, grimoireId: string, axis: GrimoireAxis, statId: string) {
    this.player = player;
    this.grimoireId = grimoireId;
    this.axis = axis;
    this.statId = statId;
  }

  public perform(): ActionResult {
    const outcome = this.player.assignGrimoireStat(this.grimoireId, this.axis, this.statId);
    return outcome === 'ok' ? { success: true, cost: 0 } : { success: false, cost: 0, message: STAT_PICK_REFUSALS[outcome] };
  }
}

const STAT_PICK_REFUSALS: Record<Exclude<StatPickOutcome, 'ok'>, string> = {
  'unknown-grimoire': 'There is no such grimoire.',
  closed: 'That grimoire has not opened yet.',
  'unknown-stat': 'There is no such stat.',
  'no-axis': 'No slot of that grimoire reaches along that axis.',
  'stat-in-use': 'That stat already sits on another axis.',
  'already-picked': 'That axis already has its stat.',
  'axis-unpicked': 'Choose a stat for every axis of that grimoire.',
};
