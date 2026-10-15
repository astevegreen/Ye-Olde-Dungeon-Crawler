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
  const foe = (id: string, x: number, y: number) => {
    const m = new Monster({ id, name: id, position: { x, y }, stats: { hp: 200, maxHp: 200, attack: 1, defense: 0 }, speed: 100, definitionId: 'raider', aiType: 'melee', xpValue: 1 });
    map.addEntity(m);
    return m;
  };
  const linesFrom = (before: number, part: string) => engine.messages.slice(before).filter((l) => l.includes(part));
  return { engine, map, cast, foe, linesFrom };
}

describe('ground reactions (P-32)', () => {
  it('fire melts ice into water', () => {
    const { engine } = build();
    engine.surfaces.setSurface(14, 10, 'ice_sheet', 6);
    const r = engine.surfaces.triggerElementalReaction(14, 10, 'fire', 10, engine);
    expect(r.type).toBe('melt');
    expect(engine.surfaces.getSurface(14, 10)).toBe('water');
  });

  it('cold freezes the whole pool, laid water and shallow water alike', () => {
    const { engine, map } = build();
    for (let x = 14; x <= 17; x++) engine.surfaces.setSurface(x, 10, 'water', 8);
    map.setTile(18, 10, TILES.SHALLOW_WATER);
    map.setTile(19, 10, TILES.SHALLOW_WATER);
    const r = engine.surfaces.triggerElementalReaction(14, 10, 'cold', 10, engine);
    expect(r.type).toBe('freeze');
    for (let x = 14; x <= 19; x++) expect(engine.surfaces.getSurface(x, 10)).toBe('ice_sheet');
    expect(engine.surfaces.getSurface(20, 10)).toBeUndefined();
  });

  it('laid water douses fire on the ground and a firestorm above it, said once', () => {
    const { engine, cast, linesFrom } = build();
    engine.surfaces.setSurface(14, 10, 'fire', 8);
    engine.surfaces.setSurface(13, 10, 'fire', 8);
    engine.surfaces.setGas(15, 10, 'fire_storm', 4);
    const before = engine.messages.length;
    cast('drench', 14, 10);
    expect(engine.surfaces.getSurface(14, 10)).toBe('water');
    expect(engine.surfaces.getSurface(13, 10)).toBe('water');
    expect(engine.surfaces.getGas(15, 10)).toBeUndefined();
    expect(linesFrom(before, 'douse')).toHaveLength(1);
  });

  describe('an area spell landing on empty ground', () => {
    it('ignites an oil slick nobody stands on', () => {
      const { engine, cast } = build();
      engine.surfaces.setSurface(14, 10, 'oil_slick', 8);
      engine.surfaces.setSurface(15, 11, 'oil_slick', 8);
      cast('flame_burst', 14, 10);
      expect(engine.surfaces.getGas(14, 10)).toBe('fire_storm');
      expect(engine.surfaces.getGas(15, 11)).toBe('fire_storm');
    });

    it('boils a pond to steam, the line said once', () => {
      const { engine, cast, linesFrom } = build();
      for (let y = 9; y <= 11; y++) for (let x = 13; x <= 15; x++) engine.surfaces.setSurface(x, y, 'water', 8);
      const before = engine.messages.length;
      cast('flame_burst', 14, 10);
      expect(engine.surfaces.getGas(13, 9)).toBe('dense_steam');
      expect(engine.surfaces.getGas(15, 11)).toBe('dense_steam');
      expect(linesFrom(before, 'boils')).toHaveLength(1);
    });

    it('freezes a pond a frost burst lands beside', () => {
      const { engine, cast } = build();
      for (let x = 15; x <= 20; x++) engine.surfaces.setSurface(x, 10, 'water', 8);
      cast('frost_burst', 14, 10);
      expect(engine.surfaces.getSurface(20, 10)).toBe('ice_sheet');
    });

    it('shocks a pool once, however many of its tiles the burst covers; the struck wader takes its 200% once', () => {
      const { engine, cast, foe, linesFrom } = build();
      for (let x = 12; x <= 20; x++) engine.surfaces.setSurface(x, 10, 'water', 8);
      const wader = foe('Wader', 14, 10);
      const far = foe('Far wader', 19, 10);
      const before = engine.messages.length;
      cast('storm_burst', 14, 10);
      expect(linesFrom(before, 'Wader')).toEqual([expect.stringContaining('20 lightning')]);
      expect(linesFrom(before, 'Far wader is severely shocked')).toHaveLength(1);
      expect(wader.hp).toBe(180);
      expect(far.hp).toBe(180);
    });

    it('shocks a wader in shallow water once, not its own hit and the pool again', () => {
      const { engine, map, cast, foe, linesFrom } = build();
      map.setTile(14, 10, TILES.SHALLOW_WATER);
      const wader = foe('Wader', 14, 10);
      const before = engine.messages.length;
      cast('storm_burst', 14, 10);
      expect(linesFrom(before, 'Wader')).toEqual([expect.stringContaining('20 lightning')]);
      expect(wader.hp).toBe(180);
    });

    it('a burst with no damage strikes no ground', () => {
      const { engine, cast } = build();
      engine.surfaces.setSurface(14, 10, 'oil_slick', 8);
      cast('murk_cloud', 14, 10);
      expect(engine.surfaces.getSurface(14, 10)).toBe('oil_slick');
    });
  });
});
