import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Actor } from '../entities/actor';
import { Player } from '../entities/player';
import type { GameEngine } from '../engine';
import { MovementAction } from './movement';
import { MeleeAttackAction } from './combat';
import { CastSpellAction } from './spell-actions';
import { WaitAction } from './wait';
import { OpenDoorAction, CloseDoorAction, SmartCloseDoorAction } from './door';
import { ClimbStairsAction } from './stairs';
import { EquipAction } from './inventory-actions';

export interface ActionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface GameAction<TArgs = any> {
  readonly id: string;
  readonly name?: string;
  validate(actor: Actor, args: TArgs, engine: GameEngine): ActionValidationResult;
  calculateEnergyCost(actor: Actor, args: TArgs, engine: GameEngine): number;
  execute(actor: Actor, args: TArgs, engine: GameEngine): ActionResult;
}

import { activeActionStore } from '../registries/actionRegistryStore';

/**
 * Process-wide facade over whichever action command store is active (ARCHITECTURE.md §3, P-22).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class ActionRegistry {
  public static register<TArgs = any>(action: GameAction<TArgs>): void {
    activeActionStore().register(action);
  }

  public static registerAll(actions: readonly GameAction<any>[] | Record<string, GameAction<any>>): void {
    const list = Array.isArray(actions) ? actions : Object.values(actions);
    for (const a of list) {
      this.register(a);
    }
  }

  public static get<TArgs = any>(id: string): GameAction<TArgs> | undefined {
    return activeActionStore().get(id);
  }

  public static has(id: string): boolean {
    return activeActionStore().has(id);
  }

  public static getAll(): ReadonlyMap<string, GameAction<any>> {
    return activeActionStore().getMap();
  }

  public static unregister(id: string): boolean {
    return activeActionStore().unregister(id);
  }

  public static clear(): void {
    activeActionStore().clear();
  }

  public static resetToDefaults(): void {
    activeActionStore().clear();
    registerDefaultActions();
  }

  public static execute<TArgs = any>(
    actionId: string,
    actor: Actor,
    args: TArgs,
    engine: GameEngine
  ): ActionResult {
    const action = activeActionStore().get(actionId);
    if (!action) {
      return {
        success: false,
        cost: 0,
        message: `Unknown action command: '${actionId}'.`,
      };
    }

    const validation = action.validate(actor, args, engine);
    if (!validation.valid) {
      return {
        success: false,
        cost: 0,
        message: validation.reason ?? 'Action validation failed.',
      };
    }

    const cost = action.calculateEnergyCost(actor, args, engine);
    const result = action.execute(actor, args, engine);

    // Ensure result reflects energy cost
    if (result.success && result.cost === undefined) {
      result.cost = cost;
    }

    return result;
  }
}

// ─────────────────────────────────────────────────────────────
// Default Engine Actions
// ─────────────────────────────────────────────────────────────

export interface MoveActionArgs {
  dx: number;
  dy: number;
}

export interface MeleeAttackActionArgs {
  targetX?: number;
  targetY?: number;
  dx?: number;
  dy?: number;
}

export interface CastSpellActionArgs {
  spellId: string;
  targetPosition?: { x: number; y: number };
}

export interface UseItemActionArgs {
  item: import('../items/item').Item;
  slot?: import('../items/item').EquipmentSlot;
}

export interface InteractActionArgs {
  x?: number;
  y?: number;
  interactionType?: 'stairs' | 'door' | 'search';
}

export function registerDefaultActions(): void {
  // 1. Move Action
  ActionRegistry.register<MoveActionArgs>({
    id: 'move',
    name: 'Move',
    validate(actor, args, _engine) {
      if (!actor.canMove()) {
        return { valid: false, reason: `${actor.name} is unable to move!` };
      }
      if (args.dx === 0 && args.dy === 0) {
        return { valid: false, reason: 'Zero delta movement.' };
      }
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, args, engine) {
      const movement = new MovementAction(actor, args.dx, args.dy);
      return movement.perform(engine);
    },
  });

  // 2. Melee Attack Action
  ActionRegistry.register<MeleeAttackActionArgs>({
    id: 'melee_attack',
    name: 'Melee Attack',
    validate(actor, args, engine) {
      const targetX = args.targetX ?? (args.dx !== undefined ? actor.x + args.dx : undefined);
      const targetY = args.targetY ?? (args.dy !== undefined ? actor.y + args.dy : undefined);
      if (targetX === undefined || targetY === undefined) {
        return { valid: false, reason: 'Target coordinates required for melee attack.' };
      }
      const target = engine.map.getEntityAt(targetX, targetY);
      if (!target) {
        return { valid: false, reason: 'No entity at target location.' };
      }
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, args, engine) {
      const targetX = args.targetX ?? (args.dx !== undefined ? actor.x + args.dx : actor.x);
      const targetY = args.targetY ?? (args.dy !== undefined ? actor.y + args.dy : actor.y);
      const target = engine.map.getEntityAt(targetX, targetY);
      if (!target) {
        return { success: false, cost: 0, message: 'No target to attack.' };
      }
      const attack = new MeleeAttackAction(actor, target);
      return attack.perform(engine);
    },
  });

  // 3. Cast Spell Action
  ActionRegistry.register<CastSpellActionArgs>({
    id: 'cast_spell',
    name: 'Cast Spell',
    validate(actor, args, engine) {
      const spell = engine.manifest?.spells?.find((s) => s.id === args.spellId);
      if (!spell) {
        return { valid: false, reason: `Unknown spell: ${args.spellId}` };
      }
      if (actor instanceof Player && actor.mana < spell.manaCost) {
        return { valid: false, reason: 'Not enough mana!' };
      }
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, args, engine) {
      const targetX = args.targetPosition?.x ?? actor.x;
      const targetY = args.targetPosition?.y ?? actor.y;
      const cast = new CastSpellAction(actor, args.spellId, targetX, targetY);
      return cast.perform(engine);
    },
  });

  // 4. Use / Equip Item Action
  ActionRegistry.register<UseItemActionArgs>({
    id: 'use_item',
    name: 'Use Item',
    validate(_actor, args, _engine) {
      if (!args.item) {
        return { valid: false, reason: 'No item specified.' };
      }
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, args, engine) {
      if (!(actor instanceof Player)) {
        return { success: false, cost: 0, message: 'Only the player can equip items.' };
      }
      const equip = new EquipAction(actor, args.item.id, args.slot);
      return equip.perform(engine);
    },
  });

  // 5. Interact Action (doors, stairs, fixtures)
  ActionRegistry.register<InteractActionArgs>({
    id: 'interact',
    name: 'Interact',
    validate(_actor, _args, _engine) {
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, args, engine) {
      const x = args.x ?? actor.x;
      const y = args.y ?? actor.y;
      const tile = engine.map.getTile(x, y);

      if (args.interactionType === 'stairs' || tile?.type === 'stairs_down' || tile?.type === 'stairs_up') {
        if (!(actor instanceof Player)) {
          return { success: false, cost: 0, message: 'Only the player can take the stairs.' };
        }
        const stairs = new ClimbStairsAction(actor);
        return stairs.perform(engine);
      }

      if (tile?.type === 'door_closed') {
        const door = new OpenDoorAction(actor, x, y);
        return door.perform(engine);
      }

      return { success: true, cost: 0, message: 'Nothing here to interact with.' };
    },
  });

  // 6. Wait Action
  ActionRegistry.register<void>({
    id: 'wait',
    name: 'Wait',
    validate(_actor, _args, _engine) {
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, _args, engine) {
      const wait = new WaitAction(actor);
      return wait.perform(engine);
    },
  });

  // 7. Close Door Action (Smart-Close targeting)
  ActionRegistry.register<{ x?: number; y?: number; direction?: { dx: number; dy: number } } | void>({
    id: 'close_door',
    name: 'Close Door',
    validate(_actor, _args, _engine) {
      return { valid: true };
    },
    calculateEnergyCost(actor, _args, _engine) {
      return actor.getActionCost(BASE_ACTION_COST);
    },
    execute(actor, args, engine) {
      if (args && args.x !== undefined && args.y !== undefined) {
        const action = new CloseDoorAction(actor, args.x, args.y);
        return action.perform(engine);
      }
      const direction = args && args.direction ? args.direction : undefined;
      const smartAction = new SmartCloseDoorAction(actor, direction);
      return smartAction.perform(engine);
    },
  });
}

// Auto-register defaults on load
registerDefaultActions();
