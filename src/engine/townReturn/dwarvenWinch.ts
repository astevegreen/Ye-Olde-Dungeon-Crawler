import type { Position } from '../types';
import type { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { Container } from '../items/container';
import { Item } from '../items/item';
import { DeathResolver } from '../combat/deathResolver';
import type { DwarvenWinchBalanceResult } from './types';

export class DwarvenWinch {
  public readonly floor: number;
  public readonly winchPos: Position;
  public readonly hopper: Container;

  constructor(floor: number, winchPos: Position, existingItems?: Item[]) {
    this.floor = floor;
    this.winchPos = { ...winchPos };
    this.hopper = new Container({
      id: `winch-hopper-f${floor}`,
      name: 'Counterweight Hopper',
      unidentifiedName: 'Iron Hopper',
      category: 'container',
      containerType: 'chest',
      weight: 0,
      bulk: 0,
      maxWeightCapacity: 500000, // 500kg
      maxBulkCapacity: 500000,
      maxSlots: 100,
      identified: true,
      description: 'The iron cargo hopper of an ancient dwarven mine lift.',
    });

    if (existingItems) {
      for (const it of existingItems) {
        this.hopper.addItem(it);
      }
    }
  }

  public getHopperWeight(): number {
    return this.hopper.getItems().reduce((sum, item) => sum + item.weight, 0);
  }

  /**
   * Evaluates current balance status relative to player body + equipment weight.
   * Target = PlayerWeight * 1.5 +/- 1500g
   */
  public evaluateBalance(player: Player): DwarvenWinchBalanceResult {
    const baseBodyWeight = 70000; // 70kg standard hero body mass
    const carriedWeight = player.inventory.totalWeight();
    const playerTotalWeight = baseBodyWeight + carriedWeight;

    const targetWeight = Math.floor(playerTotalWeight * 1.5);
    const tolerance = 1500; // +/- 1.5kg
    const hopperWeight = this.getHopperWeight();

    let status: 'underweight' | 'balanced' | 'overweight' = 'balanced';
    if (hopperWeight < targetWeight - tolerance) {
      status = 'underweight';
    } else if (hopperWeight > targetWeight + tolerance) {
      status = 'overweight';
    }

    const delta = hopperWeight - targetWeight;

    return {
      playerWeight: playerTotalWeight,
      targetWeight,
      tolerance,
      hopperWeight,
      status,
      delta,
    };
  }

  /**
   * Deposits an item from player's primary pack into the winch hopper.
   */
  public depositItem(player: Player, itemId: string): boolean {
    const item = player.inventory.primaryPack.getItem(itemId);
    if (!item) return false;

    player.inventory.primaryPack.removeItem(itemId);
    this.hopper.addItem(item);
    return true;
  }

  /**
   * Retrieves an item from the winch hopper back into player's pack.
   */
  public retrieveItem(player: Player, itemId: string): boolean {
    const item = this.hopper.getItem(itemId);
    if (!item) return false;

    this.hopper.removeItem(itemId);
    player.inventory.primaryPack.addItem(item);
    return true;
  }

  /**
   * Executes the Pull Lever action.
   */
  public pullLever(engine: GameEngine): {
    success: boolean;
    balanced: boolean;
    targetFloor: number;
    fallDamage?: number;
    shatteredPotion?: string;
  } {
    const evalResult = this.evaluateBalance(engine.player);

    if (evalResult.status === 'balanced') {
      engine.log('*** The dwarven counterweight engages with a deep, resonant clang! The massive gears spin smoothly! ***');
      engine.log(`Hopper (${evalResult.hopperWeight}g) matches target (${evalResult.targetWeight}g ±${evalResult.tolerance}g)!`);
      engine.log(`You ride the counterweight lift smoothly up the shaft directly into ${engine.manifest?.town?.name ?? 'town'} square!`);

      // Open two-way return portal and record recall floor & position
      if (engine.townReturnManager) {
        engine.townReturnManager.openTownPortal(this.floor, this.winchPos);
      }
      engine.player.deepestRecallFloor = this.floor;
      engine.player.recallPosition = { ...this.winchPos };

      // Smooth direct ascent to Bjarnarhaven town square
      engine.changeFloor(0, { x: 25, y: 14 });
      return { success: true, balanced: true, targetFloor: 0 };
    }

    // Imbalanced: Cable slips or snaps!
    const halfFloorDescent = Math.max(1, Math.floor(engine.currentFloor / 2));
    const newFloor = Math.max(0, engine.currentFloor - halfFloorDescent);
    const fallDamage = Math.max(1, Math.floor(engine.player.maxHp * 0.10));

    engine.log(`*** SNAP! The counterweight is ${evalResult.status.toUpperCase()} (${evalResult.hopperWeight}g vs target ${evalResult.targetWeight}g)! ***`);
    engine.log(`The cable slips through the gears! The carriage violently jerks and halts halfway at Floor ${newFloor}!`);
    engine.log(`You suffer minor fall injuries from the sudden impact (-${fallDamage} HP)!`);

    engine.player.takeDamage(fallDamage);

    // 25% chance to shatter a potion in inventory
    let shatteredPotionName: string | undefined;
    if (Math.random() < 0.25) {
      const potions = engine.player.inventory.primaryPack
        .getItems()
        .filter((i) => i.category === 'potion' || i.name.toLowerCase().includes('potion'));
      if (potions.length > 0) {
        const targetPot = potions[0];
        engine.player.inventory.primaryPack.removeItem(targetPot.id);
        shatteredPotionName = targetPot.name;
        engine.log(`Crash! A ${targetPot.name} in your pack shattered during the violent landing!`);
      }
    }

    // Teleport to halfway landing
    engine.changeFloor(newFloor);

    if (!engine.player.isAlive()) {
      DeathResolver.resolveDeath(engine, undefined, engine.player);
    }

    return {
      success: true,
      balanced: false,
      targetFloor: newFloor,
      fallDamage,
      shatteredPotion: shatteredPotionName,
    };
  }
}
