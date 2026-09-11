import type { Position } from '../types';
import type { GameEngine } from '../engine';
import { RunicConduit } from './runicConduit';
import { ValkyrieSprintGauntlet } from './valkyrieSprint';
import { DwarvenWinch } from './dwarvenWinch';
import { TownPortal } from './townPortal';
import type { SerializedTownReturnData } from './types';
import { serializeItem, deserializeItem } from '../storage/serializer';
import { Item } from '../items/item';

export class TownReturnManager {
  public conduits: Map<number, RunicConduit> = new Map();
  public winches: Map<number, DwarvenWinch> = new Map();
  public valkyrieGauntlet: ValkyrieSprintGauntlet = new ValkyrieSprintGauntlet();
  public townPortal: TownPortal = new TownPortal();

  public openTownPortal(floor: number, pos: Position, townPos?: Position): void {
    this.townPortal.open(floor, pos, townPos);
  }

  public getOrCreateConduit(floor: number, pos: Position): RunicConduit {
    let conduit = this.conduits.get(floor);
    if (!conduit) {
      conduit = new RunicConduit(floor, pos);
      this.conduits.set(floor, conduit);
    }
    return conduit;
  }

  public getOrCreateWinch(floor: number, pos: Position): DwarvenWinch {
    let winch = this.winches.get(floor);
    if (!winch) {
      winch = new DwarvenWinch(floor, pos);
      // Pre-load base counterweight (100,000g) into the hopper to counterbalance hero body mass (~70kg * 1.5 = 105kg)
      const baseCounterweight = new Item({
        id: `winch-base-counterweight-f${floor}`,
        name: 'Dwarven Iron Counterweight',
        category: 'misc',
        weight: 100000,
        bulk: 15000,
        identified: true,
        description: 'A massive cast-iron ingot serving as the base counterweight for the dwarven mine hoist (100kg).',
      });
      winch.hopper.addItem(baseCounterweight);
      this.winches.set(floor, winch);
    }
    return winch;
  }

  /**
   * Called each player turn to advance conduit and gauntlet turn states.
   */
  public onPlayerTurn(engine: GameEngine): void {
    // Advance conduit ritual if active on current floor
    const conduit = this.conduits.get(engine.currentFloor);
    if (conduit) {
      conduit.advanceTurn(engine);
    }

    // Advance valkyrie gauntlet if active
    if (this.valkyrieGauntlet.active) {
      this.valkyrieGauntlet.advanceTurn(engine);
    }
  }

  public serialize(): SerializedTownReturnData {
    const conduitStates: Record<number, { conduitPos: Position; cooldownRemaining: number }> = {};
    for (const [f, c] of this.conduits) {
      conduitStates[f] = {
        conduitPos: { ...c.conduitPos },
        cooldownRemaining: c.cooldownRemaining,
      };
    }

    const winchHoppers: Record<number, any[]> = {};
    for (const [f, w] of this.winches) {
      winchHoppers[f] = w.hopper.getItems().map((item) => serializeItem(item));
    }

    return {
      conduitStates,
      winchHoppers,
      valkyrieState: this.valkyrieGauntlet.active
        ? {
            active: this.valkyrieGauntlet.active,
            stage: this.valkyrieGauntlet.stage,
            stageTurnsRemaining: this.valkyrieGauntlet.stageTurnsRemaining,
            originFloor: this.valkyrieGauntlet.originFloor,
            originPosition: { ...this.valkyrieGauntlet.originPosition },
          }
        : undefined,
      townPortal: this.townPortal.active ? this.townPortal.getState() : undefined,
    };
  }

  public deserialize(data?: SerializedTownReturnData): void {
    if (!data) return;

    if (data.townPortal) {
      this.townPortal = new TownPortal(data.townPortal);
    } else {
      this.townPortal = new TownPortal();
    }

    if (data.conduitStates) {
      for (const [fStr, cData] of Object.entries(data.conduitStates)) {
        const floor = parseInt(fStr, 10);
        const conduit = new RunicConduit(floor, cData.conduitPos, {
          cooldownRemaining: cData.cooldownRemaining,
        });
        this.conduits.set(floor, conduit);
      }
    }

    if (data.winchHoppers) {
      for (const [fStr, itemsData] of Object.entries(data.winchHoppers)) {
        const floor = parseInt(fStr, 10);
        const items = itemsData.map((d) => deserializeItem(d));
        const winch = new DwarvenWinch(floor, { x: 0, y: 0 }, items);
        this.winches.set(floor, winch);
      }
    }

    if (data.valkyrieState) {
      this.valkyrieGauntlet = new ValkyrieSprintGauntlet(data.valkyrieState);
    }
  }
}
