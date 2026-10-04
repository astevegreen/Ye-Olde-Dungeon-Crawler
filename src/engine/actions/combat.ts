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
import { getMonsterCategory, hasMasteryPerk } from '../compendium/compendiumManager';
import { ANATOMIST_CRIT_CHANCE } from '../compendium/types';
import { applyImpulse } from '../combat/impulse';
import { resolveCombatMitigation } from '../combat/mitigationPipeline';
import { burnOnSacredGround } from '../combat/sacredGround';
import type { ItemModifier } from '../items/modifiers';
import { afflictionDuration, highestWorn, productWorn, sumWorn, wornModifiers } from '../items/wornModifiers';
import { attributeScalingOf, dexterityEvasion, meleeHitPercent, strengthMeleeBonus } from '../combat/attributeScaling';

const DEFAULT_MIN_DAMAGE = 1;
const DEFAULT_CRIT_MULTIPLIER = 1.5;

export class MeleeAttackAction implements Action {
  public readonly attacker: Entity;
  public readonly defender: Entity;
  /** A Twinstrike's second blow: part of the first action, so it costs no energy and strikes no further. */
  private readonly followUp: boolean;
  /** The share of a blow a follow-up deals (Twin Fangs: half); 1 for a whole blow. */
  private readonly damageShare: number;

  constructor(attacker: Entity, defender: Entity, options?: { followUp?: boolean; damageShare?: number }) {
    this.attacker = attacker;
    this.defender = defender;
    this.followUp = options?.followUp ?? false;
    this.damageShare = options?.damageShare ?? 1;
  }

  /** A blow that did not land: the turn is spent, logged, and a Twinstrike bearer bleeds for it. */
  private missed(engine: GameEngine, message: string): ActionResult {
    const cost = this.followUp ? 0 : this.attacker.getActionCost(BASE_ACTION_COST);
    this.attacker.consumeEnergy(cost);
    engine.log(message);
    const missCost = sumWorn(this.attacker, 'missSelfDamage');
    if (missCost > 0) {
      const { damageDealt, killed } = this.attacker.takeDamage(missCost);
      engine.log(`${this.attacker.name} overreaches and takes ${damageDealt} for the miss!`);
      if (killed) DeathResolver.resolveDeath(engine, undefined, this.attacker);
    }
    return { success: true, cost, message };
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

    // The attacker's hit roll (the pack's base chance, moved by Dexterity; 100 means no roll),
    // then the defender's evasion: its Dexterity, the Survivor perk (+10% for the player against a
    // mastered species) and what it wears (Trickster's Step). Either way the blow is spent and
    // costs the attacker what it wears (Twinstrike).
    const scaling = attributeScalingOf(engine.manifest);
    const hitPercent = meleeHitPercent(this.attacker, scaling);
    if (hitPercent < 100 && engine.rng() * 100 >= hitPercent) {
      return this.missed(engine, `${this.attacker.name} misses ${this.defender.name}.`);
    }
    const wornEvasion = sumWorn(this.defender, 'evasionBonus');
    const perkEvasion =
      this.attacker instanceof Monster && this.defender instanceof Player && engine.compendium
        ? engine.compendium.getMasteryEvasionBonus(this.attacker.definitionId, getMonsterCategory(engine, this.attacker.definitionId)?.id)
        : 0;
    const evasion = wornEvasion + perkEvasion + dexterityEvasion(this.defender, scaling);
    if (evasion > 0 && engine.rng() < evasion) {
      return this.missed(
        engine,
        perkEvasion > 0
          ? `${this.defender.name} anticipates ${this.attacker.name}'s attack and evades cleanly! (Survivor Perk)`
          : `${this.defender.name} evades ${this.attacker.name}'s attack!`
      );
    }

    // Slayer's Compendium Offensive Mastery (Anatomist: ignore 50% defense, +25% crit dmg)
    const isAnatomist = this.attacker instanceof Player &&
      this.defender instanceof Monster &&
      hasMasteryPerk(engine, this.defender.definitionId, 'anatomist');

    // Damage calculation: manifest combatConfig or default formula
    const combatConfig = engine.manifest?.combatConfig;
    let rawDamage: number;
    let isCrit = false;

    if (combatConfig?.calculateDamage) {
      const custom = combatConfig.calculateDamage(this.attacker, this.defender, engine);
      rawDamage = Math.max(combatConfig.minDamage ?? DEFAULT_MIN_DAMAGE, custom.damage);
      isCrit = custom.isCrit ?? false;
    } else {
      const minDmg = combatConfig?.minDamage ?? DEFAULT_MIN_DAMAGE;
      const effectiveDefense = isAnatomist
        ? Math.floor(this.defender.defense * 0.5)
        : this.defender.defense;
      // Strength adds to the blow before the foe's defense is taken off (tracker 3.2).
      let base = Math.max(minDmg, this.attacker.attack + strengthMeleeBonus(this.attacker, scaling) - effectiveDefense);

      // Critical strike: the pack's chance, or Anatomist's own against a mastered family (a
      // pack with no base crit, cotw, would otherwise give the perk nothing to raise), plus
      // what the attacker wears and holds (Thor's Wrath); the highest multiplier counts.
      const critChance = (combatConfig?.critChance || (isAnatomist ? ANATOMIST_CRIT_CHANCE : 0)) + sumWorn(this.attacker, 'critChanceBonus');
      if (critChance > 0 && engine.rng() < critChance) {
        isCrit = true;
        const mult = Math.max(combatConfig?.critMultiplier ?? DEFAULT_CRIT_MULTIPLIER, highestWorn(this.attacker, 'critMultiplier') ?? 0) + (isAnatomist ? 0.25 : 0);
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

    // What the attacker wears, and a hero's perks (`wornModifiers`).
    const attackerModifiers: ItemModifier[] = wornModifiers(this.attacker);

    // 1. Melee scaling, by data: any modifier that carries it (Blessed and Chaotic do). A
    //    modifier with a below-half-health multiplier (Berserkergang) uses that one instead
    //    while the attacker is at or below half.
    const belowHalf = this.attacker.hp * 2 <= this.attacker.maxHp;
    for (const mod of attackerModifiers) {
      const multiplier = belowHalf && mod.belowHalfHpMeleeMultiplier ? mod.belowHalfHpMeleeMultiplier : mod.meleeDamageMultiplier;
      if (multiplier) {
        rawDamage = Math.round(rawDamage * multiplier);
      }
      if (mod.meleeDamageFlatBonus) {
        rawDamage += mod.meleeDamageFlatBonus;
      }
      if (mod.meleeDamageRoll) {
        const [lo, hi] = mod.meleeDamageRoll;
        rawDamage = Math.round(rawDamage * (lo + engine.rng() * (hi - lo)));
      }
    }

    // A follow-up that strikes for a share of a blow (Twin Fangs).
    if (this.damageShare !== 1) rawDamage = Math.max(1, Math.round(rawDamage * this.damageShare));

    // 2. Tag-based bonuses, by data: Holy against the undead, Hel-touched against the living.
    //    A bonus may also heal the attacker a share of the blow (applied once it has landed).
    let lifestealPercent = 0;
    for (const mod of attackerModifiers) {
      for (const bonus of mod.tagBonuses ?? []) {
        if (!this.defender.hasTag(bonus.tag)) continue;
        rawDamage = Math.round(rawDamage * bonus.multiplier) + bonus.flatBonus;
        lifestealPercent += bonus.healPercentOfDamage ?? 0;
        if (bonus.message) {
          engine.log(bonus.message);
        } else if (mod.category === 'holy') {
          engine.log(`Holy radiance blazes against ${this.defender.name}! (+${Math.round((bonus.multiplier - 1) * 100)}% / +${bonus.flatBonus} Holy damage)`);
        } else {
          engine.log(`${mod.name} bites deep into ${this.defender.name}! (+${Math.round((bonus.multiplier - 1) * 100)}%${bonus.flatBonus ? ` / +${bonus.flatBonus}` : ''})`);
        }
        break;
      }
    }

    // 3. Sacred ground burns a bearer who strikes from it (Hel-touched).
    if (burnOnSacredGround(engine, this.attacker).killed) {
      return {
        success: true,
        cost: this.attacker.getActionCost(BASE_ACTION_COST),
        message: `${this.attacker.name} was consumed by holy ground!`,
      };
    }

    // Damage the defender takes is scaled by what it wears (Hexed, Glass Fury) in Actor.takeDamage.

    // Resolve combat mitigation pipeline (aspect alignment)
    const mitigation = resolveCombatMitigation(this.attacker, this.defender, rawDamage, engine);
    // What the defender wears against melee in particular (Shield-Wall); the general
    // damageTakenMultiplier applies inside takeDamage.
    const meleeTaken = productWorn(this.defender, 'meleeDamageTakenMultiplier');
    const finalDamage = meleeTaken === 1 ? mitigation.finalDamage : Math.max(mitigation.finalDamage > 0 ? 1 : 0, Math.round(mitigation.finalDamage * meleeTaken));
    const { damageDealt, killed } = this.defender.takeDamage(finalDamage);

    const cost = this.followUp ? 0 : this.attacker.getActionCost(BASE_ACTION_COST);
    this.attacker.consumeEnergy(cost);

    flightRecorder.recordCombat(this.attacker.name, this.defender.name, damageDealt, killed);

    // Mirror Hide: a share of the blow comes back at the attacker.
    const reflectPercent = sumWorn(this.defender, 'reflectMeleePercent');
    if (reflectPercent > 0 && damageDealt > 0) {
      const reflected = this.attacker.takeDamage(Math.round(damageDealt * reflectPercent));
      if (reflected.damageDealt > 0) engine.log(`${this.defender.name}'s hide turns ${reflected.damageDealt} of the blow back on ${this.attacker.name}!`);
      if (reflected.killed) DeathResolver.resolveDeath(engine, this.defender, this.attacker);
    }

    if (lifestealPercent > 0 && damageDealt > 0) {
      const drawn = this.attacker.heal(Math.round(damageDealt * lifestealPercent));
      if (drawn > 0) engine.log(`${this.attacker.name} draws ${drawn} HP from the wound.`);
    }

    const perkNote = isAnatomist
      ? (isCrit ? ' (Anatomist Critical!)' : ' (Anatomist Exploit)')
      : '';
    const critPrefix = isCrit ? 'Critical hit! ' : '';
    let message = `${critPrefix}${this.attacker.name} attacks ${this.defender.name} for ${damageDealt} damage.${perkNote}`;
    engine.log(message);
    // Emitted straight after its log line, so presentation can style that line and
    // show the blow's numbers from data rather than by parsing the text.
    engine.emitGameEvent({
      type: 'damage_dealt',
      turn: engine.turnCount,
      actorId: this.attacker.id,
      targetId: this.defender.id,
      amount: damageDealt,
      killed,
      critical: isCrit,
    });

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
      const isSurvivor = this.defender instanceof Player &&
        hasMasteryPerk(engine, this.attacker.definitionId, 'survivor');

      // Survivor: 25% chance to shrug off affliction entirely
      if (isSurvivor && engine.rng() < 0.25) {
        engine.log(`${this.defender.name}'s Survivor instincts shrug off ${this.attacker.name}'s ${aff.type}!`);
      } else if (engine.rng() < aff.chance) {
        // Survivor: halve the duration of debuffs; what the defender wears may shorten it too (Iron Stomach).
        const effectiveDuration = afflictionDuration(this.defender, aff.type, isSurvivor ? Math.max(1, Math.floor(aff.duration * 0.5)) : aff.duration);
        const applied = this.defender.statusManager.applyStatus(
          {
            type: aff.type,
            duration: effectiveDuration,
            potency: aff.potency,
            sourceEntityId: this.attacker.id,
          },
          this.defender.statusImmunities,
          this.defender,
          engine
        );
        if (applied) {
          const survivorNote = isSurvivor ? ' (Duration halved by Survivor)' : '';
          const affMsg = `${this.attacker.name}'s bite infects ${this.defender.name} with ${aff.type}!${survivorNote}`;
          engine.log(affMsg);
        }
      }
    }

    // A status the attacker's blows leave behind (Bone-Breaker's slow), by what it wears.
    if (!killed && damageDealt > 0) {
      for (const mod of attackerModifiers) {
        const on = mod.onHitStatus;
        if (!on || engine.rng() >= on.chance) continue;
        const applied = this.defender.statusManager.applyStatus(
          { type: on.status, duration: afflictionDuration(this.defender, on.status, on.duration), potency: on.potency, sourceEntityId: this.attacker.id },
          this.defender.statusImmunities,
          this.defender,
          engine
        );
        if (applied) engine.log(`${this.attacker.name}'s blow leaves ${this.defender.name} ${on.status}!`);
      }
    }

    let isFatal = killed;
    let killingElement: string = 'physical';

    // Elemental Weapon Affix Bonus Damage (e.g. "of Fire", "of Cold", "of Lightning")
    if (this.attacker instanceof Player && !isFatal) {
      const weapon = this.attacker.inventory.paperdoll.getItem('mainHand');
      if (weapon?.elementalAffix) {
        const affix = weapon.elementalAffix;
        const affinity = this.defender.affinityTo(affix.element);
        const elemResult = calculateElementalDamage(affix.bonusDamage, affix.element, affinity);
        if (elemResult.finalDamage > 0) {
          const elemDmgRes = this.defender.takeDamage(elemResult.finalDamage);
          const elemMsg = `${this.attacker.name}'s ${weapon.name} bursts with ${affix.element} for ${elemDmgRes.damageDealt} bonus damage!`;
          engine.log(elemMsg);
          message += ` ${elemMsg}`;
          if (elemDmgRes.killed) {
            isFatal = true;
            killingElement = affix.element;
          }
          if (engine.surfaces) {
            engine.surfaces.triggerElementalReaction(this.defender.x, this.defender.y, affix.element, elemDmgRes.damageDealt, engine);
          }
        }
      }
    }

    if (isFatal) {
      message += ` ${this.defender.name} is slain!`;
      DeathResolver.resolveDeath(engine, this.attacker, this.defender, { damageElement: killingElement });
    }

    // Twinstrike: the blow lands again, as part of this action; Twin Fangs strikes once more
    // for its share of a blow.
    const extraStrikes = this.followUp ? 0 : sumWorn(this.attacker, 'extraMeleeStrikes');
    const shares = this.followUp ? [] : attackerModifiers.flatMap((mod) => (mod.followUpStrikeShare ? [mod.followUpStrikeShare] : []));
    const strikes = [...Array<number>(extraStrikes).fill(1), ...shares];
    for (const damageShare of strikes) {
      if (!this.attacker.isAlive() || !this.defender.isAlive()) break;
      const again = new MeleeAttackAction(this.attacker, this.defender, { followUp: true, damageShare }).perform(engine);
      if (again.message) message += ` ${again.message}`;
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

  /** The acting entity, as the pipeline resolves it for hooks (§4). */
  get actor(): Monster {
    return this.monster;
  }

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

  /** The acting entity, as the pipeline resolves it for hooks (§4). */
  get actor(): Monster {
    return this.monster;
  }

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
      // A blast centred on the target can cover the caster's own tile; it never hits its source.
      if (ent && ent !== this.monster && ent.isAlive() && !hitEntities.includes(ent)) {
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


