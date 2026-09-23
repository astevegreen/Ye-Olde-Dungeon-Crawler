import type { Action } from './action';
import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import { Player } from '../entities/player';
import { getSpell } from '../magic/spellRegistry';
import { SpellPipeline } from '../magic/spellPipeline';
import { WandItem, ScrollItem, PotionItem } from '../items/consumables';
import { flightRecorder } from '../debug/flightRecorder';
import { findTaggedEntitiesInRadius } from '../combat/radialAuraFilter';
import { traceProjectile } from '../magic/targeting';

export class CastSpellAction implements Action {
  public readonly caster: Entity;
  public readonly spellId: string;
  public readonly targetX: number;
  public readonly targetY: number;
  public readonly itemTargetId?: string;
  public readonly freeCast: boolean;
  public readonly allowVitalityBurn: boolean;

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
    const spell = engine.manifest?.spells?.find((s) => s.id === this.spellId) ?? getSpell(this.spellId);
    if (!spell) {
      return { success: false, cost: 0, message: `Unknown spell: ${this.spellId}` };
    }

    const isPlayer = this.caster instanceof Player;
    const player = isPlayer ? (this.caster as Player) : null;

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

    let manaDiscount = 0;
    if (player?.inventory?.paperdoll) {
      for (const item of player.inventory.paperdoll.getEquippedItems()) {
        if (!item.isBroken() && item.modifiers) {
          for (const mod of item.modifiers) {
            if (mod.manaCostDiscount) {
              manaDiscount += mod.manaCostDiscount;
            }
          }
        }
      }
    }
    const effectiveManaCost = Math.max(0, spell.manaCost - manaDiscount);

    // Validate every cost (mana, volatile energy, vitality) before paying any of them,
    // so a cast rejected on its second cost never leaves the first one spent.
    const paysCosts = player !== null && !this.freeCast;
    const volatileCost = paysCosts ? (spell.volatileEnergyCost ?? 0) : 0;
    const vitalityCost = paysCosts ? (spell.vitalityCost ?? 0) : 0;
    let emergencyHpBurn = 0;
    if (player && paysCosts) {
      if (effectiveManaCost > 0 && player.mana < effectiveManaCost) {
        return {
          success: false,
          cost: 0,
          message: `Not enough mana to cast ${spell.name}! (Requires ${effectiveManaCost} MP, have ${player.mana})`,
        };
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
    }

    let pendingCorruption = 0;
    if (player && paysCosts) {
      if (effectiveManaCost > 0) {
        player.consumeMana(effectiveManaCost);
      }

      if (volatileCost > 0) {
        const energyModel = player.energyModel ?? player.initEnergyModel();
        if (emergencyHpBurn > 0) {
          energyModel.burnVitalityTender(player, emergencyHpBurn, 0);
          energyModel.volatileEnergy = 0;
          pendingCorruption += (spell.corruptionGain ?? volatileCost) + emergencyHpBurn;
          engine.log(
            `🩸 Volatile Energy depleted! You burn ${emergencyHpBurn} permanent Max HP as emergency power to cast ${spell.name}! (Max HP: ${player.maxHp})`
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
        engine.log(`🩸 You burn ${vitalityCost} permanent Max HP to fuel ${spell.name}! (Max HP: ${player.maxHp})`);
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

    const actionCost = this.caster.getActionCost(100);
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
      actionCost
    );

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
          `🩸 ${player.name} finishes off ${targetEntity?.name ?? 'the victim'} from close range, reaping their vital essence into +${spell.volatileEnergyGain} Volatile Energy (${player.energyModel.volatileEnergy}/${player.energyModel.maxVolatileEnergy})!`
        );
      } else if (targetEntity) {
        engine.log(
          `${targetEntity.name} clung to life! No volatile energy could be harvested.`
        );
      }
    }

    if (player && player.energyModel && pendingCorruption > 0) {
      player.energyModel.addCorruption(player, pendingCorruption);
      engine.log(`☠ Casting ${spell.name} surges with dark power (+${pendingCorruption} Corruption, Total: ${player.corruptionScore})!`);
    }

    return result;
  }
}

export class ZapWandAction implements Action {
  public readonly user: Actor;
  public readonly wand: WandItem;
  public readonly targetX: number;
  public readonly targetY: number;

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
    engine.identification?.identifyDefinition(this.wand.id);
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
    // Remove scroll from wherever it is (pack, belt, sub-containers)
    this.user.inventory.removeItem(this.scroll.id);

    this.scroll.identified = true;
    engine.identification?.identifyDefinition(this.scroll.id);
    if (this.user instanceof Player) {
      engine.log(`You read the ${this.scroll.displayName}. The parchment turns to ash in your hands!`);
    } else {
      engine.log(`${this.user.name} reads the ${this.scroll.displayName}. The parchment turns to ash!`);
    }

    const castAction = new CastSpellAction(
      this.user,
      this.scroll.spellId,
      this.targetX,
      this.targetY,
      this.itemTargetId,
      true
    );
    return castAction.perform(engine);
  }
}

export class DrinkPotionAction implements Action {
  public readonly user: Actor;
  public readonly potion: PotionItem;

  constructor(user: Actor, potion: PotionItem) {
    this.user = user;
    this.potion = potion;
  }

  public perform(engine: GameEngine): ActionResult {
    this.potion.identified = true;
    engine.identification?.identifyDefinition(this.potion.id);

    // Remove potion from wherever it is (pack, belt, sub-containers)
    this.user.inventory.removeItem(this.potion.id);

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
            messages.push(`restoring ${restored} Mana (${this.user.mana}/${this.user.maxMana})`);
          }
          break;
        }
        case 'cure_status': {
          this.user.statusManager.removeStatus(effect.status);
          messages.push(`purging ${effect.status}`);
          break;
        }
        case 'apply_status': {
          this.user.statusManager.applyStatus(effect.status, effect.duration, effect.potency ?? 1);
          messages.push(`gaining ${effect.status} for ${effect.duration} turns`);
          break;
        }
        case 'gain_xp': {
          if (this.user instanceof Player) {
            this.user.gainXp(effect.amount);
            messages.push(`gaining ${effect.amount} XP`);
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
      ? `You drink the ${this.potion.displayName}${detailMsg}`
      : `${this.user.name} drinks the ${this.potion.displayName}${detailMsg}`;
    engine.log(finalMsg);
    return { success: true, cost: actionCost, message: finalMsg };
  }
}
