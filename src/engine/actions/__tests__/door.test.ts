import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import {
  OpenDoorAction,
  CloseDoorAction,
  SmartCloseDoorAction,
  BashDoorAction,
} from '../door';
import { BASE_ACTION_COST } from '../../types';

describe('Door Actions & BashDoorAction Resolution', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      name: 'Ragnar',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      strength: 16, // floor(16/4) = 4 bonus
    });
    engine = new GameEngine({ map, player });
  });

  describe('BashDoorAction', () => {
    it('rejects if the actor is defeated', () => {
      player.takeDamage(100);
      expect(player.isAlive()).toBe(false);

      map.setTile(5, 4, TILES.DOOR_CLOSED);
      const action = new BashDoorAction(player, 5, 4);
      const result = action.perform(engine);

      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toContain('cannot bash doors while defeated');
    });

    it('rejects if there is no closed door at the target coordinate', () => {
      map.setTile(5, 4, TILES.WALL);
      const action = new BashDoorAction(player, 5, 4);
      const result = action.perform(engine);

      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toContain('no closed door to bash there');
    });

    it('shoulders an unlocked door open without rolling or taking recoil damage', () => {
      map.setTile(5, 4, TILES.DOOR_CLOSED);
      const startingHp = player.hp;

      const action = new BashDoorAction(player, 5, 4);
      const result = action.perform(engine);

      expect(result.success).toBe(true);
      expect(result.cost).toBe(BASE_ACTION_COST);
      expect(map.getTile(5, 4)?.type).toBe('door_open');
      expect(player.hp).toBe(startingHp);
      expect(result.message).toContain('shoulders the unlocked door open');
    });

    it('successfully breaks open a locked door when roll meets lock difficulty', () => {
      map.setTile(5, 4, {
        ...TILES.DOOR_CLOSED,
        locked: true,
        lockDifficulty: 15,
      });

      // Mock engine.prng.nextInt so d20 returns 12 (12 + 4 = 16 >= 15)
      const origNextInt = engine.prng.nextInt.bind(engine.prng);
      engine.prng.nextInt = (min: number, max: number) => {
        if (min === 1 && max === 20) return 12;
        return origNextInt(min, max);
      };

      const action = new BashDoorAction(player, 5, 4);
      const result = action.perform(engine);

      expect(result.success).toBe(true);
      expect(result.cost).toBe(BASE_ACTION_COST);
      const tile = map.getTile(5, 4);
      expect(tile?.type).toBe('door_open');
      expect(tile?.locked).toBeFalsy();
      expect(result.message).toContain('smashes through the locked door');

      engine.prng.nextInt = origNextInt;
    });

    it('fails to break open locked door when roll is below DC and inflicts recoil damage', () => {
      map.setTile(5, 4, {
        ...TILES.DOOR_CLOSED,
        locked: true,
        lockDifficulty: 15,
      });

      const startingHp = player.hp;

      // Mock engine.prng.nextInt: d20 returns 5 (5 + 4 = 9 < 15), recoil d4 returns 3
      const origNextInt = engine.prng.nextInt.bind(engine.prng);
      engine.prng.nextInt = (min: number, max: number) => {
        if (min === 1 && max === 20) return 5;
        if (min === 1 && max === 4) return 3;
        return origNextInt(min, max);
      };

      const action = new BashDoorAction(player, 5, 4);
      const result = action.perform(engine);

      expect(result.success).toBe(false);
      expect(result.cost).toBe(BASE_ACTION_COST);
      const tile = map.getTile(5, 4);
      expect(tile?.type).toBe('door_closed');
      expect(tile?.locked).toBe(true);
      expect(player.hp).toBe(startingHp - 3);
      expect(result.message).toContain('takes 3 recoil damage');

      engine.prng.nextInt = origNextInt;
    });
  });

  describe('OpenDoorAction & CloseDoorAction', () => {
    it('opens an unlocked closed door and closes an open door', () => {
      map.setTile(5, 4, TILES.DOOR_CLOSED);

      const openAction = new OpenDoorAction(player, 5, 4);
      const openResult = openAction.perform(engine);
      expect(openResult.success).toBe(true);
      expect(map.getTile(5, 4)?.type).toBe('door_open');

      const closeAction = new CloseDoorAction(player, 5, 4);
      const closeResult = closeAction.perform(engine);
      expect(closeResult.success).toBe(true);
      expect(map.getTile(5, 4)?.type).toBe('door_closed');
    });

    it('smart-closes a single adjacent open door', () => {
      map.setTile(5, 4, TILES.DOOR_OPEN);

      const smartClose = new SmartCloseDoorAction(player);
      const result = smartClose.perform(engine);

      expect(result.success).toBe(true);
      expect(map.getTile(5, 4)?.type).toBe('door_closed');
    });
  });
});
