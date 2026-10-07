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

  it('a teleport trap never sends the hero behind a secret door, where no path leads out', () => {
    // The hero's walkable area is the 4x4 corner; everything else lies behind a secret door,
    // as a cache or a sealed vault cage does. The old rule picked from the whole map.
    map.moveEntity(player, 2, 2);
    for (let i = 1; i <= 5; i++) {
      map.setTile(5, i, TILES.WALL);
      map.setTile(i, 5, TILES.WALL);
    }
    map.setTile(5, 2, TILES.SECRET_DOOR);
    const rune = new TrapInstance({ id: 'trap_tp', type: 'teleport', x: 3, y: 3 });
    map.addTrap(rune);

    for (let i = 0; i < 20; i++) {
      map.moveEntity(player, 3, 3);
      rune.trigger(player, engine);
      expect(player.x <= 4 && player.y <= 4, `teleport ${i} landed at ${player.x},${player.y}`).toBe(true);
      expect(player.x === 3 && player.y === 3).toBe(false);
    }
  });

  it('a teleport trap ends the step: the acid on the trap tile does not burn the hero who left it', () => {
    engine.surfaces.setSurface(6, 5, 'acid_pool', 10);
    map.addTrap(new TrapInstance({ id: 'trap_tp2', type: 'teleport', x: 6, y: 5 }));

    new MovementAction(player, 1, 0).perform(engine);

    expect(player.x === 6 && player.y === 5).toBe(false);
    expect(player.hp).toBe(50);
  });
});

/**
 * Trap review T2: a trap a monster sprang out of the hero's sight still logged ("A hidden pit
 * trap opens beneath Goblin's feet!"), telling the player a trap and a monster were there.
 */
describe('T2 · a trap a monster springs out of the hero\'s sight says nothing', () => {
  /** A box room split by a wall at x = 15: the hero at (5, 4) sees the west half only. */
  function walledOff(goblinAt: { x: number; y: number }) {
    const map = GameMap.createBoxRoom(30, 9);
    for (let y = 0; y < 9; y++) map.setTile(15, y, TILES.WALL);
    const player = new Player({ position: { x: 5, y: 4 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 } });
    const goblin = new Monster({
      id: 'goblin',
      name: 'Goblin',
      position: goblinAt,
      stats: { hp: 100, maxHp: 100, attack: 1, defense: 0 },
    });
    goblin.faction = 'hostile';
    map.addEntity(goblin);
    const engine = new GameEngine({ map, player, floor: 1 });
    engine.updateFov();
    return { map, engine, goblin };
  }

  it.each(['pit', 'arrow', 'teleport', 'alarm'] as const)('an unseen %s trap logs nothing, and still works', (type) => {
    const { map, engine, goblin } = walledOff({ x: 22, y: 4 });
    expect(engine.fov.isVisible(22, 4)).toBe(false);
    const trap = new TrapInstance({ id: 't', type, x: 22, y: 4 });
    map.addTrap(trap);
    const before = engine.messages.length;

    trap.trigger(goblin, engine);

    expect(engine.messages.slice(before)).toEqual([]);
    expect(trap.triggered).toBe(true);
    if (type === 'pit') expect(goblin.hp).toBe(90);
    if (type === 'alarm') expect(goblin.aiState).not.toBe('sleeping');
  });

  it('a trap the hero sees a monster spring is told', () => {
    const { map, engine, goblin } = walledOff({ x: 8, y: 4 });
    const trap = new TrapInstance({ id: 't', type: 'pit', x: 8, y: 4 });
    map.addTrap(trap);
    const before = engine.messages.length;

    trap.trigger(goblin, engine);

    expect(engine.messages.slice(before)).toEqual([
      "A hidden pit trap opens beneath Goblin's feet! Goblin takes 10 damage!",
    ]);
  });
});
