import { describe, it, expect } from 'vitest';
import { FIXTURE_SPELLS, fixtureManifest } from '../../../../tests/fixtures/fixture-pack';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../spellPipeline';
import { sensesThroughWalls } from '../../fov/sensing';

const spell = (id: string) => {
  const found = FIXTURE_SPELLS.find((s) => s.id === id);
  if (!found) throw new Error(`no fixture spell ${id}`);
  return found;
};

function build() {
  const map = new GameMap(30, 30, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } });
  map.addEntity(player);
  const engine = new GameEngine({ map, player, manifest: fixtureManifest });
  const foe = (x: number, y: number, definitionId = 'raider', hp = 50) => {
    const m = new Monster({ id: `foe_${x}_${y}`, name: 'Foe', position: { x, y }, stats: { hp, maxHp: hp, attack: 1, defense: 0 }, speed: 100, definitionId, aiType: 'melee', xpValue: 1 });
    map.addEntity(m);
    return m;
  };
  const cast = (id: string, x: number, y: number) => SpellPipeline.executeSpell(engine, spell(id), player, { x, y });
  return { engine, map, player, foe, cast };
}

describe('spell building blocks: moving creatures and marks', () => {
  describe('push', () => {
    it('shoves a foe its distance away from the caster', () => {
      const { foe, cast } = build();
      const f = foe(11, 10);
      cast('shove', 11, 10);
      expect(f.position).toEqual({ x: 14, y: 10 });
      expect(f.statusManager.hasStatus('stunned')).toBe(false);
    });

    it('into a wall stuns', () => {
      const { map, foe, cast } = build();
      map.setTile(13, 10, TILES.WALL);
      const f = foe(11, 10);
      cast('shove', 11, 10);
      expect(f.position).toEqual({ x: 12, y: 10 });
      expect(f.statusManager.hasStatus('stunned')).toBe(true);
      expect(f.hp).toBeLessThan(50);
    });

    it('over a chasm a foe falls, and a boss takes half its health instead', () => {
      const { map, foe, cast } = build();
      map.setTile(12, 10, TILES.CHASM);
      const f = foe(11, 10);
      cast('shove', 11, 10);
      expect(f.isAlive()).toBe(false);

      const boss = foe(11, 10, 'warlord', 120);
      cast('shove', 11, 10);
      expect(boss.isAlive()).toBe(true);
      expect(boss.hp).toBe(60);
    });
  });

  describe('pull', () => {
    it('drags a foe toward the caster and stops beside it, with no splat', () => {
      const { foe, cast } = build();
      const f = foe(14, 10);
      cast('grasp', 14, 10);
      expect(f.position).toEqual({ x: 11, y: 10 });
      expect(f.statusManager.hasStatus('stunned')).toBe(false);
      expect(f.hp).toBe(50);
    });

    it('re-aims each step, so an off-line foe still ends beside the caster', () => {
      const { player, foe, cast } = build();
      const f = foe(16, 13);
      cast('grasp', 16, 13);
      expect(Math.max(Math.abs(f.x - player.x), Math.abs(f.y - player.y))).toBe(1);
    });

    it('goes no farther than its distance', () => {
      const { foe, cast } = build();
      const f = foe(18, 10);
      cast('grasp', 18, 10);
      expect(f.position).toEqual({ x: 12, y: 10 });
    });
  });

  describe('swap', () => {
    it('trades places with a creature in sight', () => {
      const { player, foe, cast, map } = build();
      const f = foe(15, 12);
      cast('switch', 15, 12);
      expect(player.position).toEqual({ x: 15, y: 12 });
      expect(f.position).toEqual({ x: 10, y: 10 });
      expect(map.getEntityAt(15, 12)).toBe(player);
      expect(map.getEntityAt(10, 10)).toBe(f);
    });

    it('does nothing with a wall between them', () => {
      const { player, foe, cast, map } = build();
      map.setTile(12, 10, TILES.WALL);
      const f = foe(14, 10);
      cast('switch', 14, 10);
      expect(player.position).toEqual({ x: 10, y: 10 });
      expect(f.position).toEqual({ x: 14, y: 10 });
    });
  });

  describe('aimed landing', () => {
    it('lands the caster on the tile aimed at', () => {
      const { player, cast } = build();
      cast('steered_blink', 13, 12);
      expect(player.position).toEqual({ x: 13, y: 12 });
    });

    it('beside a creature standing on the aimed tile', () => {
      const { player, foe, cast } = build();
      foe(13, 12);
      cast('steered_blink', 13, 12);
      expect(player.position).not.toEqual({ x: 10, y: 10 });
      expect(Math.max(Math.abs(player.x - 13), Math.abs(player.y - 12))).toBe(1);
    });

    it('nowhere out of range, on a wall or out of sight', () => {
      const { player, map, cast } = build();
      cast('steered_blink', 16, 10);
      map.setTile(12, 10, TILES.WALL);
      cast('steered_blink', 12, 10);
      cast('steered_blink', 14, 10);
      expect(player.position).toEqual({ x: 10, y: 10 });
    });
  });

  describe('landing on a surface', () => {
    it('a shoved foe burns on the fire it ends on', () => {
      const { engine, foe, cast } = build();
      const f = foe(11, 10);
      engine.surfaces.setSurface(14, 10, 'fire', 5);
      cast('shove', 11, 10);
      expect(f.position).toEqual({ x: 14, y: 10 });
      expect(f.hp).toBeLessThan(50);
    });

    it('but not on fire it is shoved across', () => {
      const { engine, foe, cast } = build();
      const f = foe(11, 10);
      engine.surfaces.setSurface(12, 10, 'fire', 5);
      cast('shove', 11, 10);
      expect(f.position).toEqual({ x: 14, y: 10 });
      expect(f.hp).toBe(50);
    });

    it('a pulled foe burns on the fire beside the caster', () => {
      const { engine, foe, cast } = build();
      const f = foe(14, 10);
      engine.surfaces.setSurface(11, 10, 'fire', 5);
      cast('grasp', 14, 10);
      expect(f.position).toEqual({ x: 11, y: 10 });
      expect(f.hp).toBeLessThan(50);
    });

    it('a swap puts each creature on the other one\'s ground', () => {
      const { engine, player, foe, cast } = build();
      const f = foe(15, 12);
      engine.surfaces.setSurface(10, 10, 'fire', 5);
      cast('switch', 15, 12);
      expect(f.hp).toBeLessThan(50);
      expect(player.hp).toBe(100);
    });

    it('an aimed landing on fire burns the caster', () => {
      const { engine, player, cast } = build();
      engine.surfaces.setSurface(13, 12, 'fire', 5);
      cast('steered_blink', 13, 12);
      expect(player.position).toEqual({ x: 13, y: 12 });
      expect(player.hp).toBeLessThan(100);
    });

    it('a random teleport onto fire burns', () => {
      const { engine, player } = build();
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) engine.surfaces.setSurface(x, y, 'fire', 5);
      SpellPipeline.teleportEntity(engine, player, 5);
      expect(player.position).not.toEqual({ x: 10, y: 10 });
      expect(player.hp).toBeLessThan(100);
    });

    it('a creature shoved onto ice stops there: landing does not slide it on', () => {
      const { engine, foe, cast } = build();
      const f = foe(11, 10);
      engine.surfaces.setSurface(14, 10, 'ice_sheet', 5);
      cast('shove', 11, 10);
      expect(f.position).toEqual({ x: 14, y: 10 });
    });
  });

  describe('mark', () => {
    it('shows the creature through walls and makes it take 10% more damage', () => {
      const { engine, foe, cast } = build();
      const f = foe(14, 10, 'raider', 100);
      const plain = foe(14, 14, 'raider', 100);
      expect(sensesThroughWalls(engine, f)).toBe(false);
      cast('brand', 14, 10);
      expect(f.statusManager.hasStatus('marked')).toBe(true);
      expect(sensesThroughWalls(engine, f)).toBe(true);
      expect(sensesThroughWalls(engine, plain)).toBe(false);

      f.takeDamage(20);
      plain.takeDamage(20);
      expect(100 - f.hp).toBe(22);
      expect(100 - plain.hp).toBe(20);
    });

    it('lands every hit harder, spell damage included', () => {
      const { engine, foe } = build();
      const f = foe(14, 10, 'raider', 100);
      f.statusManager.applyStatus({ type: 'marked', duration: 10 }, [], f, engine);
      const res = f.takeElementalDamage(30, 'arcane');
      expect(res.damageDealt).toBe(33);
    });
  });
});
