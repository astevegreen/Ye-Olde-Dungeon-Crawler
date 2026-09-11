import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Entity } from '../../entities/entity';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { PlaneManager } from '../planeManager';
import { PlanePortalAction, AstralProjectionAction } from '../../actions/planeActions';

describe('PlaneManager & Parallel Plane Topology', () => {
  let map: GameMap;
  let player: Player;
  let planeManager: PlaneManager;

  beforeEach(() => {
    map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      id: 'player-1',
      name: 'Hero',
      position: { x: 5, y: 5 },
    });
    planeManager = new PlaneManager();
  });

  it('isolates spatial queries between physical and liminal planes', () => {
    map.addEntity(player); // player on physical at (5, 5)

    const phantom = new Entity({
      id: 'phantom-1',
      name: 'Liminal Phantom',
      type: 'monster',
      faction: 'hostile',
      position: { x: 5, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
      planeId: 'liminal',
    });

    // Successfully adds phantom at same (5, 5) coordinate on liminal plane
    const added = map.addEntity(phantom);
    expect(added).toBe(true);

    // Query on physical only sees player
    expect(map.getEntityAt(5, 5, 'physical')).toBe(player);
    // Query on liminal only sees phantom
    expect(map.getEntityAt(5, 5, 'liminal')).toBe(phantom);

    // Cross-plane query returns both
    const atTile = map.getEntitiesAt(5, 5);
    expect(atTile.length).toBe(2);
    expect(atTile).toContain(player);
    expect(atTile).toContain(phantom);

    // getAllEntities filtered by plane
    expect(map.getAllEntities('physical')).toEqual([player]);
    expect(map.getAllEntities('liminal')).toEqual([phantom]);
  });

  it('transfers an entity between planes with transferEntity', () => {
    map.addEntity(player);
    expect(player.planeId).toBe('physical');

    const shifted = planeManager.transferEntity(map, player, 'liminal', { x: 2, y: 2 });
    expect(shifted).toBe(true);
    expect(player.planeId).toBe('liminal');
    expect(player.x).toBe(2);
    expect(player.y).toBe(2);

    expect(map.getEntityAt(5, 5, 'physical')).toBeNull();
    expect(map.getEntityAt(2, 2, 'liminal')).toBe(player);
  });

  it('displaces unanchored entities along liminal drift vectors', () => {
    const driftingMonster = new Entity({
      id: 'drifter',
      name: 'Drifter',
      type: 'monster',
      faction: 'hostile',
      position: { x: 3, y: 3 },
      stats: { hp: 20, maxHp: 20, attack: 2, defense: 0 },
      planeId: 'liminal',
      isAnchored: false,
    });
    map.addEntity(driftingMonster);

    // Tick 5 matches intervalTicks = 5 with dx = 1, dy = 0
    const driftResult = planeManager.tickDrift(map, 5);
    expect(driftResult.displacedCount).toBe(1);
    expect(driftingMonster.x).toBe(4);
    expect(driftingMonster.y).toBe(3);
    expect(driftingMonster.hp).toBe(20);
  });

  it('preserves anchored entities against liminal fluid drift', () => {
    const anchoredMonster = new Entity({
      id: 'anchored',
      name: 'Anchored Golem',
      type: 'monster',
      faction: 'hostile',
      position: { x: 3, y: 3 },
      stats: { hp: 20, maxHp: 20, attack: 2, defense: 0 },
      planeId: 'liminal',
      isAnchored: true,
    });
    map.addEntity(anchoredMonster);

    const driftResult = planeManager.tickDrift(map, 5);
    expect(driftResult.displacedCount).toBe(0);
    expect(anchoredMonster.x).toBe(3);
    expect(anchoredMonster.y).toBe(3);
  });

  it('applies vitality attrition when fluid drift is blocked by walls', () => {
    // Put monster adjacent to eastern wall: x = 8, wall at x = 9
    map.setTile(9, 3, TILES.WALL);
    const blockedMonster = new Entity({
      id: 'blocked',
      name: 'Blocked Spirit',
      type: 'monster',
      faction: 'hostile',
      position: { x: 8, y: 3 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
      planeId: 'liminal',
      isAnchored: false,
    });
    map.addEntity(blockedMonster);

    const driftResult = planeManager.tickDrift(map, 5);
    expect(driftResult.displacedCount).toBe(0);
    expect(driftResult.attritionDamageTotal).toBe(2);
    expect(blockedMonster.x).toBe(8); // Did not move
    expect(blockedMonster.hp).toBe(8); // Took 2 attrition damage
  });

  it('transitions player across planes via PlanePortalAction and AstralProjectionAction', () => {
    const engine = new GameEngine({ map, player });

    // Initial state: physical
    expect(player.planeId).toBe('physical');

    // Perform portal action to liminal
    const portalAction = new PlanePortalAction(player, 'liminal');
    const res1 = portalAction.perform(engine);
    expect(res1.success).toBe(true);
    expect(player.planeId).toBe('liminal');

    // Perform portal action back to physical
    const returnAction = new PlanePortalAction(player, 'physical');
    const res2 = returnAction.perform(engine);
    expect(res2.success).toBe(true);
    expect(player.planeId).toBe('physical');

    // Perform AstralProjectionAction
    const projection = new AstralProjectionAction(player, 'liminal');
    const res3 = projection.perform(engine);
    expect(res3.success).toBe(true);
    expect(player.planeId).toBe('liminal');
  });
});
