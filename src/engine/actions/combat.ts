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
import type { Item } from '../items/item';
import type { ItemModifier } from '../items/modifiers';

function getActorEquippedItems(actor: Entity): Item[] {
  const actorAny = actor as any;
  if (actorAny.inventory?.paperdoll) {
    return actorAny.inventory.paperdoll.getEquippedItems();
  }
  if (typeof actorAny.getEquippedItems === 'function') {
    return actorAny.getEquippedItems();
  }
  if (typeof actorAny.getEquippedItem === 'function') {
    const item = actorAny.getEquippedItem('mainHand');
    return item ? [item] : [];
  }
  return [];
}

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

    // Evaluate attacker equipped item modifiers
    const attackerItems = getActorEquippedItems(this.attacker);
    const attackerModifiers: ItemModifier[] = [];
    for (const it of attackerItems) {
      if (!it.isBroken() && it.modifiers) {
        attackerModifiers.push(...it.modifiers);
      }
    }

    // 1. Blessed modifiers (physical/melee scaling)
    for (const mod of attackerModifiers) {
      if (mod.category === 'blessed' || mod.alignment === 'positive') {
        if (mod.meleeDamageMultiplier) {
          rawDamage = Math.round(rawDamage * mod.meleeDamageMultiplier);
        }
        if (mod.meleeDamageFlatBonus) {
          rawDamage += mod.meleeDamageFlatBonus;
        }
      }
    }

    // 2. Tag-based bonuses: Holy (vs undead/demon) and Unholy (vs clergy/innocents)
    for (const mod of attackerModifiers) {
      if (mod.tagBonuses && mod.tagBonuses.length > 0) {
        for (const bonus of mod.tagBonuses) {
          if (this.defender.hasTag(bonus.tag)) {
            rawDamage = Math.round(rawDamage * bonus.multiplier) + bonus.flatBonus;
            if (bonus.message) {
              engine.log(bonus.message);
            } else if (mod.category === 'holy') {
              engine.log(`Holy radiance blazes against ${this.defender.name}! (+${Math.round((bonus.multiplier - 1) * 100)}% / +${bonus.flatBonus} Holy damage)`);
            } else if (mod.category === 'unholy') {
              engine.log(`Unholy malice tears into ${this.defender.name}! (+${Math.round((bonus.multiplier - 1) * 100)}% / +${bonus.flatBonus} Unholy damage)`);
            }

            if (bonus.renownCategory) {
              const renownCategory = bonus.renownCategory;
              const amount = bonus.renownAmount ?? 1;
              const totalRenown = engine.modifyWorldCounter(renownCategory, amount);
              engine.emitGameEvent({
                type: 'alignment_renown',
                turn: engine.turnCount,
                actorId: this.attacker.id,
                targetId: this.defender.id,
                renownCategory,
                amount,
                totalRenown,
                sourceModifierId: mod.id,
              });
              engine.log(`Your unholy deed echoes in the dark (+${amount} ${renownCategory})!`);
            }
            break;
          }
        }
      }

      // 3. Unholy consecrated ground penalty
      if (mod.consecratedGroundPenalty) {
        const surface = engine.surfaces?.getSurface(this.attacker.x, this.attacker.y);
        const tile = engine.map?.getTile(this.attacker.x, this.attacker.y);
        const isConsecrated =
          surface === 'consecrated_ground' ||
          surface === 'blessed_ground' ||
          tile?.type === 'consecrated_ground' ||
          (tile as any)?.type === 'blessed_ground' ||
          (tile as any)?.isConsecrated === true ||
          tile?.name?.toLowerCase().includes('consecrated') ||
          tile?.name?.toLowerCase().includes('altar');

        if (isConsecrated) {
          rawDamage = Math.max(1, Math.round(rawDamage * (1 - mod.consecratedGroundPenalty.damagePenalty)));
          const selfDmg = mod.consecratedGroundPenalty.selfDamagePerAttack;
          if (selfDmg > 0) {
            this.attacker.takeDamage(selfDmg);
            engine.log(`*** Consecrated ground rejects the unholy presence! ${this.attacker.name} suffers ${selfDmg} radiant retribution damage! ***`);
            engine.recordVisualEffects([
              {
                type: 'burst',
                epicenter: { x: this.attacker.x, y: this.attacker.y },
                radius: 1,
                color: '#facc15',
                durationMs: 200,
              },
            ]);
            if (!this.attacker.isAlive()) {
              DeathResolver.resolveDeath(engine, undefined, this.attacker);
              return {
                success: true,
                cost: this.attacker.getActionCost(BASE_ACTION_COST),
                message: `${this.attacker.name} was incinerated by consecrated ground!`,
              };
            }
          }
        }
      }
    }

    // 4. Defender Hexed damage amplification
    const defenderItems = getActorEquippedItems(this.defender);
    for (const it of defenderItems) {
      if (!it.isBroken() && it.modifiers) {
        for (const mod of it.modifiers) {
          if (mod.damageTakenMultiplier || mod.damageTakenFlatBonus || mod.category === 'hexed') {
            if (mod.damageTakenMultiplier) {
              rawDamage = Math.round(rawDamage * mod.damageTakenMultiplier);
            }
            if (mod.damageTakenFlatBonus) {
              rawDamage += mod.damageTakenFlatBonus;
            }
            engine.log(`Hexed affliction amplifies the blow against ${this.defender.name}!`);
          }
        }
      }
    }

    // 5. Chaotic modifiers (proc checks: backlash & teleport)
    for (const mod of attackerModifiers) {
      if (mod.category === 'chaotic' || mod.alignment === 'chaotic') {
        if (mod.meleeDamageMultiplier) {
          rawDamage = Math.round(rawDamage * mod.meleeDamageMultiplier);
        }
        if (mod.meleeDamageFlatBonus) {
          rawDamage += mod.meleeDamageFlatBonus;
        }

        if (mod.chaoticProc && engine.rng() < mod.chaoticProc.procChance) {
          const proc = mod.chaoticProc;
          if (proc.type === 'backlash') {
            const backlashDmg = proc.param;
            this.attacker.takeDamage(backlashDmg);
            engine.log(`*** CHAOTIC BACKLASH! Volatile recoil sears ${this.attacker.name} for ${backlashDmg} damage! ***`);
            engine.emitGameEvent({
              type: 'chaotic_proc',
              turn: engine.turnCount,
              actorId: this.attacker.id,
              targetId: this.defender.id,
              procType: 'backlash',
              description: proc.description,
              damageDealt: backlashDmg,
            });
            engine.recordVisualEffects([
              {
                type: 'burst',
                epicenter: { x: this.attacker.x, y: this.attacker.y },
                radius: 1,
                color: '#c084fc',
                durationMs: 200,
              },
            ]);
            if (!this.attacker.isAlive()) {
              DeathResolver.resolveDeath(engine, undefined, this.attacker);
            }
          } else if (proc.type === 'teleport') {
            const range = proc.param;
            const candidates: Position[] = [];
            for (let dy = -range; dy <= range; dy++) {
              for (let dx = -range; dx <= range; dx++) {
                if (dx === 0 && dy === 0) continue;
                const tx = this.attacker.x + dx;
                const ty = this.attacker.y + dy;
                if (
                  engine.map.inBounds(tx, ty) &&
                  engine.map.isPassable(tx, ty) &&
                  !engine.map.getEntityAt(tx, ty)
                ) {
                  candidates.push({ x: tx, y: ty });
                }
              }
            }
            if (candidates.length > 0) {
              const dest = candidates[Math.floor(engine.rng() * candidates.length)];
              this.attacker.setPosition(dest.x, dest.y);
              engine.log(`*** CHAOTIC WARP! Spatial instability scatters ${this.attacker.name} across the chamber! ***`);
              engine.emitGameEvent({
                type: 'chaotic_proc',
                turn: engine.turnCount,
                actorId: this.attacker.id,
                targetId: this.defender.id,
                procType: 'teleport',
                description: proc.description,
                teleportDestination: dest,
              });
              engine.recordVisualEffects([
                {
                  type: 'screen_flash',
                  color: '#c084fc',
                  durationMs: 150,
                },
              ]);
            }
          }
        }
      }
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


