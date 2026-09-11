import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { TrapInstance } from '../traps';
import { SearchAction } from '../../actions/search';
import { MovementAction } from '../../actions/movement';
import { serializeGame, deserializeGame } from '../../storage/serializer';

describe('Traps, Secret Doors & Search Mechanics', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = GameMap.createBoxRoom(20, 20);
    player = new Player({
      id: 'test_hero',
      name: 'Valiant',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
      dexterity: 18,
      intelligence: 18,
    });
    engine = new GameEngine({ map, player, floor: 1 });
  });

  it('triggers a pit trap on movement, dealing damage and revealing the trap', () => {
    const pitTrap = new TrapInstance({
      id: 'trap_pit_1',
      type: 'pit',
      x: 6,
      y: 5,
      damage: 15,
      revealed: false,
    });
    map.addTrap(pitTrap);
    expect(pitTrap.revealed).toBe(false);

    // Player moves East onto (6, 5)
    const move = new MovementAction(player, 1, 0);
    const res = engine.handlePlayerAction(move);

    expect(res.success).toBe(true);
    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
    expect(player.hp).toBe(35); // 50 - 15 damage
    expect(pitTrap.triggered).toBe(true);
    expect(pitTrap.revealed).toBe(true);
    expect(map.getTile(6, 5)?.type).toBe('trap');
  });

  it('triggers an arrow trap on movement, dealing projectile damage', () => {
    const arrowTrap = new TrapInstance({
      id: 'trap_arrow_1',
      type: 'arrow',
      x: 5,
      y: 6,
      damage: 12,
      revealed: false,
    });
    map.addTrap(arrowTrap);

    // Move South onto (5, 6)
    const move = new MovementAction(player, 0, 1);
    const res = engine.handlePlayerAction(move);

    expect(res.success).toBe(true);
    expect(player.hp).toBe(38); // 50 - 12
    expect(arrowTrap.triggered).toBe(true);
  });

  it('triggers a teleport trap, safely displacing the entity to another passable tile', () => {
    const teleportTrap = new TrapInstance({
      id: 'trap_teleport_1',
      type: 'teleport',
      x: 6,
      y: 5,
      revealed: false,
    });
    map.addTrap(teleportTrap);

    const move = new MovementAction(player, 1, 0);
    const res = engine.handlePlayerAction(move);

    expect(res.success).toBe(true);
    expect(teleportTrap.triggered).toBe(true);
    // Entity should no longer be at the trap tile
    expect(player.x !== 6 || player.y !== 5).toBe(true);
    expect(map.inBounds(player.x, player.y)).toBe(true);
    expect(map.isPassable(player.x, player.y)).toBe(true);
  });

  it('triggers an alarm trap, awakening sleeping monsters', () => {
    const sleepingOrc = new Monster({
      id: 'orc_guard',
      name: 'Orc Guard',
      position: { x: 10, y: 10 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
      aiState: 'sleeping',
    });
    engine.addEntity(sleepingOrc);
    expect(sleepingOrc.aiState).toBe('sleeping');

    const alarmTrap = new TrapInstance({
      id: 'trap_alarm_1',
      type: 'alarm',
      x: 5,
      y: 6,
      revealed: false,
    });
    map.addTrap(alarmTrap);

    const move = new MovementAction(player, 0, 1);
    engine.handlePlayerAction(move);

    expect(alarmTrap.triggered).toBe(true);
    expect(sleepingOrc.aiState).toBe('hunting');
  });

  it('supports disarming traps with high dexterity/intelligence', () => {
    const trap = new TrapInstance({
      id: 'trap_disarm_test',
      type: 'pit',
      x: 5,
      y: 6,
      damage: 20,
      disarmDifficulty: 5, // Easy for high DEX/INT player
    });
    map.addTrap(trap);

    const disarmResult = trap.disarm(player, engine);
    expect(disarmResult.success).toBe(true);
    expect(trap.disarmed).toBe(true);

    // Moving onto disarmed trap deals 0 damage
    const move = new MovementAction(player, 0, 1);
    engine.handlePlayerAction(move);
    expect(player.hp).toBe(50);
  });

  it('SearchAction detects adjacent secret doors and hidden traps', () => {
    // Place secret door at (5, 4) (North of player at 5, 5)
    map.setTile(5, 4, TILES.SECRET_DOOR);
    expect(map.getTile(5, 4)?.type).toBe('secret_door');

    // Place hidden trap at (6, 5) (East of player)
    const hiddenTrap = new TrapInstance({
      id: 'hidden_trap_1',
      type: 'arrow',
      x: 6,
      y: 5,
      concealment: 10, // Easily spotted by 18 INT / 18 DEX player
      revealed: false,
    });
    map.addTrap(hiddenTrap);

    const searchAction = new SearchAction(player, () => 0.99);
    const searchRes = engine.handlePlayerAction(searchAction);

    expect(searchRes.success).toBe(true);
    expect(searchRes.cost).toBe(100);

    // Secret door revealed -> converted to door_closed
    expect(map.getTile(5, 4)?.type).toBe('door_closed');
    // Trap revealed
    expect(hiddenTrap.revealed).toBe(true);
    expect(map.getTile(6, 5)?.type).toBe('trap');
  });

  it('preserves traps and their revealed/disarmed states across serialization', () => {
    const trap = new TrapInstance({
      id: 'saved_trap_1',
      type: 'arrow',
      x: 8,
      y: 8,
      revealed: true,
      disarmed: true,
      damage: 10,
    });
    map.addTrap(trap);

    const profile = {
      id: 'test_save',
      name: 'Valiant',
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: 50,
      maxHp: 50,
      strength: 15,
    };

    const serialized = serializeGame(engine, profile);
    const restored = deserializeGame(serialized);

    const restoredTrap = restored.engine.map.getTrapAt(8, 8);
    expect(restoredTrap).not.toBeNull();
    expect(restoredTrap?.id).toBe('saved_trap_1');
    expect(restoredTrap?.type).toBe('arrow');
    expect(restoredTrap?.revealed).toBe(true);
    expect(restoredTrap?.disarmed).toBe(true);
  });
});
