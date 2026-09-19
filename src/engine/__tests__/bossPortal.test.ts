import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { COTW_TILES } from '../../content/cotw/tiles';
import { DungeonArc } from '../quest/dungeonArc';
import { DeathResolver } from '../combat/deathResolver';
import { MovementAction } from '../actions/movement';

describe('Final Boss Ascent Portal & Victory Trigger', () => {
  it('spawns Gateway to Valhalla portal tile upon slaying the campaign boss on maxFloor', () => {
    const maxFloor = 25;
    const questArc: any = {
      id: 'test-quest',
      name: 'Test Quest',
      bossMonsterId: 'boss_hrungnir',
      victoryPortalTileId: 'gateway_valhalla',
      townReturnPosition: { x: 25, y: 23 },
    };
    const floorResult = DungeonArc.generateChieftainLair(maxFloor, questArc);
    const player = new Player({
      position: { x: 22, y: 28 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 5 },
    });
    player.maxFloor = maxFloor;

    const engine = new GameEngine({
      map: floorResult.map,
      player,
      floor: maxFloor,
      manifest: {
        id: 'test',
        name: 'Test Manifest',
        quest: questArc,
        tiles: COTW_TILES,
      } as any,
    });

    const boss = floorResult.boss!;
    expect(boss).toBeDefined();
    expect(boss.name).toBeDefined();

    const bossX = boss.x;
    const bossY = boss.y;

    // Slay the boss
    DeathResolver.resolveDeath(engine, player, boss);

    // Verify tile at boss coordinates became GATEWAY_VALHALLA
    const portalTile = engine.map.getTile(bossX, bossY);
    expect(portalTile?.type).toBe('gateway_valhalla');
    expect(portalTile?.glyph).toBe('▲');
    expect(portalTile?.passable).toBe(true);
  });

  it('stepping into Gateway to Valhalla triggers grand victory and teleports to Hall of Valhalla', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 10, y: 10 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 5 },
    });
    const engine = new GameEngine({
      map,
      player,
      floor: 25,
      manifest: {
        id: 'test',
        name: 'Test Manifest',
        quest: {
          townReturnPosition: { x: 25, y: 23 },
        } as any,
        tiles: COTW_TILES,
      } as any,
    });

    // Place portal at (11, 10)
    const portalTile = COTW_TILES.find((t) => t.type === 'gateway_valhalla')!;
    map.setTile(11, 10, portalTile);

    // Step onto portal tile via MovementAction
    const moveAction = new MovementAction(player, 1, 0);
    const result = moveAction.perform(engine);

    expect(result.success).toBe(true);
    expect(engine.gameState.runStatus).toBe('victorious');
    // Teleported to Bjarnarhaven Temple/Hall of Valhalla (Floor 0, x:25, y:23)
    expect(engine.currentFloor).toBe(0);
    expect(player.x).toBe(25);
    expect(player.y).toBe(23);
  });
});
