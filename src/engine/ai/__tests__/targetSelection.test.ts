import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Companion } from '../../entities/companion';
import { selectAttackTarget } from '../targetSelection';

function buildEngine(): { engine: GameEngine; player: Player } {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  const engine = new GameEngine({ map, player });
  return { engine, player };
}

function makeMonster(id: string, position: { x: number; y: number }, targetingMode?: 'player' | 'nearest_hostile'): Monster {
  return new Monster({
    id,
    name: 'Test Monster',
    position,
    stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
    speed: 100,
    definitionId: 'test_monster',
    aiType: 'melee',
    fleeHealthPercent: 0,
    xpValue: 1,
    lootTable: [],
    targetingMode,
  });
}

function makeCompanion(position: { x: number; y: number }): Companion {
  return new Companion({
    id: 'comp-1',
    name: 'Test Hound',
    position,
    stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
    speed: 100,
    companionDefinitionId: 'test_hound',
    packWeightCapacity: 10000,
    packBulkCapacity: 8000,
  });
}

describe('selectAttackTarget (docs/architecture/content-companions.md Phase 2)', () => {
  it('defaults to the player when a monster has no targetingMode set', () => {
    const { engine, player } = buildEngine();
    const monster = makeMonster('m1', { x: 12, y: 10 });
    engine.map.addEntity(monster);
    const companion = makeCompanion({ x: 11, y: 10 });
    engine.map.addEntity(companion);

    expect(selectAttackTarget(engine, monster)).toBe(player);
  });

  it('defaults to the player even when a companion is nearer, for targetingMode "player"', () => {
    const { engine, player } = buildEngine();
    const monster = makeMonster('m2', { x: 12, y: 10 }, 'player');
    engine.map.addEntity(monster);
    const companion = makeCompanion({ x: 11, y: 10 });
    engine.map.addEntity(companion);

    expect(selectAttackTarget(engine, monster)).toBe(player);
  });

  it('targets the nearest hostile (the companion) when opted into nearest_hostile', () => {
    const { engine, player } = buildEngine();
    const monster = makeMonster('m3', { x: 12, y: 10 }, 'nearest_hostile');
    engine.map.addEntity(monster);
    const companion = makeCompanion({ x: 11, y: 10 }); // 1 tile away
    engine.map.addEntity(companion);
    // Player is farther away at (10, 10) -> distance 2 from monster.

    expect(selectAttackTarget(engine, monster)).toBe(companion);
    expect(selectAttackTarget(engine, monster)).not.toBe(player);
  });

  it('falls back to the player for nearest_hostile when no other hostile is in range', () => {
    const { engine, player } = buildEngine();
    const monster = makeMonster('m4', { x: 5, y: 5 }, 'nearest_hostile');
    engine.map.addEntity(monster);

    expect(selectAttackTarget(engine, monster)).toBe(player);
  });

  it('ignores a hostile entity beyond maxRange', () => {
    const { engine, player } = buildEngine();
    const monster = makeMonster('m5', { x: 0, y: 0 }, 'nearest_hostile');
    engine.map.addEntity(monster);
    const companion = makeCompanion({ x: 19, y: 19 });
    engine.map.addEntity(companion);

    expect(selectAttackTarget(engine, monster, 5)).toBe(player);
  });

  it('never targets a non-hostile companion (faction "player" is not hostile to a "player" monster)', () => {
    const { engine } = buildEngine();
    // A monster that is itself faction 'player'-aligned would never treat the
    // companion as hostile; guard against a regression that ignores faction.
    const monster = makeMonster('m6', { x: 12, y: 10 }, 'nearest_hostile');
    monster.faction = 'player';
    engine.map.addEntity(monster);
    const companion = makeCompanion({ x: 11, y: 10 });
    engine.map.addEntity(companion);

    expect(selectAttackTarget(engine, monster)).toBe(engine.player);
  });
});
