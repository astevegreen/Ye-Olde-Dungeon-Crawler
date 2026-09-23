import { describe, it, expect, beforeEach } from 'vitest';
import { ActionPipeline, type ActionHook, type ActionHookContext } from '../actionPipeline';
import type { Action } from '../action';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import type { Monster } from '../../entities/monster';
import { createTestKobold } from '../../__fixtures__/testHelpers';
import { flightRecorder } from '../../debug/flightRecorder';
import { ItemFactory } from '../../items/factory';
import { WindUpDeclareAction, WindUpExecuteAction } from '../combat';
import { CastSpellAction, ZapWandAction, ReadScrollAction, DrinkPotionAction } from '../spell-actions';

// Pins how the pipeline reads an action's optional introspection members (§4):
// the hook-matching name and the acting entity.
describe('ActionPipeline action introspection', () => {
  let pipeline: ActionPipeline;
  let engine: GameEngine;
  let player: Player;
  let kobold: Monster;
  let seen: ActionHookContext[];

  const ok = () => ({ success: true, cost: 100 });

  function recordingHook(actionType?: string): ActionHook {
    return { phase: 'pre', actionType, execute: (ctx) => { seen.push(ctx); } };
  }

  beforeEach(() => {
    player = new Player({ position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 } });
    engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player });
    kobold = createTestKobold('kobold_a', { x: 6, y: 5 });
    pipeline = new ActionPipeline();
    seen = [];
  });

  describe('actor resolution', () => {
    it('prefers entity, then attacker, then actor, then player', () => {
      const other = createTestKobold('kobold_b', { x: 7, y: 5 });
      pipeline.registerHook(recordingHook());

      pipeline.executeWithHooks({ entity: kobold, attacker: other, perform: ok }, engine);
      pipeline.executeWithHooks({ attacker: kobold, actor: other, perform: ok }, engine);
      pipeline.executeWithHooks({ actor: kobold, player: other, perform: ok }, engine);
      pipeline.executeWithHooks({ player: kobold, perform: ok }, engine);

      expect(seen.map((c) => c.actor)).toEqual([kobold, kobold, kobold, kobold]);
    });

    it('falls back to engine.player when the action names no actor', () => {
      pipeline.registerHook(recordingHook());
      pipeline.executeWithHooks({ perform: ok }, engine);
      expect(seen[0].actor).toBe(player);
    });

    it('attributes a pipeline failure to the resolved actor id', () => {
      const failing: Action = { attacker: kobold, perform: () => { throw new Error('INTROSPECTION_ATTRIBUTION'); } };
      pipeline.executeWithHooks(failing, engine);

      const err = flightRecorder
        .getEvents()
        .filter((e) => e.type === 'error' && e.summary.includes('INTROSPECTION_ATTRIBUTION'))
        .at(-1);
      expect(err?.details).toMatchObject({ entityId: kobold.id, phase: 'action-perform' });
    });
  });

  describe('built-in actions name their actor', () => {
    it('resolves the monster, not engine.player, for spell, item, and wind-up actions', () => {
      // Short-circuit so only actor resolution runs, not the actions themselves.
      pipeline.registerHook({
        phase: 'pre',
        execute: (ctx) => {
          seen.push(ctx);
          return { proceed: false, result: { success: true, cost: 0 } };
        },
      });
      const target = { x: 5, y: 5 };
      const actions: Action[] = [
        new CastSpellAction(kobold, 'magic_missile', target.x, target.y),
        new ZapWandAction(kobold, ItemFactory.createWandOfLightning(), target.x, target.y),
        new ReadScrollAction(kobold, ItemFactory.createScrollOfTeleport()),
        new DrinkPotionAction(kobold, ItemFactory.createManaPotion()),
        new WindUpDeclareAction(kobold, target, 'Slam', 'The kobold winds up!'),
        new WindUpExecuteAction(kobold, target, 'Slam'),
      ];

      for (const action of actions) pipeline.executeWithHooks(action, engine);

      expect(seen.map((c) => [c.actionType, c.actor])).toEqual(
        actions.map((a) => [a.constructor.name, kobold])
      );
    });
  });

  describe('action type', () => {
    it('reports a custom actionType instead of the constructor name', () => {
      pipeline.registerHook(recordingHook());
      pipeline.executeWithHooks({ actionType: 'ritual', perform: ok }, engine);
      expect(seen[0].actionType).toBe('ritual');
    });

    it('reports the constructor name when no actionType is set', () => {
      class CustomThingAction implements Action {
        perform() { return ok(); }
      }
      pipeline.registerHook(recordingHook());
      pipeline.executeWithHooks(new CustomThingAction(), engine);
      expect(seen[0].actionType).toBe('CustomThingAction');
    });

    it('matches a hook filter against `type` without reporting it as actionType', () => {
      pipeline.registerHook(recordingHook('ritual'));
      pipeline.executeWithHooks({ type: 'Ritual', perform: ok }, engine);
      pipeline.executeWithHooks({ type: 'other', perform: ok }, engine);

      expect(seen).toHaveLength(1);
      expect(seen[0].actionType).toBe('Object');
    });
  });
});
