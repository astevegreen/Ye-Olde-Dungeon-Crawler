import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { WaitAction } from '../wait';
import type { ActionHook, ActionHookContext } from '../actionPipeline';
import type { ActionResult } from '../../types';

/**
 * Every actor's actions run through ActionPipeline.executeWithHooks (ARCHITECTURE.md §4),
 * so hooks fire for monsters as well as the player. ActionHookContext.actor says which,
 * which is how content keeps player-only behaviour (see warcraft's battle-cry hook).
 */
function buildEngine(actionHooks: ActionHook[]) {
  const map = new GameMap(14, 14, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 2, y: 2 },
    stats: { hp: 500, maxHp: 500, attack: 5, defense: 50 },
  });
  const engine = new GameEngine({
    map,
    player,
    manifest: { id: 'hook-test', name: 'Hook Test', actionHooks } as any,
  });
  const monster = new Monster({
    id: 'orc-1',
    name: 'Orc',
    position: { x: 5, y: 2 },
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
  return { engine, player, monster };
}

describe('Action hooks fire for every actor', () => {
  it('fires for a monster turn and reports the monster as the actor', () => {
    const seen: Array<{ actorId: string; actionType: string }> = [];
    const spy: ActionHook = {
      id: 'spy',
      phase: 'pre',
      actionType: '*',
      execute: (ctx: ActionHookContext) => {
        seen.push({ actorId: ctx.actor?.id, actionType: ctx.actionType });
      },
    };
    const { engine, player, monster } = buildEngine([spy]);

    engine.handlePlayerAction(new WaitAction(player));

    expect(seen.some((s) => s.actorId === player.id)).toBe(true);
    expect(seen.some((s) => s.actorId === monster.id)).toBe(true);
  });

  it('lets a pre-hook short-circuit a monster action', () => {
    const blocked: string[] = [];
    const blocker: ActionHook = {
      id: 'block-monsters',
      phase: 'pre',
      actionType: '*',
      execute: (ctx: ActionHookContext) => {
        if (ctx.actor?.id === 'orc-1') {
          blocked.push(ctx.actionType);
          const result: ActionResult = { success: true, cost: 100, message: 'The orc hesitates.' };
          return { proceed: false, result };
        }
        return { proceed: true };
      },
    };
    const { engine, player, monster } = buildEngine([blocker]);
    const startX = monster.x;

    for (let i = 0; i < 5; i++) engine.handlePlayerAction(new WaitAction(player));

    expect(blocked.length).toBeGreaterThan(0);
    expect(monster.x).toBe(startX);
    // The engine does not surface monster action messages to the log, so the observable
    // contract is that the hook ran and the substituted result stopped the monster acting.
    expect(blocked.length).toBeGreaterThanOrEqual(5);
  });

  it('still reports the player as actor for player actions', () => {
    const actors: string[] = [];
    const spy: ActionHook = {
      id: 'player-spy',
      phase: 'post',
      actionType: 'WaitAction',
      execute: (ctx: ActionHookContext) => {
        actors.push(ctx.actor?.id);
      },
    };
    const { engine, player } = buildEngine([spy]);

    engine.handlePlayerAction(new WaitAction(player));

    expect(actors).toContain(player.id);
  });
});
