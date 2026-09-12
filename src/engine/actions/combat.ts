import type { ActionResult, Position } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { Player } from '../entities/player';
import { calculateElementalDamage } from '../magic/elements';
import type { GameEngine } from '../engine';
import type { Action } from './action';
import { DeathResolver } from '../combat/deathResolver';
import { flightRecorder } from '../debug/flightRecorder';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { applyImpulse } from '../combat/impulse';
import { resolveCombatMitigation } from '../combat/mitigationPipeline';

export class MeleeAttackAction implements Action {
  public readonly attacker: Entity;
  public readonly defender: Entity;

  constructor(attacker: Entity, defender: Entity) {
    this.attacker = attacker;
    this.defender = defender;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.attacker.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: `${this.attacker.name} is incapacitated and cannot attack.`,
      };
    }

    if (!this.defender.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: `${this.defender.name} is already defeated.`,
      };
    }

    // Slayer's Compendium Defensive Mastery Evasion Check (+5% evasion if mastered)
    if (this.attacker instanceof Monster && this.defender instanceof Player && engine.compendium) {
      const evasionBonus = engine.compendium.getMasteryEvasionBonus(this.attacker.definitionId);
      if (evasionBonus > 0 && engine.rng() < evasionBonus) {
        const cost = this.attacker.getActionCost(BASE_ACTION_COST);
        this.attacker.consumeEnergy(cost);
        const evadeMsg = `${this.defender.name} anticipates ${this.attacker.name}'s attack and evades cleanly! (Mastery Perk)`;
        engine.log(evadeMsg);
        return {
          success: true,
          cost,
          message: evadeMsg,
        };
      }
    }

    // Slayer's Compendium Offensive Mastery (+1 flat damage against mastered monsters)
    let masteryBonus = 0;
    if (this.attacker instanceof Player && this.defender instanceof Monster && engine.compendium) {
      masteryBonus = engine.compendium.getMasteryDamageBonus(this.defender.definitionId);
    }

    // Damage calculation: manifest combatConfig or default formula
    const combatConfig = engine.manifest?.combatConfig;
    let rawDamage: number;
    let isCrit = false;

    if (combatConfig?.calculateDamage) {
      const custom = combatConfig.calculateDamage(this.attacker, this.defender, engine);
      rawDamage = Math.max(combatConfig.minDamage ?? 1, custom.damage);
      isCrit = custom.isCrit ?? false;
    } else {
      const minDmg = combatConfig?.minDamage ?? 1;
      let base = Math.max(minDmg, this.attacker.attack + masteryBonus - this.defender.defense);

      // Critical strike calculation
      if (combatConfig?.critChance && engine.rng() < combatConfig.critChance) {
        isCrit = true;
        const mult = combatConfig.critMultiplier ?? 1.5;
        base = Math.max(minDmg, Math.round(base * mult));
      }

      // Damage variance calculation
      if (combatConfig?.damageVariance && combatConfig.damageVariance > 0) {
        const v = combatConfig.damageVariance;
        const factor = 1 + (engine.rng() * 2 * v - v);
        base = Math.max(minDmg, Math.round(base * factor));
      }

      rawDamage = base;
    }

    // Resolve combat mitigation pipeline (aspect alignment & item durability wear)
    const mitigation = resolveCombatMitigation(this.attacker, this.defender, rawDamage, engine);
    const { damageDealt, killed } = this.defender.takeDamage(mitigation.finalDamage);

    const cost = this.attacker.getActionCost(BASE_ACTION_COST);
    this.attacker.consumeEnergy(cost);

    flightRecorder.recordCombat(this.attacker.name, this.defender.name, damageDealt, killed);

    const perkNote = masteryBonus > 0 ? ' (+1 Mastery Perk)' : '';
    const critPrefix = isCrit ? '*** CRITICAL HIT! *** ' : '';
    let message = `${critPrefix}${this.attacker.name} attacks ${this.defender.name} for ${damageDealt} damage.${perkNote}`;
    engine.log(message);

    // Dispatch Hook Engine Events: onHit, onBlock, onDamageTaken
    const blockedDamage = Math.max(0, this.defender.defense);
    if (blockedDamage > 0) {
      HookDispatcher.dispatch('onBlock', {
        engine,
        attacker: this.attacker,
        defender: this.defender,
        damage: damageDealt,
        blockedDamage,
      });
    }

    HookDispatcher.dispatch('onHit', {
      engine,
      attacker: this.attacker,
      defender: this.defender,
      damage: damageDealt,
      blockedDamage,
      dx: this.defender.x - this.attacker.x,
      dy: this.defender.y - this.attacker.y,
    });

    if (damageDealt > 0) {
      HookDispatcher.dispatch('onDamageTaken', {
        engine,
        attacker: this.attacker,
        defender: this.defender,
        damage: damageDealt,
      });
    }

    // On-hit status affliction (e.g. Giant Rat venomous bite)
    if (this.attacker instanceof Monster && this.attacker.onHitAffliction && !killed) {
      const aff = this.attacker.onHitAffliction;
      if (engine.rng() < aff.chance) {
        const applied = this.defender.statusManager.applyStatus(
          {
            type: aff.type,
            duration: aff.duration,
            potency: aff.potency,
            sourceEntityId: this.attacker.id,
          },
          this.defender.statusImmunities,
          this.defender,
          engine
        );
        if (applied) {
          const affMsg = `${this.attacker.name}'s bite infects ${this.defender.name} with ${aff.type}!`;
          engine.log(affMsg);
        }
      }
    }

    let isFatal = killed;

    // Elemental Weapon Affix Bonus Damage (e.g. "of Fire", "of Cold", "of Lightning")
    if (this.attacker instanceof Player && !isFatal) {
      const weapon = this.attacker.inventory.paperdoll.getItem('mainHand');
      if (weapon?.elementalAffix) {
        const affix = weapon.elementalAffix;
        const affinity = this.defender.elementalResistances[affix.element] ?? 'neutral';
        const elemResult = calculateElementalDamage(affix.bonusDamage, affix.element, affinity);
        if (elemResult.finalDamage > 0) {
          const elemDmgRes = this.defender.takeDamage(elemResult.finalDamage);
          const elemMsg = `${this.attacker.name}'s ${weapon.name} bursts with ${affix.element} for ${elemDmgRes.damageDealt} bonus damage!`;
          engine.log(elemMsg);
          message += ` ${elemMsg}`;
          if (elemDmgRes.killed) {
            isFatal = true;
          }
          if (engine.surfaces) {
            engine.surfaces.triggerElementalReaction(this.defender.x, this.defender.y, affix.element, elemDmgRes.damageDealt, engine);
          }
        }
      }
    }

    if (isFatal) {
      message += ` ${this.defender.name} is slain!`;
      DeathResolver.resolveDeath(engine, this.attacker, this.defender);
    }

    return {
      success: true,
      cost,
      message,
    };
  }
}

export interface WindUpOptions {
  targetTiles?: Position[];
  pattern?: 'single' | 'line' | 'cone' | 'blast' | 'cross';
  turnsRemaining?: number;
  multiplier?: number;
  element?: import('../magic/elements').ElementType;
  spawnSurface?: import('../surfaces/surfaceGrid').SurfaceType;
  pushImpulse?: number;
}

export class WindUpDeclareAction implements Action {
  public readonly monster: Monster;
  public readonly targetTile: Position;
  public readonly abilityName: string;
  public readonly warningMessage: string;
  public readonly options?: WindUpOptions;

  constructor(
    monster: Monster,
    targetTile: Position,
    abilityName: string,
    warningMessage: string,
    options?: WindUpOptions
  ) {
    this.monster = monster;
    this.targetTile = targetTile;
    this.abilityName = abilityName;
    this.warningMessage = warningMessage;
    this.options = options;
  }

  public perform(engine: GameEngine): ActionResult {
    const rawDangerTiles = this.options?.targetTiles ?? (this.targetTile ? [this.targetTile] : []);
    const dangerTiles = rawDangerTiles.filter(
      (p): p is Position => Boolean(p && typeof p.x === 'number' && typeof p.y === 'number')
    );
    this.monster.intent = {
      type: 'windup',
      targetTile: this.targetTile ? { ...this.targetTile } : (dangerTiles[0] ? { ...dangerTiles[0] } : undefined),
      targetTiles: dangerTiles.map((p) => ({ ...p })),
      pattern: this.options?.pattern ?? 'single',
      abilityName: this.abilityName,
      warningMessage: this.warningMessage,
      turnsRemaining: this.options?.turnsRemaining ?? 1,
      multiplier: this.options?.multiplier ?? 2.2,
      element: this.options?.element,
      spawnSurface: this.options?.spawnSurface,
      pushImpulse: this.options?.pushImpulse,
    };
    const cost = this.monster.getActionCost(BASE_ACTION_COST);
    this.monster.consumeEnergy(cost);
    engine.log(this.warningMessage);
    return {
      success: true,
      cost,
      message: this.warningMessage,
    };
  }
}

export class WindUpExecuteAction implements Action {
  public readonly monster: Monster;
  public readonly targetTile: Position;
  public readonly abilityName: string;
  public readonly multiplier: number;
  public readonly options?: WindUpOptions;

  constructor(
    monster: Monster,
    targetTile: Position,
    abilityName: string,
    multiplier = 2.2,
    options?: WindUpOptions
  ) {
    this.monster = monster;
    this.targetTile = targetTile;
    this.abilityName = abilityName;
    this.multiplier = multiplier;
    this.options = options;
  }

  public perform(engine: GameEngine): ActionResult {
    const cost = this.monster.getActionCost(BASE_ACTION_COST);
    this.monster.consumeEnergy(cost);

    const rawDangerTiles =
      this.options?.targetTiles ??
      (this.monster.intent.targetTiles && this.monster.intent.targetTiles.length > 0
        ? this.monster.intent.targetTiles
        : (this.targetTile ? [this.targetTile] : []));

    const dangerTiles = rawDangerTiles.filter(
      (t): t is Position => Boolean(t && typeof t.x === 'number' && typeof t.y === 'number')
    );

    this.monster.intent = {
      type: 'attack',
      targetTile: this.targetTile ? { ...this.targetTile } : (dangerTiles[0] ? { ...dangerTiles[0] } : undefined),
      turnsRemaining: 0,
    };

    const hitEntities: Entity[] = [];

    for (const t of dangerTiles) {
      const ent = engine.map.getEntityAt(t.x, t.y);
      if (ent && ent.isAlive() && !hitEntities.includes(ent)) {
        hitEntities.push(ent);
      }
      if (this.options?.spawnSurface && engine.surfaces) {
        engine.surfaces.setSurface(t.x, t.y, this.options.spawnSurface, 5);
      }
    }

    if (hitEntities.length > 0) {
      let combinedMessage = '';
      for (const targetEntity of hitEntities) {
        const rawDamage = Math.max(
          2,
          Math.round(this.monster.attack * this.multiplier) - targetEntity.defense
        );
        const { damageDealt, killed } = targetEntity.takeDamage(rawDamage);

        flightRecorder.recordCombat(this.monster.name, targetEntity.name, damageDealt, killed);

        const hitMsg = `${this.monster.name}'s ${this.abilityName} slams into ${targetEntity.name} for ${damageDealt} massive damage!`;
        engine.log(hitMsg);
        combinedMessage += (combinedMessage ? ' ' : '') + hitMsg;

        if (this.options?.pushImpulse && targetEntity.isAlive()) {
          const dx = targetEntity.x - this.monster.x;
          const dy = targetEntity.y - this.monster.y;
          applyImpulse(engine, this.monster, targetEntity, dx, dy, this.options.pushImpulse);
        }

        if (killed) {
          engine.log(`${targetEntity.name} is slain!`);
          DeathResolver.resolveDeath(engine, this.monster, targetEntity);
        }
      }

      return {
        success: true,
        cost,
        message: combinedMessage,
      };
    } else {
      const message = `${this.monster.name}'s ${this.abilityName} strikes the empty ground!`;
      engine.log(message);
      return {
        success: true,
        cost,
        message,
      };
    }
  }
}


