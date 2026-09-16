import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import type { GameEngine } from '../engine';
import type { Action } from './action';
import { Item } from '../items/item';
import { traceProjectile } from '../magic/targeting';
import { DeathResolver } from '../combat/deathResolver';
import { flightRecorder } from '../debug/flightRecorder';

export interface RangedAttackConfig {
  attacker: Entity;
  targetX: number;
  targetY: number;
  weapon?: Item;
}

export class RangedAttackAction implements Action {
  public readonly attacker: Entity;
  public readonly targetX: number;
  public readonly targetY: number;
  public readonly weapon?: Item;

  constructor(attacker: Entity, targetX: number, targetY: number, weapon?: Item) {
    this.attacker = attacker;
    this.targetX = targetX;
    this.targetY = targetY;
    this.weapon = weapon;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.attacker.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: `${this.attacker.name} is incapacitated and cannot attack.`,
      };
    }

    // Determine equipped ranged weapon or explicit weapon
    let weapon = this.weapon;
    if (!weapon && this.attacker instanceof Player) {
      const mainHand = this.attacker.inventory.paperdoll.getItem('mainHand');
      if (mainHand?.rangedConfig) {
        weapon = mainHand;
      }
    }

    if (!weapon || !weapon.rangedConfig) {
      return {
        success: false,
        cost: 0,
        message: 'No ranged weapon or projectile equipped.',
      };
    }

    const rangedConfig = weapon.rangedConfig;
    const maxRange = rangedConfig.range ?? 6;
    const dist = Math.hypot(this.targetX - this.attacker.x, this.targetY - this.attacker.y);

    if (dist > maxRange) {
      return {
        success: false,
        cost: 0,
        message: `Target is out of range (${Math.round(dist)} > ${maxRange} tiles).`,
      };
    }

    // Ammunition check & consumption
    if (rangedConfig.ammoType && this.attacker instanceof Player) {
      const pack = this.attacker.inventory.primaryPack;
      // Search for ammunition matching ammoType by id, category, or name
      const ammoItem = pack.getItems().find(
        (it) =>
          it.id === rangedConfig.ammoType ||
          it.name.toLowerCase().includes(rangedConfig.ammoType!.toLowerCase())
      );

      if (!ammoItem) {
        return {
          success: false,
          cost: 0,
          message: `Out of ${rangedConfig.ammoType}! You need ammunition to fire.`,
        };
      }

      pack.removeItem(ammoItem.id);
      engine.log(`Consumed 1x ${ammoItem.displayName}.`);
    } else if (rangedConfig.consumesSelf && this.attacker instanceof Player) {
      // Consumable projectile (e.g. throwing dagger, javelin)
      const mainHand = this.attacker.inventory.paperdoll.getItem('mainHand');
      if (mainHand === weapon) {
        this.attacker.inventory.paperdoll.unequip('mainHand');
      } else {
        this.attacker.inventory.primaryPack.removeItem(weapon.id);
      }
      engine.log(`Threw ${weapon.displayName}!`);
    }

    // Trace ballistic trajectory
    const rayResult = traceProjectile(
      engine.map,
      this.attacker.x,
      this.attacker.y,
      this.targetX,
      this.targetY,
      maxRange,
      false,
      this.attacker.id
    );

    const cost = this.attacker.getActionCost(BASE_ACTION_COST);
    this.attacker.consumeEnergy(cost);

    // Check entity collision
    if (rayResult.hitEntityId) {
      const target =
        engine.map.getEntityById(rayResult.hitEntityId) ??
        engine.map.getEntityAt(rayResult.impactTile.x, rayResult.impactTile.y);

      if (target && target.isAlive()) {
        const attackerDex = (this.attacker as any).attributes?.dexterity ?? 14;
        const targetDefense = (target as any).defense ?? (target as any).stats?.defense ?? 0;

        // Hit roll: 75% base + DEX modifier - target defense
        const hitChance = Math.max(20, Math.min(95, 75 + (attackerDex - 10) * 2 - targetDefense * 2));
        const roll = engine.rng() * 100;

        if (roll <= hitChance) {
          const baseDmg = rangedConfig.baseDamage ?? (weapon.stats?.attackBonus ?? 4);
          const enchantBonus = weapon.enchantmentLevel ?? 0;
          const dexBonus = Math.max(0, Math.floor((attackerDex - 10) / 2));
          let damage = Math.max(1, baseDmg + enchantBonus + dexBonus - Math.floor(targetDefense / 2));

          target.takeDamage(damage);

          let affixMsg = '';
          if (weapon.elementalAffix) {
            const affinity = target.elementalResistances?.[weapon.elementalAffix.element] ?? (target as any).resistances?.[weapon.elementalAffix.element] ?? 'neutral';
            const elResult = engine.affinityMatrix.calculateDamage(
              weapon.elementalAffix.bonusDamage,
              weapon.elementalAffix.element,
              affinity
            );
            if (elResult.finalDamage > 0) {
              target.takeDamage(elResult.finalDamage);
              damage += elResult.finalDamage;
              affixMsg = ` (+${elResult.finalDamage} ${weapon.elementalAffix.element} damage)`;
            }
          }

          const msg = `${this.attacker.name} fires ${weapon.displayName} hitting ${target.name} for ${damage} damage!${affixMsg}`;
          engine.log(msg);

          flightRecorder.record({
            type: 'combat',
            summary: `${this.attacker.name} hit ${target.name} with ${weapon.name} for ${damage} dmg`,
            details: { weapon: weapon.name, damage, hit: true, target: target.name },
          });

          if (!target.isAlive()) {
            DeathResolver.resolveDeath(engine, this.attacker, target);
          }

          return { success: true, cost, message: msg };
        } else {
          const missMsg = `${this.attacker.name} fires ${weapon.displayName} at ${target.name} but misses!`;
          engine.log(missMsg);

          flightRecorder.record({
            type: 'combat',
            summary: `${this.attacker.name} fired ${weapon.name} at ${target.name} and missed`,
            details: { weapon: weapon.name, hit: false, target: target.name },
          });

          return { success: true, cost, message: missMsg };
        }
      }
    }

    if (rayResult.hitWall) {
      const wallMsg = `${this.attacker.name}'s shot hits the wall at (${rayResult.impactTile.x}, ${rayResult.impactTile.y}).`;
      engine.log(wallMsg);
      return { success: true, cost, message: wallMsg };
    }

    const openMsg = `${this.attacker.name} fires ${weapon.displayName} into the open air.`;
    engine.log(openMsg);
    return { success: true, cost, message: openMsg };
  }
}
