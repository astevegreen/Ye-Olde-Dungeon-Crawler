import { describe, it, expect } from 'vitest';
import { FIXTURE_SPELLS, fixtureManifest } from '../../../../tests/fixtures/fixture-pack';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../spellPipeline';
import { castGeometry } from '../castTrace';
import type { DamageEffect } from '../types';

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
  const foe = (x: number, y: number) => {
    const m = new Monster({ id: `foe_${x}_${y}`, name: 'Foe', position: { x, y }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 0 }, speed: 100, definitionId: 'raider', aiType: 'melee', xpValue: 1 });
    map.addEntity(m);
    return m;
  };
  const cast = (id: string, x: number, y: number) => SpellPipeline.executeSpell(engine, spell(id), player, { x, y });
  const area = (id: string, x: number, y: number) =>
    (castGeometry(engine, spell(id), player, { x, y }).area ?? []).map((p) => `${p.x},${p.y}`).sort();
  return { engine, map, player, foe, cast, area };
}

const hurt = (m: Monster) => m.hp < 50;

describe('spell shapes (P-33)', () => {
  describe('cone', () => {
    it('fans out from the caster toward the aim, as long as its area', () => {
      const { foe, cast } = build();
      const near = foe(11, 10);
      const wide = foe(12, 11);
      const far = foe(14, 10);
      const offAngle = foe(11, 12);
      const behind = foe(9, 10);
      cast('breath', 14, 10);
      expect([near, wide].every(hurt)).toBe(true);
      expect([far, offAngle, behind].some(hurt)).toBe(false);
    });

    it('stops at walls', () => {
      const { map, foe, cast, area } = build();
      map.setTile(12, 10, TILES.WALL);
      const shielded = foe(13, 10);
      cast('breath', 14, 10);
      expect(hurt(shielded)).toBe(false);
      expect(area('breath', 14, 10)).not.toContain('13,10');
    });
  });

  describe('nova', () => {
    it('strikes every creature around the caster and spares the caster', () => {
      const { player, foe, cast } = build();
      const ring = [foe(9, 9), foe(11, 10), foe(10, 11), foe(11, 11)];
      const outside = foe(12, 10);
      cast('clap', 10, 10);
      expect(ring.every(hurt)).toBe(true);
      expect(hurt(outside)).toBe(false);
      expect(player.hp).toBe(100);
    });
  });

  describe('square', () => {
    it('covers its area a side on the aim, an even 4×4 included', () => {
      const { foe, cast, area } = build();
      const tiles = area('shroud', 14, 10);
      expect(tiles).toHaveLength(16);
      expect(tiles).toContain('13,9');
      expect(tiles).toContain('16,12');
      const corner = foe(16, 12);
      const beyond = foe(17, 10);
      cast('shroud', 14, 10);
      expect(hurt(corner)).toBe(true);
      expect(hurt(beyond)).toBe(false);
    });
  });

  describe('wall', () => {
    it('lies across the aim\'s direction, its area each side of the aim', () => {
      const { area } = build();
      expect(area('cairn', 14, 10)).toEqual(['14,10', '14,11', '14,9']);
      expect(area('cairn', 10, 14)).toEqual(['10,14', '11,14', '9,14']);
      expect(area('cairn', 13, 13)).toEqual(['12,14', '13,13', '14,12']);
    });

    it('a mostly-east aim lies north to south', () => {
      const { area } = build();
      expect(area('cairn', 16, 11)).toEqual(['16,10', '16,11', '16,12']);
    });
  });

  describe('out and back', () => {
    it('passes through creatures and strikes each on the way out and back', () => {
      const { engine, player, foe, cast } = build();
      const probe = foe(20, 20);
      const hammer = spell('hammer');
      SpellPipeline.applyDamageEffect(engine, hammer, player, probe, hammer.effects[0] as DamageEffect);
      const oneHit = 50 - probe.hp;
      expect(oneHit).toBeGreaterThan(0);

      const near = foe(12, 10);
      const far = foe(15, 10);
      const outOfRange = foe(17, 10);
      cast('hammer', 17, 10);
      expect(50 - near.hp).toBe(2 * oneHit);
      expect(50 - far.hp).toBe(2 * oneHit);
      expect(hurt(outOfRange)).toBe(false);
    });

    it('turns back at a wall', () => {
      const { engine, map, foe, cast, player } = build();
      map.setTile(13, 10, TILES.WALL);
      const beyond = foe(14, 10);
      const geo = castGeometry(engine, spell('hammer'), player, { x: 17, y: 10 });
      expect(geo.ray?.impactTile).toEqual({ x: 12, y: 10 });
      expect(geo.back?.at(-1)).toEqual({ x: 10, y: 10 });
      cast('hammer', 17, 10);
      expect(hurt(beyond)).toBe(false);
    });
  });
});
