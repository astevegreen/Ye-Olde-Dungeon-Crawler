import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { RunicConduit } from '../runicConduit';

describe('RunicConduit Mechanic', () => {
  function createTestEngine(floor = 5) {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 10, y: 10 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor });
    return { engine, player, map };
  }

  it('initiates ritual and alerts all living monsters within 15-tile radius to hunting', () => {
    const { engine, map } = createTestEngine();

    // Spawn sleeping monster at distance 5
    const nearMonster = new Monster({
      id: 'near-mon',
      name: 'Sleeping Troll',
      position: { x: 14, y: 10 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      aiState: 'sleeping',
    });
    map.addEntity(nearMonster);

    // Spawn far monster at distance 20
    const farMonster = new Monster({
      id: 'far-mon',
      name: 'Distant Bat',
      position: { x: 29, y: 29 },
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
      aiState: 'sleeping',
    });
    map.addEntity(farMonster);

    const conduit = new RunicConduit(5, { x: 10, y: 10 });
    const res = conduit.startRitual(engine);

    expect(res.success).toBe(true);
    expect(conduit.ritualActive).toBe(true);
    expect(conduit.turnsRemaining).toBe(6);
    expect(conduit.activeNode).not.toBeNull();

    // Near monster alerted to hunting
    expect(nearMonster.aiState).toBe('hunting');
    // Far monster unaffected
    expect(farMonster.aiState).toBe('sleeping');
  });

  it('accumulates charges when stepping on active node and detonates at 3 charges', () => {
    const { engine, player, map } = createTestEngine();
    const conduit = new RunicConduit(5, { x: 10, y: 10 });
    conduit.startRitual(engine);

    // Adjacent hostile monster within blast radius
    const adjacentMonster = new Monster({
      id: 'adj-goblin',
      name: 'Goblin Sneak',
      position: { x: 11, y: 10 },
      stats: { hp: 25, maxHp: 25, attack: 4, defense: 1 },
    });
    map.addEntity(adjacentMonster);

    // Charge 1
    const node1 = conduit.activeNode!;
    expect(node1).toBeDefined();
    conduit.checkNodeStep(engine, node1.x, node1.y);
    expect(conduit.charges).toBe(1);

    // Advance turn to get node 2
    conduit.advanceTurn(engine);
    const node2 = conduit.activeNode!;
    expect(node2).toBeDefined();
    conduit.checkNodeStep(engine, node2.x, node2.y);
    expect(conduit.charges).toBe(2);

    // Advance turn to get node 3
    conduit.advanceTurn(engine);
    const node3 = conduit.activeNode!;
    expect(node3).toBeDefined();

    // Charge 3 triggers detonation & teleportation
    conduit.checkNodeStep(engine, node3.x, node3.y);
    expect(conduit.charges).toBe(0);
    expect(conduit.ritualActive).toBe(false);

    // Adjacent monster took radiant damage (hp was 25, took 50 -> killed)
    expect(adjacentMonster.hp).toBe(0);

    // Player teleported to Bjarnarhaven Temple of Thor
    expect(engine.currentFloor).toBe(0);
    expect(player.x).toBe(25);
    expect(player.y).toBe(23);
  });

  it('destabilizes after 6 turns without 3 charges, deals 20 HP backlash and sets 20-turn cooldown', () => {
    const { engine, player } = createTestEngine();
    const conduit = new RunicConduit(5, { x: 10, y: 10 });
    conduit.startRitual(engine);

    const initialHp = player.hp;

    // Advance 6 turns without stepping on nodes
    for (let t = 0; t < 6; t++) {
      conduit.advanceTurn(engine);
    }

    expect(conduit.ritualActive).toBe(false);
    expect(conduit.cooldownRemaining).toBe(20);
    // 20 backlash damage
    expect(player.hp).toBe(initialHp - 20);

    // Attempting to restart immediately is rejected
    const restartRes = conduit.startRitual(engine);
    expect(restartRes.success).toBe(false);
    expect(restartRes.message).toContain('destabilized');
  });

  it('strictly spawns active nodes within reachable Manhattan distance <= 3 from the player', () => {
    const { engine, player } = createTestEngine();
    const conduit = new RunicConduit(5, { x: 10, y: 10 });
    conduit.startRitual(engine);

    // Check node 1
    const node1 = conduit.activeNode!;
    expect(node1).toBeDefined();
    const dist1 = Math.abs(node1.x - player.x) + Math.abs(node1.y - player.y);
    expect(dist1).toBeLessThanOrEqual(3);

    // Advance turns and check subsequent nodes
    for (let t = 0; t < 5; t++) {
      conduit.advanceTurn(engine);
      const node = conduit.activeNode;
      if (node) {
        const dist = Math.abs(node.x - player.x) + Math.abs(node.y - player.y);
        expect(dist).toBeLessThanOrEqual(3);
      }
    }
  });

  it('preserves stairs down to Floor 6 upon conduit destabilization or abandonment', () => {
    const { engine, map } = createTestEngine();
    map.setTile(15, 15, TILES.STAIRS_DOWN);

    const conduit = new RunicConduit(5, { x: 10, y: 10 });
    conduit.startRitual(engine);

    // Destabilize
    for (let t = 0; t < 6; t++) {
      conduit.advanceTurn(engine);
    }
    expect(conduit.ritualActive).toBe(false);

    // Stairs down remain 100% intact and passable
    const stairs = map.getTile(15, 15);
    expect(stairs?.type).toBe('stairs_down');
    expect(stairs?.passable).toBe(true);
  });
});
