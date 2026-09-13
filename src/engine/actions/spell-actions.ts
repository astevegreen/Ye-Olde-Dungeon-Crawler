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

export class CastSpellAction implements Action {
  public readonly caster: Entity;
  public readonly spellId: string;
  public readonly targetX: number;
  public readonly targetY: number;
  public readonly itemTargetId?: string;
  public readonly freeCast: boolean;

  constructor(
    caster: Entity,
    spellId: string,
    targetX: number,
    targetY: number,
    itemTargetId?: string,
    freeCast = false
  ) {
    this.caster = caster;
    this.spellId = spellId;
    this.targetX = targetX;
    this.targetY = targetY;
    this.itemTargetId = itemTargetId;
    this.freeCast = freeCast;
  }

  public perform(engine: GameEngine): ActionResult {
    const spell = engine.manifest?.spells?.find((s) => s.id === this.spellId) ?? getSpell(this.spellId);
    if (!spell) {
      return { success: false, cost: 0, message: `Unknown spell: ${this.spellId}` };
    }

    const isPlayer = this.caster instanceof Player;
    const player = isPlayer ? (this.caster as Player) : null;

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

    // Check mana cost for player (unless free cast via wand or scroll)
    if (player && !this.freeCast && effectiveManaCost > 0) {
      if (player.mana < effectiveManaCost) {
        return {
          success: false,
          cost: 0,
          message: `Not enough mana to cast ${spell.name}! (Requires ${effectiveManaCost} MP, have ${player.mana})`,
        };
      }
      player.consumeMana(effectiveManaCost);
    }

    const actionCost = this.caster.getActionCost(100);
    this.caster.consumeEnergy(actionCost);

    flightRecorder.recordSpell(
      this.caster.name,
      spell.name,
      { x: this.targetX, y: this.targetY },
      spell.element
    );

    return SpellPipeline.executeSpell(
      engine,
      spell,
      this.caster,
      { x: this.targetX, y: this.targetY },
      this.itemTargetId,
      actionCost
    );
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
          if ('restoreMana' in this.user && typeof (this.user as any).restoreMana === 'function') {
            const restored = (this.user as any).restoreMana(amount);
            messages.push(`restoring ${restored} Mana (${(this.user as any).mana}/${(this.user as any).maxMana})`);
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
          if ('gainXp' in this.user && typeof (this.user as any).gainXp === 'function') {
            (this.user as any).gainXp(effect.amount);
            messages.push(`gaining ${effect.amount} XP`);
          }
          break;
        }
        case 'gain_stat': {
          if ((this.user as any).modifyAttribute) {
            (this.user as any).modifyAttribute(effect.stat, effect.amount);
            messages.push(`increasing ${effect.stat} by ${effect.amount}`);
          }
          break;
        }
        case 'teleport': {
          SpellPipeline.teleportEntity(engine, this.user, effect.range ?? 6, effect.random ?? true);
          messages.push(`teleporting through space`);
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
