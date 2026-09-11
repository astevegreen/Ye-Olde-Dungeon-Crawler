import type { ActionResult, Position } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { GameMap } from '../grid/map';
import type { Action } from './action';
import { TILES } from '../grid/tile';
import type { Item } from '../items/item';

export class OpenDoorAction implements Action {
  public readonly entity: Entity;
  public readonly x: number;
  public readonly y: number;

  constructor(entity: Entity, x: number, y: number) {
    this.entity = entity;
    this.x = x;
    this.y = y;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: `${this.entity.name} cannot open doors while defeated.`,
      };
    }

    const tile = engine.map.getTile(this.x, this.y);
    if (tile && (tile.isClosedDoor || tile.type === 'door_closed')) {
      // Check if door is locked
      if (tile.locked) {
        if (this.entity.type === 'player') {
          const player = engine.player;
          // 1. Check for key in inventory
          const items = player.inventory.getAllCarriedItems();
          const keyItem = items.find(
            (i: Item) => i.id === 'iron_key' || i.category === 'key' || i.name.toLowerCase().includes('key')
          );

          if (keyItem) {
            tile.locked = false;
            engine.map.setTile(this.x, this.y, TILES.DOOR_OPEN);
            this.entity.consumeEnergy(BASE_ACTION_COST);
            const msg = `You unlock the door using ${keyItem.displayName} and swing it open.`;
            engine.log(msg);
            return { success: true, cost: BASE_ACTION_COST, message: msg };
          }

          // 2. Lockpicking / Dexterity check
          const lockDC = tile.lockDifficulty ?? 14;
          const pickRoll = Math.floor(Math.random() * 20) + 1 + Math.floor(player.dexterity / 4);
          if (pickRoll >= lockDC) {
            tile.locked = false;
            engine.map.setTile(this.x, this.y, TILES.DOOR_OPEN);
            this.entity.consumeEnergy(BASE_ACTION_COST);
            const msg = 'You deftly pick the lock and push the door open!';
            engine.log(msg);
            return { success: true, cost: BASE_ACTION_COST, message: msg };
          }

          // Lockpick failed
          this.entity.consumeEnergy(BASE_ACTION_COST);
          const msg = `The door is locked (DC ${lockDC})! Your lockpicking attempt failed (Rolled ${pickRoll}).`;
          engine.log(msg);
          return { success: false, cost: BASE_ACTION_COST, message: msg };
        } else {
          return {
            success: false,
            cost: 0,
            message: `${this.entity.name} cannot open locked doors.`,
          };
        }
      }

      engine.map.setTile(this.x, this.y, TILES.DOOR_OPEN);
      this.entity.consumeEnergy(BASE_ACTION_COST);
      const message = `${this.entity.name} opens the door.`;
      engine.log(message);
      return {
        success: true,
        cost: BASE_ACTION_COST,
        message,
      };
    }

    return {
      success: false,
      cost: 0,
      message: 'There is no closed door to open there.',
    };
  }
}

/**
 * Returns all open door coordinates adjacent to the given position.
 */
export function getAdjacentOpenDoors(map: GameMap, x: number, y: number): Position[] {
  const doors: Position[] = [];
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
  ];
  for (const d of dirs) {
    const tx = x + d.dx;
    const ty = y + d.dy;
    if (map.inBounds(tx, ty)) {
      const tile = map.getTile(tx, ty);
      if (tile && (tile.isOpenDoor || tile.type === 'door_open')) {
        doors.push({ x: tx, y: ty });
      }
    }
  }
  return doors;
}

/**
 * Closes an open door tile.
 * Blocked if an entity is standing in the target tile.
 */
export class CloseDoorAction implements Action {
  public readonly entity: Entity;
  public readonly x: number;
  public readonly y: number;

  constructor(entity: Entity, x: number, y: number) {
    this.entity = entity;
    this.x = x;
    this.y = y;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return { success: false, cost: 0, message: `${this.entity.name} cannot close doors while defeated.` };
    }

    const tile = engine.map.getTile(this.x, this.y);
    if (!tile || !(tile.isOpenDoor || tile.type === 'door_open')) {
      return { success: false, cost: 0, message: 'There is no open door to close there.' };
    }

    // Check if something is blocking the doorway
    const occupant = engine.map.getEntityAt(this.x, this.y);
    if (occupant) {
      const msg = `${occupant.name} is in the way — you cannot close the door!`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    engine.map.setTile(this.x, this.y, TILES.DOOR_CLOSED);
    this.entity.consumeEnergy(BASE_ACTION_COST);
    const message = `${this.entity.name} closes the door.`;
    engine.log(message);
    return { success: true, cost: BASE_ACTION_COST, message };
  }
}

/**
 * Smart-Close targeting:
 * - If explicit direction provided: closes the door in that direction.
 * - 0 adjacent open doors: logs "No open door nearby." (0-tick cost).
 * - 1 adjacent open door: closes immediately (100 energy ticks).
 * - >1 adjacent open doors: logs "Close which door? [Direction]" (0-tick cost until direction specified).
 */
export class SmartCloseDoorAction implements Action {
  public readonly entity: Entity;
  public readonly direction?: { dx: number; dy: number };

  constructor(entity: Entity, direction?: { dx: number; dy: number }) {
    this.entity = entity;
    this.direction = direction;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return { success: false, cost: 0, message: `${this.entity.name} cannot close doors while defeated.` };
    }

    if (this.direction) {
      const targetX = this.entity.x + this.direction.dx;
      const targetY = this.entity.y + this.direction.dy;
      const closeAction = new CloseDoorAction(this.entity, targetX, targetY);
      return closeAction.perform(engine);
    }

    const openDoors = getAdjacentOpenDoors(engine.map, this.entity.x, this.entity.y);
    if (openDoors.length === 0) {
      const msg = 'No open door nearby.';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    if (openDoors.length === 1) {
      const door = openDoors[0];
      const closeAction = new CloseDoorAction(this.entity, door.x, door.y);
      return closeAction.perform(engine);
    }

    // More than 1 door: prompt for direction
    const msg = 'Close which door? [Direction]';
    engine.log(msg);
    return {
      success: false,
      cost: 0,
      message: msg,
    };
  }
}

/**
 * Attempts to force a locked door open through brute strength.
 * Roll: 1d20 + floor(STR/4) vs lockDifficulty.
 * On failure the attacker takes 1d4 damage from the recoil.
 */
export class BashDoorAction implements Action {
  public readonly entity: Entity;
  public readonly x: number;
  public readonly y: number;

  constructor(entity: Entity, x: number, y: number) {
    this.entity = entity;
    this.x = x;
    this.y = y;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return { success: false, cost: 0, message: `${this.entity.name} cannot bash doors while defeated.` };
    }

    const tile = engine.map.getTile(this.x, this.y);
    if (!tile || !(tile.isClosedDoor || tile.type === 'door_closed')) {
      return { success: false, cost: 0, message: 'There is no closed door to bash there.' };
    }

    if (!tile.locked) {
      // Door is unlocked — just open it (no cost benefit to bashing)
      engine.map.setTile(this.x, this.y, TILES.DOOR_OPEN);
      this.entity.consumeEnergy(BASE_ACTION_COST);
      const msg = `${this.entity.name} shoulders the unlocked door open with brute force!`;
      engine.log(msg);
      return { success: true, cost: BASE_ACTION_COST, message: msg };
    }

    const str = (this.entity as any).strength ?? 10;
    const lockDC = tile.lockDifficulty ?? 14;
    const roll = Math.floor(Math.random() * 20) + 1 + Math.floor(str / 4);

    this.entity.consumeEnergy(BASE_ACTION_COST);

    if (roll >= lockDC) {
      tile.locked = false;
      engine.map.setTile(this.x, this.y, TILES.DOOR_OPEN);
      const msg = `${this.entity.name} smashes through the locked door! (Rolled ${roll} vs DC ${lockDC})`;
      engine.log(msg);
      return { success: true, cost: BASE_ACTION_COST, message: msg };
    }

    // Failed bash — take recoil damage (1d4)
    const recoil = Math.floor(Math.random() * 4) + 1;
    this.entity.takeDamage(recoil);
    const msg = `${this.entity.name} slams into the door but it holds! (Rolled ${roll} vs DC ${lockDC}) — takes ${recoil} recoil damage.`;
    engine.log(msg);
    return { success: false, cost: BASE_ACTION_COST, message: msg };
  }
}

