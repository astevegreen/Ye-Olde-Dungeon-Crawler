import type { Position } from '../types';
import type { GameEngine } from '../engine';
import type { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { TownPortalState } from './types';

export const DEFAULT_TOWN_PORTAL_POS: Position = { x: 25, y: 17 };

export class TownPortal {
  public active: boolean = false;
  public destinationFloor: number = 1;
  public destinationPosition: Position = { x: 0, y: 0 };
  public townPosition: Position = { ...DEFAULT_TOWN_PORTAL_POS };

  constructor(state?: Partial<TownPortalState>) {
    if (state) {
      this.active = state.active ?? false;
      this.destinationFloor = state.destinationFloor ?? 1;
      this.destinationPosition = state.destinationPosition
        ? { ...state.destinationPosition }
        : { x: 0, y: 0 };
      this.townPosition = state.townPosition
        ? { ...state.townPosition }
        : { ...DEFAULT_TOWN_PORTAL_POS };
    }
  }

  public getState(): TownPortalState {
    return {
      active: this.active,
      destinationFloor: this.destinationFloor,
      destinationPosition: { ...this.destinationPosition },
      townPosition: { ...this.townPosition },
    };
  }

  public setState(state?: Partial<TownPortalState>): void {
    if (!state) return;
    if (state.active !== undefined) this.active = state.active;
    if (state.destinationFloor !== undefined) this.destinationFloor = state.destinationFloor;
    if (state.destinationPosition) this.destinationPosition = { ...state.destinationPosition };
    if (state.townPosition) this.townPosition = { ...state.townPosition };
  }

  /**
   * Opens the two-way return portal to the specified floor and position.
   */
  public open(destinationFloor: number, destinationPosition: Position, townPosition = DEFAULT_TOWN_PORTAL_POS): void {
    this.active = true;
    this.destinationFloor = destinationFloor;
    this.destinationPosition = { ...destinationPosition };
    this.townPosition = { ...townPosition };
  }

  /**
   * Closes the portal.
   */
  public close(): void {
    this.active = false;
  }

  /**
   * Ensures the portal tile is spawned on the town map (Floor 0).
   */
  public ensureSpawnedInTown(townMap: GameMap): void {
    if (this.active) {
      townMap.setTile(this.townPosition.x, this.townPosition.y, TILES.TOWN_PORTAL);
    }
  }

  /**
   * Uses the portal: teleports player back to the depths at the shortcut fixture.
   * Cleans up the portal tile on floor 0 and deactivates the portal link.
   */
  public teleportToDepths(engine: GameEngine): { success: boolean; floor: number; position: Position } {
    if (!this.active) {
      return {
        success: false,
        floor: engine.currentFloor,
        position: { x: engine.player.x, y: engine.player.y },
      };
    }

    const targetFloor = this.destinationFloor;
    const targetPos = { ...this.destinationPosition };

    // Clean up portal tile in town
    if (engine.currentFloor === 0) {
      engine.map.setTile(this.townPosition.x, this.townPosition.y, TILES.FLOOR);
    }
    const townStoredMap = engine.storedFloors.get(0);
    if (townStoredMap) {
      townStoredMap.setTile(this.townPosition.x, this.townPosition.y, TILES.FLOOR);
    }

    // Deactivate portal
    this.active = false;

    engine.log('*** You step into the shimmering Runic Descent Portal! ***');
    engine.log(`Leyline currents sweep you through the void, depositing you back onto Floor ${targetFloor}!`);

    engine.changeFloor(targetFloor, targetPos);

    return {
      success: true,
      floor: targetFloor,
      position: { x: engine.player.x, y: engine.player.y },
    };
  }
}
