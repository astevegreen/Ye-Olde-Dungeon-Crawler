import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MovementAction } from '../movement';
import { WaitAction } from '../wait';
import type { ActionHook, ActionHookContext } from '../actionPipeline';
import type { ChoiceDefinition } from '../../types/choice';

/**
 * A move onto a cancelable tile choice (cotw's Skaldic Runestones) spends its energy and
 * counts as a turn (ARCHITECTURE.md §4). Stepping away must not hand that energy back after
 * the turn already advanced: the monsters would lose their answer to the move, and the
 * replay engine (no dialog, never paused) would answer it, so the two diverge (§2).
 */
const SHRINE: ChoiceDefinition = {
  id: 'test_shrine',
  title: 'The Test Shrine',
  description: 'A shrine for testing.',
  options: [{ id: 'a', label: 'A', consequences: [] }],
  cancelable: true,
};

function buildEngine() {
  const map = new GameMap(14, 14, TILES.FLOOR);
  map.setTile(4, 3, { ...TILES.FLOOR, type: 'test_shrine', interactionHandlerId: 'test_shrine' } as any);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 500, maxHp: 500, attack: 5, defense: 50 },
  });
  let monsterActions = 0;
  // The monster stands still and spends a full turn, so its count is its number of turns.
  const counter: ActionHook = {
    id: 'count-monster',
    phase: 'pre',
    actionType: '*',
    execute: (ctx: ActionHookContext) => {
      if (ctx.actor?.id === 'orc-1') {
        monsterActions++;
        return { proceed: false, result: { success: true, cost: 100 } };
      }
      return { proceed: true };
    },
  };
  const engine = new GameEngine({
    map,
    player,
    floor: 1,
    manifest: { id: 'choice-test', name: 'Choice Test', actionHooks: [counter], choices: { test_shrine: SHRINE } } as any,
  });
  engine.registries.tiles.register({
    type: 'test_shrine',
    name: 'Test Shrine',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '?',
    interactionHandlerId: 'test_shrine',
  } as any);
  const monster = new Monster({
    id: 'orc-1',
    name: 'Orc',
    position: { x: 12, y: 12 },
    stats: { hp: 30, maxHp: 30, attack: 3, defense: 0 },
    speed: 100,
    definitionId: 'orc',
    aiType: 'melee',
    aiState: 'hunting',
    fleeHealthPercent: 0,
    xpValue: 5,
    lootTable: [],
  });
  engine.addEntity(monster);
  // Settle the scheduler: one full round, then count from zero.
  engine.handlePlayerAction(new WaitAction(player));
  monsterActions = 0;
  return { engine, player, count: () => monsterActions };
}

describe('Stepping away from a tile choice after the move spent its turn', () => {
  it('gives the monsters the same turns live (dialog, cancelled) as in replay (no dialog)', () => {
    // Live: the choice modal pauses the engine (ModalStackManager -> setPaused) and the
    // player then presses "Step away", which pops the modal and runs any cancel callback.
    const live = buildEngine();
    let opened = false;
    let pendingCancel: (() => void) | undefined;
    live.engine.onChoiceInteract = (_c, _sel, cancel) => {
      live.engine.setPaused(true);
      opened = true;
      pendingCancel = cancel;
    };
    const liveTurn0 = live.engine.turnCount;
    live.engine.handlePlayerAction(new MovementAction(live.player, 1, 0));
    expect(opened).toBe(true);
    live.engine.setPaused(false);
    pendingCancel?.();
    live.engine.handlePlayerAction(new WaitAction(live.player));

    // Replay: the same two trail actions with no dialog wired.
    const replay = buildEngine();
    const replayTurn0 = replay.engine.turnCount;
    replay.engine.handlePlayerAction(new MovementAction(replay.player, 1, 0));
    replay.engine.handlePlayerAction(new WaitAction(replay.player));

    expect(live.engine.turnCount - liveTurn0).toBe(replay.engine.turnCount - replayTurn0);
    // Two hero turns passed (the move and the wait): the monster answers each, live and in replay.
    expect(replay.count()).toBe(2);
    expect(live.count()).toBe(replay.count());
  });
});
