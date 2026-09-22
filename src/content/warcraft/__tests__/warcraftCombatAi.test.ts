import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, Monster, TILES } from '../../../engine';
import { WarchiefBehavior } from '../ai';
import { warcraftBattleCryHook } from '../hooks';
import { WARCRAFT_STATUS_HANDLERS } from '../status';
import { WindUpDeclareAction, MeleeAttackAction } from '../../../engine';

describe('Warcraft Combat AI, Hooks & Statuses', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    engine = new GameEngine({ map, player });
  });

  describe('WarchiefBehavior (Aggression & Wind-Up Mechanics)', () => {
    let warchief: Monster;
    let behavior: WarchiefBehavior;

    beforeEach(() => {
      behavior = new WarchiefBehavior();
      warchief = new Monster({
        id: 'warchief-1',
        definitionId: 'warchief_blackhand',
        name: 'Warchief Blackhand',
        position: { x: 5, y: 6 },
        stats: { hp: 120, maxHp: 120, attack: 18, defense: 7 },
        speed: 100,
        aiType: 'warchief',
      });
      map.addEntity(warchief);
    });

    it('telegraphs Decapitating Strike when adjacent and rng < 0.4', () => {
      engine.rng = () => 0.2; // < 0.4 triggers wind-up
      const action = behavior.decideAction(warchief, engine);
      expect(action).toBeInstanceOf(WindUpDeclareAction);
    });

    it('performs standard melee strike when adjacent and rng >= 0.4', () => {
      engine.rng = () => 0.7; // >= 0.4 triggers melee
      const action = behavior.decideAction(warchief, engine);
      expect(action).toBeInstanceOf(MeleeAttackAction);
    });

    it('triggers bloodlust roar and sets world flag when wounded below 40% HP', () => {
      warchief.hp = 40; // 40 / 120 = 33.3% <= 40%
      engine.rng = () => 0.7;

      expect(engine.getWorldFlag('warchief_roared:warchief-1')).toBe(false);
      behavior.decideAction(warchief, engine);

      expect(engine.getWorldFlag('warchief_roared:warchief-1')).toBe(true);

      // Subsequent actions should keep flag and not throw
      behavior.decideAction(warchief, engine);
      expect(engine.getWorldFlag('warchief_roared:warchief-1')).toBe(true);
    });

    it('relentlessly paths towards the player when at a distance', () => {
      warchief.x = 10;
      warchief.y = 10;
      engine.rng = () => 0.5;

      const action = behavior.decideAction(warchief, engine);
      expect(action).toBeDefined();
      // Should move toward player at (5, 5)
      expect(action.constructor.name).toBe('MovementAction');
    });
  });

  describe('warcraftBattleCryHook', () => {
    it('logs iconic battle cries on successful player melee strikes when rng proc triggers', () => {
      let loggedMessage = '';
      const originalLog = engine.log.bind(engine);
      engine.log = (msg: string) => {
        loggedMessage = msg;
        originalLog(msg);
      };

      engine.rng = () => 0.1; // < 0.25 triggers battle cry

      const dummy = new Monster({
        id: 'dummy',
        name: 'Training Dummy',
        position: { x: 6, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
        speed: 100,
        aiType: 'melee',
      });

      warcraftBattleCryHook.execute({
        engine,
        actor: player,
        actionType: 'melee',
        action: new MeleeAttackAction(player, dummy),
        result: { success: true, cost: 100 },
      });

      expect(loggedMessage).toContain('Battle Cry:');
    });

    it('does not log battle cries when strike fails or actor is a monster', () => {
      let loggedMessage = '';
      engine.log = (msg: string) => {
        loggedMessage = msg;
      };
      engine.rng = () => 0.1;

      const monster = new Monster({
        id: 'grunt-1',
        name: 'Orc Grunt',
        position: { x: 6, y: 5 },
        stats: { hp: 25, maxHp: 25, attack: 8, defense: 2 },
        speed: 100,
        aiType: 'melee',
      });

      // Strike by monster: should not fire player battle cries
      warcraftBattleCryHook.execute({
        engine,
        actor: monster,
        actionType: 'melee',
        action: new MeleeAttackAction(monster, player),
        result: { success: true, cost: 100 },
      });
      expect(loggedMessage).toBe('');

      // Failed strike by player: should not fire
      warcraftBattleCryHook.execute({
        engine,
        actor: player,
        actionType: 'melee',
        action: new MeleeAttackAction(player, monster),
        result: { success: false, cost: 0 },
      });
      expect(loggedMessage).toBe('');
    });
  });

  describe('WARCRAFT_STATUS_HANDLERS (burning)', () => {
    const burningHandler = WARCRAFT_STATUS_HANDLERS['burning'];

    it('implements onApply messaging with fel flames theme', () => {
      const msg = burningHandler.onApply?.(player, { type: 'burning' } as any, engine);
      expect(msg).toContain('bursts into demonic fel flames!');
    });

    it('implements onTick damage resolution', () => {
      const initialHp = player.hp;
      const res = burningHandler.onTick?.(player, { type: 'burning', potency: 5 } as any, engine);

      expect(res).toBeDefined();
      expect(res?.damageTaken).toBe(5);
      expect(player.hp).toBe(initialHp - 5);
      expect(res?.message).toContain('scorched by fel fire');
    });

    it('implements onExpire messaging when fel flames burn out', () => {
      const msg = burningHandler.onExpire?.(player, engine);
      expect(msg).toContain('extinguished');
    });
  });
});
