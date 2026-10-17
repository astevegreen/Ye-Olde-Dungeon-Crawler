import { describe, it, expect } from 'vitest';
import { FIXTURE_SPELLS, fixtureManifest } from '../../../../tests/fixtures/fixture-pack';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../spellPipeline';

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
  const cast = (id: string, x: number, y: number) => SpellPipeline.executeSpell(engine, spell(id), player, { x, y });
  return { engine, map, player, cast };
}

const square = (cx: number, cy: number) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: cx + dx, y: cy + dy })));

describe('a spell that lays ground or gas on its tiles', () => {
  it('covers every tile of its burst with the surface, for its duration', () => {
    const { engine, cast } = build();
    expect(cast('rime_patch', 14, 10).success).toBe(true);
    for (const p of square(14, 10)) {
      expect(engine.surfaces.getCell(p.x, p.y)?.surface).toMatchObject({ type: 'ice_sheet', duration: 15 });
    }
    expect(engine.surfaces.getSurface(16, 10)).toBeUndefined();
  });

  it('lays nothing on a wall inside the burst', () => {
    const { engine, map, cast } = build();
    map.setTile(15, 10, TILES.WALL);
    cast('rime_patch', 14, 10);
    expect(engine.surfaces.getSurface(15, 10)).toBeUndefined();
    expect(engine.surfaces.getSurface(13, 10)).toBe('ice_sheet');
  });

  it("lays a pack's gas with its sight rule, kept through a save", () => {
    const { engine, map, cast } = build();
    cast('murk_cloud', 14, 10);
    expect(engine.surfaces.getGas(14, 10)).toBe('murk');
    expect(map.isTransparent(14, 10)).toBe(false);

    const saved = engine.surfaces.serialize();
    engine.surfaces.clear();
    engine.surfaces.deserialize(saved);
    expect(map.isTransparent(14, 10)).toBe(false);
  });

  it('acts on a creature already inside only from the next turn, not as it lands', () => {
    const { engine, map, cast } = build();
    const foe = new Monster({ id: 'foe', name: 'Foe', position: { x: 14, y: 10 }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 0 }, speed: 100, definitionId: 'raider', aiType: 'melee', xpValue: 1 });
    map.addEntity(foe);
    const before = engine.messages.length;
    cast('rime_patch', 14, 10);
    expect(foe.position).toEqual({ x: 14, y: 10 });
    expect(engine.messages.slice(before).some((l) => l.includes('slips'))).toBe(false);
  });
});
