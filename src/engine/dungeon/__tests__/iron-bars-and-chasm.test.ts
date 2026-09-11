import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { MovementAction } from '../../actions/movement';
import { traceProjectile } from '../../magic/targeting';
import { applyKnockback } from '../../combat/knockback';
import { FovManager } from '../../fov/fov-manager';

describe('IronBars, Chasm, Pillars, and Knockback Physics', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'test-hero',
      name: 'Freya',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      strength: 15,
      mana: 50,
      maxMana: 50,
      speed: 100,
    });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
  });

  it('IronBars rejects entity movement while permitting projectile raycasts', () => {
    map.setTile(5, 6, TILES.IRON_BARS);

    // Attempt to move into Iron Bars
    player.energy = 100;
    const moveAction = new MovementAction(player, 0, 1);
    const moveRes = moveAction.perform(engine);
    expect(moveRes.success).toBe(false);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);

    // Projectile raycast from (5, 5) aimed at (5, 8) through Iron Bars at (5, 6)
    const trace = traceProjectile(map, 5, 5, 5, 8, 10, false, player.id);
    expect(trace.hitWall).toBe(false);
    // Path includes tiles past (5, 6)
    const yCoordinates = trace.path.map((p) => p.y);
    expect(yCoordinates).toContain(6);
    expect(yCoordinates).toContain(7);
  });

  it('Chasm blocks ground movement, permits FOV vision and projectiles, and eliminates on knockback', () => {
    map.setTile(5, 6, TILES.CHASM);

    // 1. Movement is blocked
    const moveAction = new MovementAction(player, 0, 1);
    const moveRes = moveAction.perform(engine);
    expect(moveRes.success).toBe(false);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);

    // 2. Projectile passes freely across chasm
    const trace = traceProjectile(map, 5, 5, 5, 8, 10, false, player.id);
    expect(trace.hitWall).toBe(false);

    // 3. FOV passes through chasm
    const fov = new FovManager(20, 20);
    fov.update(map, 5, 5, 8);
    expect(fov.isVisible(5, 6)).toBe(true);
    expect(fov.isVisible(5, 7)).toBe(true);

    // 4. Knockback into chasm: monster standing at (5, 5) pushed into (5, 6)
    const monster = new Monster({
      id: 'target-goblin',
      name: 'Goblin Raider',
      position: { x: 5, y: 5 },
      stats: { hp: 40, maxHp: 40, attack: 5, defense: 2 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'melee',
      xpValue: 25,
      lootTable: [],
    });
    map.removeEntity(player);
    map.addEntity(monster);

    const knockback = applyKnockback(engine, player, monster, 0, 1, 1);
    expect(knockback.pushed).toBe(true);
    expect(knockback.fellInChasm).toBe(true);
    expect(monster.isAlive()).toBe(false);
    expect(monster.hp).toBeLessThanOrEqual(0);
    expect(map.getEntityById('target-goblin')).toBeNull();
  });

  it('Pillars occlude both FOV vision and projectile raycasts', () => {
    map.setTile(5, 6, TILES.PILLAR);

    // 1. Movement is blocked
    const moveRes = new MovementAction(player, 0, 1).perform(engine);
    expect(moveRes.success).toBe(false);

    // 2. Projectile is stopped by pillar
    const trace = traceProjectile(map, 5, 5, 5, 8, 10, false, player.id);
    expect(trace.hitWall).toBe(true);
    expect(trace.impactTile.x).toBe(5);
    expect(trace.impactTile.y).toBe(5);
    expect(trace.path.some((p) => p.y >= 6)).toBe(false);

    // 3. FOV shadows tiles directly behind the pillar
    const fov = new FovManager(20, 20);
    fov.update(map, 5, 5, 8);
    // Face of pillar is visible
    expect(fov.isVisible(5, 6)).toBe(true);
    // Space behind pillar is shadowed
    expect(fov.isVisible(5, 7)).toBe(false);
  });
});
