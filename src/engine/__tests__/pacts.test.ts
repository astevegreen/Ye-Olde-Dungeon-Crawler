import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { COTW_PACTS } from '../../content/cotw/pacts';
import { DeathResolver } from '../combat/deathResolver';
import { populateDungeonFloor } from '../dungeon/spawner';
import { TILES } from '../grid/tile';

describe('Data-Driven Bounties & Run Pacts System', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(20, 20);
    map.fill(TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 10 },
    });
    map.addEntity(player);
    engine = new GameEngine({
      map,
      player,
      manifest: {
        id: 'test_manifest',
        name: 'Test Manifest',
        monsters: [],
        items: [],
        spells: [],
        town: {} as any,
        quest: {} as any,
        atlas: {} as any,
        starterKit: {} as any,
        pacts: COTW_PACTS,
      },
    });
  });

  it('registers pacts and toggles active state in worldState flags', () => {
    expect(engine.pacts.getAllPacts().length).toBe(COTW_PACTS.length);
    expect(engine.pacts.isPactActive('pact_blood')).toBe(false);

    engine.pacts.activatePact('pact_blood');
    expect(engine.pacts.isPactActive('pact_blood')).toBe(true);
    expect(engine.worldState.flags['pact_active_pact_blood']).toBe(true);

    engine.pacts.deactivatePact('pact_blood');
    expect(engine.pacts.isPactActive('pact_blood')).toBe(false);
    expect(engine.worldState.flags['pact_active_pact_blood']).toBe(false);
  });

  it('penalizes player max HP when Pact of the Blood Moon is active', () => {
    expect(player.maxHp).toBe(100);

    engine.pacts.activatePact('pact_blood'); // -25% max HP
    expect(player.maxHp).toBe(75);

    engine.pacts.deactivatePact('pact_blood');
    expect(player.maxHp).toBe(100);
  });

  it('modifies attack and defense when Pact of Recklessness is active', () => {
    expect(player.attack).toBe(10);
    expect(player.defense).toBe(10);

    engine.pacts.activatePact('pact_recklessness'); // +4 ATK, -4 DEF
    expect(player.attack).toBe(14);
    expect(player.defense).toBe(6);

    engine.pacts.deactivatePact('pact_recklessness');
    expect(player.attack).toBe(10);
    expect(player.defense).toBe(10);
  });

  it('reduces FOV visibility radius when Pact of Gloom is active', () => {
    engine.fovRadius = 8;
    engine.updateFov();

    // With 8 radius, tile at (12,5) is dist 7 (visible)
    expect(engine.fov.isVisible(12, 5)).toBe(true);

    // Activate Gloom (-3 FOV) -> effective radius 5
    engine.pacts.activatePact('pact_gloom');
    engine.updateFov();

    // Tile at (12,5) is dist 7 > 5 -> no longer visible!
    expect(engine.fov.isVisible(12, 5)).toBe(false);
  });

  it('scales XP reward when slaying a monster with active XP pact', () => {
    const target = new Monster({
      id: 'target',
      name: 'Test Monster',
      position: { x: 5, y: 6 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
      xpValue: 20,
    });
    map.addEntity(target);

    // Activate Gloom (1.75x XP)
    engine.pacts.activatePact('pact_gloom');
    player.xp = 0;

    DeathResolver.resolveDeath(engine, player, target);

    expect(player.xp).toBe(35); // 20 * 1.75 = 35!
    expect(engine.messages.some((m) => m.includes('(+35 XP)'))).toBe(true);
  });

  it('scales monster density when populating dungeon floor with density multiplier', () => {
    const rooms = [
      { x1: 1, y1: 1, x2: 5, y2: 5 }, // player room
      { x1: 6, y1: 1, x2: 12, y2: 12 },
      { x1: 13, y1: 1, x2: 18, y2: 18 },
    ];
    const dummyCandidate = {
      id: 'dummy',
      name: 'Dummy',
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 10,
      lootTable: [],
      statusImmunities: [],
      resistances: {},
      minFloor: 1,
      maxFloor: 5,
    };

    let seed1 = 0.1;
    const rng1 = () => { seed1 = (seed1 + 0.23) % 1; return seed1; };
    const mapNormal = new GameMap(30, 30);
    mapNormal.fill(TILES.FLOOR);
    populateDungeonFloor(mapNormal, rooms, 1, [dummyCandidate], rng1, 1.0);
    const countNormal = mapNormal.getAllEntities().length;

    let seed2 = 0.1;
    const rng2 = () => { seed2 = (seed2 + 0.23) % 1; return seed2; };
    const mapDense = new GameMap(30, 30);
    mapDense.fill(TILES.FLOOR);
    populateDungeonFloor(mapDense, rooms, 1, [dummyCandidate], rng2, 2.0);
    const countDense = mapDense.getAllEntities().length;

    expect(countDense).toBeGreaterThan(countNormal);
  });
});
