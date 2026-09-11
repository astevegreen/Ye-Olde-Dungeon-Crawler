import type { Action } from './action';
import type { ActionResult, Position } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';

export class PlanePortalAction implements Action {
  public readonly actor: Entity;
  public readonly targetPlaneId: string;
  public readonly targetPosition?: Position;

  constructor(actor: Entity, targetPlaneId?: string, targetPosition?: Position) {
    this.actor = actor;
    // Default toggles between physical and liminal
    this.targetPlaneId = targetPlaneId ?? (actor.planeId === 'physical' ? 'liminal' : 'physical');
    this.targetPosition = targetPosition;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.actor.isAlive()) {
      return { success: false, cost: 0, message: `${this.actor.name} cannot traverse planes while incapacitated.` };
    }

    const planeMgr = engine.planeManager;
    if (!planeMgr || !planeMgr.hasPlane(this.targetPlaneId)) {
      return {
        success: false,
        cost: 0,
        message: `Target plane '${this.targetPlaneId}' is not accessible.`,
      };
    }

    const currentPlane = this.actor.planeId;
    if (currentPlane === this.targetPlaneId) {
      return {
        success: false,
        cost: 0,
        message: `${this.actor.name} is already present on plane '${this.targetPlaneId}'.`,
      };
    }

    const success = planeMgr.transferEntity(
      engine.map,
      this.actor,
      this.targetPlaneId,
      this.targetPosition
    );

    if (!success) {
      return {
        success: false,
        cost: 0,
        message: `Plane portal transition failed: destination is blocked.`,
      };
    }

    const cost = this.actor.getActionCost(BASE_ACTION_COST);
    this.actor.consumeEnergy(cost);

    const targetName = planeMgr.getPlane(this.targetPlaneId)?.name ?? this.targetPlaneId;
    const msg = `${this.actor.name} steps through the dimensional boundary into ${targetName}!`;
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}

export class AstralProjectionAction implements Action {
  public readonly actor: Entity;
  public readonly targetPlaneId: string;

  constructor(actor: Entity, targetPlaneId = 'liminal') {
    this.actor = actor;
    this.targetPlaneId = targetPlaneId;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.actor.isAlive()) {
      return { success: false, cost: 0, message: `${this.actor.name} is incapacitated.` };
    }

    const planeMgr = engine.planeManager;
    if (!planeMgr || !planeMgr.hasPlane(this.targetPlaneId)) {
      return { success: false, cost: 0, message: `Cannot project to unknown plane '${this.targetPlaneId}'.` };
    }

    const destX = this.actor.x;
    const destY = this.actor.y;

    const shifted = planeMgr.transferEntity(engine.map, this.actor, this.targetPlaneId, {
      x: destX,
      y: destY,
    });

    if (!shifted) {
      return {
        success: false,
        cost: 0,
        message: `Astral projection failed: destination coordinate is obstructed on ${this.targetPlaneId}.`,
      };
    }

    const cost = this.actor.getActionCost(BASE_ACTION_COST);
    this.actor.consumeEnergy(cost);

    const msg = `${this.actor.name}'s consciousness separates into the ${this.targetPlaneId} plane!`;
    engine.log(msg);

    return {
      success: true,
      cost,
      message: msg,
    };
  }
}
