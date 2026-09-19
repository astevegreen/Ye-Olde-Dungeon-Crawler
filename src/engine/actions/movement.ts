import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { Action } from './action';
import { MeleeAttackAction } from './combat';
import { OpenDoorAction } from './door';
import { NPC } from '../entities/npc';
import { ExecuteChoiceAction } from './choiceAction';
import type { Player } from '../entities/player';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { TILES } from '../grid/tile';

/** Tile type identifier for shallow water terrain that imposes a movement energy penalty. */
const SHALLOW_WATER_TILE = 'shallow_water';

export class MovementAction implements Action {
  public readonly entity: Entity;
  public readonly dx: number;
  public readonly dy: number;

  constructor(entity: Entity, dx: number, dy: number) {
    this.entity = entity;
    this.dx = dx;
    this.dy = dy;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: `${this.entity.name} cannot move while defeated.`,
      };
    }

    if (!this.entity.canMove()) {
      const message = `${this.entity.name} is overburdened and cannot move!`;
      engine.log(message);
      return {
        success: false,
        cost: 0,
        message,
      };
    }

    if (this.dx === 0 && this.dy === 0) {
      return {
        success: false,
        cost: 0,
        message: `${this.entity.name} stays in place.`,
      };
    }

    const targetX = this.entity.x + this.dx;
    const targetY = this.entity.y + this.dy;

    // 1. Map Boundary Collision Check
    if (!engine.map.inBounds(targetX, targetY)) {
      const message = `${this.entity.name} cannot move beyond the edge of the world.`;
      engine.log(message);
      return {
        success: false,
        cost: 0,
        message,
      };
    }

    // 2. Entity Collision Check (Bump-Attack vs Hostile, or Talk to NPC)
    const targetEntity = engine.map.getEntityAt(targetX, targetY, this.entity.planeId);
    if (targetEntity) {
      if (this.entity.isHostileTo(targetEntity)) {
        // Automatically trigger bump-attack
        const attackAction = new MeleeAttackAction(this.entity, targetEntity);
        return attackAction.perform(engine);
      } else {
        if (this.entity.type === 'player' && targetEntity instanceof NPC) {
          engine.interactWithNpc(targetEntity);
          return {
            success: true,
            cost: 0,
            message: `Spoke with ${targetEntity.name}.`,
          };
        }
        const message = `${this.entity.name} cannot move onto friendly ${targetEntity.name}.`;
        engine.log(message);
        return {
          success: false,
          cost: 0,
          message,
        };
      }
    }

    // 3. Tile Passability Collision Check
    const tile = engine.map.getTile(targetX, targetY);
    const isWalkable = tile ? (tile.walkable ?? tile.passable) : false;
    if (!tile || !isWalkable) {
      // Auto-resolve OpenDoorAction on bump into closed doors (orthogonal & diagonal)
      if (tile && (tile.isClosedDoor || tile.type === 'door_closed')) {
        const openAction = new OpenDoorAction(this.entity, targetX, targetY);
        return openAction.perform(engine);
      }

      let desc = 'obstacle';
      if (tile) {
        if (tile.type === 'wall' || tile.name.toLowerCase().includes('wall')) {
          desc = 'wall';
        } else {
          desc = tile.name.toLowerCase();
        }
      }
      const message = `${this.entity.name} bumps into a ${desc}.`;
      engine.log(message);
      return {
        success: false,
        cost: 0,
        message,
      };
    }

    // 4. Valid Movement
    const moved = engine.map.moveEntity(this.entity, targetX, targetY);
    if (!moved) {
      return {
        success: false,
        cost: 0,
        message: `Failed to move ${this.entity.name}.`,
      };
    }

    const destTile = engine.map.getTile(targetX, targetY);
    const baseCost = destTile?.type === SHALLOW_WATER_TILE ? BASE_ACTION_COST + 50 : BASE_ACTION_COST;
    const cost = this.entity.getActionCost(baseCost);
    this.entity.consumeEnergy(cost);
    if (destTile?.type === SHALLOW_WATER_TILE && this.entity.type === 'player') {
      engine.log('You wade through the cold shallow water (+50 move energy cost).');
    }

    // 5. Active Trap Check
    const trap = engine.map.getTrapAt(targetX, targetY);
    if (trap && !trap.disarmed) {
      trap.trigger(this.entity, engine);
    }

    // 5b. Surface Grid Step Effects (Ice Slide, Acid Burn, etc.)
    if (engine.surfaces) {
      const { energyPenalty } = engine.surfaces.handleEntityStep(
        this.entity,
        targetX,
        targetY,
        this.dx,
        this.dy,
        engine
      );
      if (energyPenalty > 0) {
        this.entity.consumeEnergy(energyPenalty);
      }
    }

    // 5c. Dispatch onMove Hook Event
    HookDispatcher.dispatch('onMove', {
      engine,
      attacker: this.entity,
      position: { x: targetX, y: targetY },
      dx: this.dx,
      dy: this.dy,
    });

    // 5d. Passive Perception Check for Player
    if (this.entity.type === 'player') {
      const player = this.entity as Player;
      const passivePerception = 10 + Math.floor((player.intelligence + player.dexterity + player.level) / 4);
      for (let pdy = -1; pdy <= 1; pdy++) {
        for (let pdx = -1; pdx <= 1; pdx++) {
          if (pdx === 0 && pdy === 0) continue;
          const nx = targetX + pdx;
          const ny = targetY + pdy;
          if (!engine.map.inBounds(nx, ny)) continue;

          // Check secret door
          const t = engine.map.getTile(nx, ny);
          if (t && (t.type === 'secret_door' || t.hidden)) {
            if (passivePerception >= 15) {
              engine.map.setTile(nx, ny, { ...TILES.DOOR_CLOSED, hidden: false });
              engine.log('Your keen senses detect a secret door hidden in the wall!');
            }
          }

          // Check hidden trap
          const tr = engine.map.getTrapAt(nx, ny);
          if (tr && !tr.revealed) {
            if (passivePerception >= tr.concealment + 2) {
              tr.revealed = true;
              engine.map.setTile(nx, ny, TILES.TRAP);
              engine.log(`Your sharp eyes notice a hidden ${tr.type} trap!`);
            }
          }
        }
      }
    }

    // 6. Stairs and Altar Check for Player
    if (this.entity.type === 'player') {
      const destTile = engine.map.getTile(targetX, targetY);
      const handlerId = destTile?.interactionHandlerId ?? destTile?.type;
      if (handlerId === 'stairs_down' || destTile?.isStairsDown) {
        engine.log("You stand upon stairs leading down. Press '>' or [Enter] to descend.");
      } else if (handlerId === 'stairs_up' || destTile?.isStairsUp) {
        engine.log("You stand upon stairs leading up. Press '<' or [Enter] to ascend.");
      } else if (handlerId === 'gateway_valhalla') {
        engine.log('*** You step into the shimmering Gateway to Valhalla! ***');
        engine.gameState?.triggerVictory(engine, (engine as any).profileManager);
        engine.changeFloor(0, { x: 25, y: 23 });
      } else if (handlerId === 'altar_tyr') {
        const isPurified = engine.getWorldFlag('tyr_purified');
        const isDesecrated = engine.getWorldFlag('tyr_desecrated');
        if (isPurified) {
          engine.log('The purified Altar of Tyr radiates peace. The runes remain holy and silent.');
        } else if (isDesecrated) {
          engine.log('The shattered Altar of Tyr lies cold and ruined. Its power is spent.');
        } else {
          const choiceDef = engine.manifest?.choices?.['altar_tyr'];
          if (choiceDef) {
            if (engine.onChoiceInteract) {
              engine.onChoiceInteract(
                choiceDef,
                (optionId: string) => {
                  engine.handlePlayerAction(new ExecuteChoiceAction(this.entity as Player, choiceDef, optionId));
                },
                () => {
                  this.entity.energy += cost;
                }
              );
            } else {
              engine.log('You stand before the Ancient Altar of Tyr. Its divine power awaits your decision.');
            }
          }
        }
      } else if (handlerId && engine.manifest?.choices?.[handlerId] && !engine.getWorldFlag(`${handlerId}_resolved`)) {
        // Generic tile-triggered choice (ARCHITECTURE.md §3): any tile whose
        // interactionHandlerId matches a manifest.choices key becomes an interactive
        // decision point, with zero campaign-specific names baked in here — unlike
        // the altar_tyr branch above (a known, tracked exception; see P-03's
        // remaining tile-type work), a pack needs no engine change to add one.
        // Resolves at most once: the handler-scoped `<handlerId>_resolved` flag is
        // set the moment any option is actually chosen (not on open, so cancelling
        // leaves it re-triggerable).
        const choiceDef = engine.manifest.choices[handlerId];
        if (engine.onChoiceInteract) {
          engine.onChoiceInteract(
            choiceDef,
            (optionId: string) => {
              engine.setWorldFlag(`${handlerId}_resolved`, true);
              engine.handlePlayerAction(new ExecuteChoiceAction(this.entity as Player, choiceDef, optionId));
            },
            () => {
              this.entity.energy += cost;
            }
          );
        } else {
          engine.log(`You stand before ${choiceDef.title}. It awaits your decision.`);
        }
      }

      // Kill-count-gated choice unlocks (ARCHITECTURE.md §3, StoryChoiceTrigger):
      // checked every player move rather than only on a specific tile, since the
      // trigger condition is progress (kills), not location.
      for (const trigger of engine.manifest?.storyChoiceTriggers ?? []) {
        const kills = engine.compendium.getEntry(trigger.monsterDefinitionId).kills;
        if (trigger.progressStartFlag && kills >= 1 && !engine.getWorldFlag(trigger.progressStartFlag)) {
          engine.setWorldFlag(trigger.progressStartFlag, true);
        }
        if (kills < trigger.killsRequired) continue;
        const offeredFlag = `${trigger.id}_offered`;
        if (engine.getWorldFlag(offeredFlag)) continue;
        const choiceDef = engine.manifest?.choices?.[trigger.choiceId];
        if (!choiceDef) continue;
        engine.setWorldFlag(offeredFlag, true);
        if (engine.onChoiceInteract) {
          engine.onChoiceInteract(choiceDef, (optionId: string) => {
            engine.handlePlayerAction(new ExecuteChoiceAction(this.entity as Player, choiceDef, optionId));
          });
        } else {
          engine.log(`You stand before ${choiceDef.title}. It awaits your decision.`);
        }
      }

      // "Driven off" boss resolution (ARCHITECTURE.md §3, BossFleeResolution):
      // converts sustained fleeing (the existing fleeHealthPercent mechanic) into a
      // concluded encounter, since nothing else does.
      for (const watcher of engine.manifest?.bossFleeResolutions ?? []) {
        if (engine.getWorldFlag(watcher.sealedFlag)) continue;
        const boss = engine.map
          .getAllEntities()
          .find((e) => (e as any).definitionId === watcher.monsterDefinitionId && e.isAlive());
        const fleeCounterKey = `boss_flee_turns:${watcher.monsterDefinitionId}`;
        if (boss && (boss as any).aiState === 'fleeing') {
          const turnsFled = engine.modifyWorldCounter(fleeCounterKey, 1);
          if (turnsFled >= watcher.fleeTurnsRequired) {
            engine.setWorldFlag(watcher.sealedFlag, true);
            engine.map.removeEntity(boss);
            engine.log(`${boss.name} flees into the dark, driven off for good!`);
          }
        }
      }
    }

    return {
      success: true,
      cost,
    };
  }
}
