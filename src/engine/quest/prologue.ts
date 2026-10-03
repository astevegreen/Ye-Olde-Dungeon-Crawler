import type { GameEngine } from '../engine';
import type { EngineContext } from '../types/engineContext';
import type { PrologueDefinition, PrologueNpc } from '../types/manifest';
import type { WorldState } from '../state/worldState';
import type { GameMap } from '../grid/map';
import type { Position } from '../types';
import { getFlag, setFlag } from '../state/worldState';
import { Monster } from '../entities/monster';
import { NPC } from '../entities/npc';
import { createScaledMonster } from '../dungeon/spawner';
import { MonsterRegistry } from '../bestiary/monsterDefinitions';

/**
 * The prologue (`GameContentManifest.prologue`): a scene on the town map before the run
 * proper. The engine stages it and undoes it; the pack's hooks run everything between and
 * decide when it is over.
 */

/** The id prefix of the monsters a prologue places; those left when it ends leave with it. */
const PROLOGUE_MONSTER_PREFIX = 'prologue-monster-';

/** Whether a prologue is under way: begun and not yet concluded. */
export function isPrologueRunning(worldState: WorldState, prologue: PrologueDefinition | undefined): boolean {
  return !!prologue && getFlag(worldState, prologue.startFlag) && !getFlag(worldState, prologue.endFlag);
}

function npcFrom(def: PrologueNpc, position: Position): NPC {
  return new NPC({
    id: def.id,
    name: def.name,
    role: def.role ?? 'villager',
    position,
    greeting: def.greeting,
    dialogText: def.dialogText,
    isStationary: true,
    choiceId: def.choiceId,
  });
}

/** `position` if it is free to stand on, else the nearest free tile within three steps. */
function freeTileNear(map: GameMap, position: Position): Position | undefined {
  for (let r = 0; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = position.x + dx;
        const y = position.y + dy;
        if (map.inBounds(x, y) && map.isPassable(x, y) && !map.getEntityAt(x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

/**
 * Re-applies what a running prologue changes about the world but the save does not keep:
 * the unlit town and the hero's HP floor. Called when it begins and after a load.
 */
export function applyPrologueState(engine: GameEngine): void {
  const prologue = engine.manifest.prologue;
  if (!prologue || !isPrologueRunning(engine.worldState, prologue)) return;
  if (prologue.dark && engine.currentFloor === 0) engine.map.lit = false;
  engine.player.setHpFloor(prologue.heroHpFloor ?? 0);
}

/**
 * Begins the pack's prologue on a new run whose hero stands in town: sets its start flag,
 * places its monsters and NPCs, and applies its state. False when the pack has none or
 * the hero is not in town.
 */
export function beginPrologue(engine: GameEngine): boolean {
  const prologue = engine.manifest.prologue;
  if (!prologue || engine.currentFloor !== 0) return false;
  setFlag(engine.worldState, prologue.startFlag, true);

  (prologue.monsters ?? []).forEach((placement, i) => {
    const def = engine.registries.monsters.get(placement.definitionId) ?? MonsterRegistry.get(placement.definitionId);
    const { x, y } = placement.position;
    if (!def || !engine.map.inBounds(x, y) || !engine.map.isPassable(x, y) || engine.map.getEntityAt(x, y)) return;
    engine.addEntity(
      createScaledMonster(def, `${PROLOGUE_MONSTER_PREFIX}${i + 1}`, { x, y }, 1, undefined, undefined, engine.manifest.monsterScaling, engine.player.difficulty)
    );
  });
  for (const npc of prologue.npcs ?? []) {
    const at = freeTileNear(engine.map, npc.position);
    if (at) engine.addEntity(npcFrom(npc, at));
  }

  applyPrologueState(engine);
  if (prologue.openingMessage) engine.log(prologue.openingMessage);
  return true;
}

/**
 * Ends a running prologue: the prologue's monsters and NPCs still on the map leave, the town takes
 * back its own light (`townLit`, the pack's `town.lit`), the hero can die again, the
 * aftermath NPCs take their places, and `endFlag` is set. Does nothing when none is running.
 */
export function concludePrologue(ctx: EngineContext, prologue: PrologueDefinition, townLit: boolean): void {
  if (!isPrologueRunning(ctx.worldState, prologue)) return;

  for (const entity of ctx.map.getAllEntities()) {
    if (entity instanceof Monster && entity.id.startsWith(PROLOGUE_MONSTER_PREFIX)) ctx.removeEntity(entity);
  }
  for (const npc of prologue.npcs ?? []) {
    const entity = ctx.map.getEntityById(npc.id);
    if (entity) ctx.removeEntity(entity);
  }
  if (ctx.currentFloor === 0) ctx.map.lit = townLit;
  ctx.player.setHpFloor(0);
  for (const npc of prologue.aftermathNpcs ?? []) {
    const at = freeTileNear(ctx.map, npc.position);
    if (at) ctx.map.addEntity(npcFrom(npc, at));
  }

  setFlag(ctx.worldState, prologue.endFlag, true);
  if (prologue.closingMessage) ctx.log(prologue.closingMessage);
}
