import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { Action } from './action';
import { MeleeAttackAction } from './combat';
import { OpenDoorAction } from './door';
import { NPC } from '../entities/npc';
import { ExecuteChoiceAction } from './choiceAction';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import type { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { TILES, getTileDefinition } from '../grid/tile';
import { getAltarDefinition, isAltarSpent } from '../magic/altars';
import { formatMagicMessage } from '../magic/magicConfig';
import { isPrologueHoldingChoices } from '../quest/prologue';
import { burnOnSacredGround } from '../combat/sacredGround';
import { wornModifiers } from '../items/wornModifiers';

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

    // A monster on the hero's side (the companion) or a neutral one (Entity.setFaction)
    // that the hero walks into is lifted off the map for the step and put back where the
    // hero stood, so the two trade places and neither walls off a one-tile corridor. Every
    // exit below puts it back.
    const fromX = this.entity.x;
    const fromY = this.entity.y;
    let steppedAside: Monster | null = null;
    const putBack = (x: number, y: number): void => {
      if (!steppedAside) return;
      steppedAside.setPosition(x, y);
      engine.map.addEntity(steppedAside);
      steppedAside = null;
    };

    // 2. Entity Collision Check (Bump-Attack vs Hostile, or Talk to NPC)
    const targetEntity = engine.map.getEntityAt(targetX, targetY, this.entity.planeId);
    if (targetEntity) {
      if (this.entity.isHostileTo(targetEntity)) {
        // Automatically trigger bump-attack
        const attackAction = new MeleeAttackAction(this.entity, targetEntity);
        return attackAction.perform(engine);
      } else if (
        this.entity.type === 'player' &&
        targetEntity instanceof Monster &&
        (targetEntity.faction === 'neutral' || targetEntity.faction === 'player')
      ) {
        steppedAside = targetEntity;
        engine.map.removeEntity(targetEntity);
      } else {
        if (this.entity.type === 'player' && targetEntity instanceof NPC) {
          // An NPC with a choice opens it (NpcConfig.choiceId); it never resolves.
          const npcChoice = targetEntity.choiceId ? engine.manifest?.choices?.[targetEntity.choiceId] : undefined;
          if (npcChoice && engine.onChoiceInteract) {
            engine.onChoiceInteract(npcChoice, (optionId: string) => {
              engine.handlePlayerAction(new ExecuteChoiceAction(this.entity as Player, npcChoice, optionId));
            });
          } else {
            engine.interactWithNpc(targetEntity);
          }
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
      putBack(targetX, targetY);
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
      putBack(targetX, targetY);
      return {
        success: false,
        cost: 0,
        message: `Failed to move ${this.entity.name}.`,
      };
    }

    if (steppedAside) {
      const passed = steppedAside as Monster;
      engine.log(passed.faction === 'player' ? `You trade places with ${passed.name}.` : `${passed.name} stands aside and lets you pass.`);
      putBack(fromX, fromY);
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

    // 5b2. Holy ground burns a bearer of a `sacredGroundBurn` item (Hel-touched) on arrival.
    if (burnOnSacredGround(engine, this.entity).killed) {
      return { success: true, cost, message: `${this.entity.name} was consumed by holy ground!` };
    }

    // 5b3. Trickster's Step: every Nth step blinks the bearer 2–4 tiles. The count lives in a
    // world counter keyed by the modifier, so it survives a save.
    for (const mod of wornModifiers(this.entity)) {
      if (!mod.blinkEverySteps || !mod.blinkRange) continue;
      const key = `steps:${mod.id}`;
      if (engine.modifyWorldCounter(key, 1) < mod.blinkEverySteps) continue;
      engine.modifyWorldCounter(key, -engine.getWorldCounter(key));
      const [lo, hi] = mod.blinkRange;
      const spots: Array<{ x: number; y: number }> = [];
      for (let dy = -hi; dy <= hi; dy++) {
        for (let dx = -hi; dx <= hi; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const bx = this.entity.x + dx;
          const by = this.entity.y + dy;
          if (d < lo || d > hi || !engine.map.inBounds(bx, by) || !engine.map.isPassable(bx, by) || engine.map.getEntityAt(bx, by)) continue;
          spots.push({ x: bx, y: by });
        }
      }
      if (spots.length === 0) continue;
      const dest = spots[Math.floor(engine.rng() * spots.length)];
      engine.map.moveEntity(this.entity, dest.x, dest.y);
      engine.log(`${mod.name} flings ${this.entity.name} across the floor!`);
      engine.emitGameEvent({ type: 'chaotic_proc', turn: engine.turnCount, actorId: this.entity.id, procType: 'trickster_step', description: mod.name, teleportDestination: dest });
      engine.recordVisualEffects([{ type: 'screen_flash', color: '#c084fc', durationMs: 150 }]);
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
      let choiceTriggered = false;
      const destTile = engine.map.getTile(targetX, targetY);
      const handlerId = destTile?.interactionHandlerId ?? destTile?.type;
      if (handlerId === 'stairs_down' || destTile?.isStairsDown) {
        engine.log("You stand upon stairs leading down. Press '>' or [Enter] to descend.");
      } else if (handlerId === 'stairs_up' || destTile?.isStairsUp) {
        engine.log("You stand upon stairs leading up. Press '<' or [Enter] to ascend.");
      } else if (handlerId === 'quest_victory_portal') {
        engine.log('*** You step into the shimmering victory portal! ***');
        // The portal ends the run the way the fight did: whichever ending is eligible here.
        const endingId = engine.gameState?.checkVictoryEligible(engine);
        engine.gameState?.triggerVictory(engine, undefined, endingId === 'default' ? undefined : endingId);
        const returnPos =
          engine.manifest?.quest?.townReturnPosition ??
          engine.manifest?.town?.playerSpawn ??
          { x: 5, y: 5 };
        engine.changeFloor(0, returnPos);
      } else if (handlerId && getAltarDefinition(engine, handlerId)) {
        // Spell altar (manifest.magic.altars): the presentation layer opens its rite on this event.
        const altar = getAltarDefinition(engine, handlerId)!;
        if (isAltarSpent(engine, targetX, targetY)) {
          engine.log(formatMagicMessage(altar.spentMessage, { altar: altar.name }));
        } else {
          engine.log(`You stand before ${altar.name}.`);
          engine.emitGameEvent({
            type: 'altar_reached',
            turn: engine.turnCount,
            actorId: this.entity.id,
            data: { altarId: altar.id, x: targetX, y: targetY },
          });
        }
      } else if (handlerId && engine.manifest?.choices?.[handlerId]) {
        // Generic tile-triggered choice (ARCHITECTURE.md §3): any tile whose
        // interactionHandlerId matches a manifest.choices key becomes an interactive
        // decision point, with zero campaign-specific names baked into engine code.
        const choiceDef = engine.manifest.choices[handlerId];
        let resolvedMsg: string | undefined;
        if (choiceDef.resolvedStates) {
          for (const state of choiceDef.resolvedStates) {
            const applies = state.flag !== undefined ? engine.getWorldFlag(state.flag) : !!state.when && evaluatePredicate(state.when, engine.worldState);
            if (applies) {
              resolvedMsg = state.message;
              break;
            }
          }
        }
        if (resolvedMsg) {
          engine.log(resolvedMsg);
        } else if (!engine.getWorldFlag(`${handlerId}_resolved`)) {
          if (engine.onChoiceInteract) {
            choiceTriggered = true;
            engine.onChoiceInteract(
              choiceDef,
              (optionId: string) => {
                if (!choiceDef.options.find((o) => o.id === optionId)?.keepsOpen) {
                  engine.setWorldFlag(`${handlerId}_resolved`, true);
                }
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
      }

      // A run that just ended (the victory portal) offers no more choices; a prologue's scene
      // and its aftermath hold progress choices until they are over, so a milestone never breaks into them.
      const runOver = !!engine.gameState && engine.gameState.runStatus !== 'active';
      const progressChoicesHeld = runOver || isPrologueHoldingChoices(engine.worldState, engine.manifest?.prologue, engine.currentFloor);

      // Kill-count-gated choice unlocks (ARCHITECTURE.md §3, StoryChoiceTrigger):
      // checked every player move rather than only on a specific tile, since the
      // trigger condition is progress (kills), not location.
      for (const trigger of progressChoicesHeld ? [] : engine.manifest?.storyChoiceTriggers ?? []) {
        const kills = engine.compendium.getEntry(trigger.monsterDefinitionId).kills;
        if (trigger.progressStartFlag && kills >= 1 && !engine.getWorldFlag(trigger.progressStartFlag)) {
          engine.setWorldFlag(trigger.progressStartFlag, true);
          if (trigger.progressStartMessage) engine.log(trigger.progressStartMessage);
        }
        if (kills < trigger.killsRequired) continue;
        if (trigger.when && !evaluatePredicate(trigger.when, engine.worldState)) continue;
        const offeredFlag = `${trigger.id}_offered`;
        if (engine.getWorldFlag(offeredFlag)) continue;
        const choiceDef = engine.manifest?.choices?.[trigger.choiceId];
        if (!choiceDef) continue;
        engine.setWorldFlag(offeredFlag, true);
        if (engine.onChoiceInteract) {
          choiceTriggered = true;
          engine.onChoiceInteract(choiceDef, (optionId: string) => {
            engine.handlePlayerAction(new ExecuteChoiceAction(this.entity as Player, choiceDef, optionId));
          });
          break;
        } else {
          engine.log(`You stand before ${choiceDef.title}. It awaits your decision.`);
          break;
        }
      }

      // Attribute-threshold-gated choice unlocks (ARCHITECTURE.md §3, AttributeMilestoneTrigger):
      // checked every player move rather than inside Player.allocateAttribute for three reasons:
      // (1) matches StoryChoiceTrigger: the condition is progress (attributes), not location;
      // (2) allocateAttribute is a pure mutator with no engine handle and must not gain one;
      // (3) avoids opening a choice modal on top of the still-open level-up modal.
      if (!choiceTriggered && !progressChoicesHeld) {
        for (const milestone of engine.manifest?.attributeMilestones ?? []) {
          const playerAttr = (this.entity as Player)[milestone.attribute];
          if (typeof playerAttr !== 'number' || playerAttr < milestone.threshold) continue;
          const offeredFlag = `${milestone.id}_offered`;
          if (engine.getWorldFlag(offeredFlag)) continue;
          const choiceDef = engine.manifest?.choices?.[milestone.choiceId];
          if (!choiceDef) continue;
          engine.setWorldFlag(offeredFlag, true);
          if (engine.onChoiceInteract) {
            choiceTriggered = true;
            engine.onChoiceInteract(choiceDef, (optionId: string) => {
              engine.handlePlayerAction(new ExecuteChoiceAction(this.entity as Player, choiceDef, optionId));
            });
            break;
          } else {
            engine.log(`You stand before ${choiceDef.title}. It awaits your decision.`);
            break;
          }
        }
      }

      // "Driven off" boss resolution (ARCHITECTURE.md §3, BossFleeResolution):
      // converts sustained fleeing (the existing fleeHealthPercent mechanic) into a
      // concluded encounter, since nothing else does.
      for (const watcher of engine.manifest?.bossFleeResolutions ?? []) {
        if (engine.getWorldFlag(watcher.sealedFlag)) continue;
        const boss = engine.map
          .getAllEntities()
          .find(
            (e): e is Monster => e instanceof Monster && e.definitionId === watcher.monsterDefinitionId && e.isAlive()
          );
        const fleeCounterKey = `boss_flee_turns:${watcher.monsterDefinitionId}`;
        if (boss && boss.aiState === 'fleeing') {
          const turnsFled = engine.modifyWorldCounter(fleeCounterKey, 1);
          if (turnsFled >= watcher.fleeTurnsRequired) {
            engine.setWorldFlag(watcher.sealedFlag, true);
            const portal = watcher.portalTileId ? getTileDefinition(watcher.portalTileId) : undefined;
            if (portal) {
              engine.map.setTile(boss.x, boss.y, portal);
              if (watcher.portalMessage) engine.log(watcher.portalMessage);
            }
            engine.removeEntity(boss);
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
