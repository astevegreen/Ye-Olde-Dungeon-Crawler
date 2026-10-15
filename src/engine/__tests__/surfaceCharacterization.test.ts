import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { TILES } from '../grid/tile';

// What each built-in surface and gas does today, pinned before the behaviours moved into a
// table (P-32, plan risk 6): the numbers, the log lines, the move cost, the slide, the sight.
describe('built-in surface and gas behaviours', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 } });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
  });

  const newLines = (before: number) => engine.messages.slice(before);

  describe('stepping in', () => {
    const step = (type: string) => {
      engine.surfaces.setSurface(3, 3, type, 5);
      const before = engine.messages.length;
      const result = engine.surfaces.handleEntityStep(player, 3, 3, 0, 0, engine);
      return { result, lines: newLines(before) };
    };

    it('water does nothing', () => {
      const { result, lines } = step('water');
      expect(result).toEqual({ slid: false, energyPenalty: 0 });
      expect(lines).toEqual([]);
      expect(player.hp).toBe(50);
    });

    it('an oil slick costs nothing and says so', () => {
      const { result, lines } = step('oil_slick');
      expect(result).toEqual({ slid: false, energyPenalty: 0 });
      expect(lines).toEqual(['Adventurer treads carefully across the flammable oil slick.']);
    });

    it('an acid pool burns 4 acid', () => {
      const { result, lines } = step('acid_pool');
      expect(result).toEqual({ slid: false, energyPenalty: 0 });
      expect(player.hp).toBe(46);
      expect(lines).toEqual(['Adventurer wades into caustic acid for 4 acid damage!']);
    });

    it('mud costs 50 energy', () => {
      const { result, lines } = step('mud');
      expect(result).toEqual({ slid: false, energyPenalty: 50 });
      expect(lines).toEqual(['Adventurer struggles through thick, clinging mud!']);
    });

    it('fire burns 4 fire', () => {
      const { result, lines } = step('fire');
      expect(result).toEqual({ slid: false, energyPenalty: 0 });
      expect(player.hp).toBe(46);
      expect(lines).toEqual(['Adventurer steps into searing fire for 4 fire damage!']);
    });

    it('ice costs 50 energy and, standing still, slides nowhere', () => {
      const { result, lines } = step('ice_sheet');
      expect(result).toEqual({ slid: false, energyPenalty: 50 });
      expect(lines).toEqual(['Adventurer slips on the slick ice sheet!']);
    });

    it('ice slides the mover 2 tiles along its step, the slip logged first', () => {
      engine.surfaces.setSurface(3, 3, 'ice_sheet', 5);
      const before = engine.messages.length;
      const result = engine.surfaces.handleEntityStep(player, 3, 3, 1, 0, engine);
      expect(result).toEqual({ slid: true, energyPenalty: 50 });
      expect(player.position).toEqual({ x: 5, y: 3 });
      expect(newLines(before)[0]).toBe('Adventurer slips on the slick ice sheet!');
    });

    it('a gas does nothing on entry', () => {
      engine.surfaces.setGas(3, 3, 'poison_cloud', 5);
      const before = engine.messages.length;
      expect(engine.surfaces.handleEntityStep(player, 3, 3, 0, 0, engine)).toEqual({ slid: false, energyPenalty: 0 });
      expect(newLines(before)).toEqual([]);
      expect(player.statusManager.hasStatus('poison')).toBe(false);
    });

    it('an unknown surface does nothing', () => {
      const { result, lines } = step('glitter');
      expect(result).toEqual({ slid: false, energyPenalty: 0 });
      expect(lines).toEqual([]);
    });
  });

  describe('standing through a turn', () => {
    const standSurface = (type: string) => {
      engine.surfaces.setSurface(3, 3, type, 5);
      const before = engine.messages.length;
      engine.surfaces.tick(engine);
      return newLines(before);
    };

    it('an acid pool burns 3 acid', () => {
      expect(standSurface('acid_pool')).toEqual(['Adventurer suffers 3 acid burn from the caustic pool.']);
      expect(player.hp).toBe(47);
    });

    it('fire burns 3 fire', () => {
      expect(standSurface('fire')).toEqual(['Adventurer is scorched by lingering fire for 3 damage.']);
      expect(player.hp).toBe(47);
    });

    it.each(['water', 'oil_slick', 'mud', 'ice_sheet', 'glitter'])('%s does nothing', (type) => {
      expect(standSurface(type)).toEqual([]);
      expect(player.hp).toBe(50);
      expect(engine.surfaces.getCell(3, 3)?.surface?.duration).toBe(4);
    });

    it('a firestorm burns 5 fire', () => {
      engine.surfaces.setGas(3, 3, 'fire_storm', 5);
      const before = engine.messages.length;
      engine.surfaces.tick(engine);
      expect(newLines(before)).toEqual(['Adventurer burns inside the raging FireStorm for 5 damage!']);
      expect(player.hp).toBe(45);
    });

    it('a poison cloud poisons for 3 turns at 2, then says so', () => {
      engine.surfaces.setGas(3, 3, 'poison_cloud', 5);
      const before = engine.messages.length;
      engine.surfaces.tick(engine);
      const poison = player.statusManager.getAllActive().find((s) => s.type === 'poison');
      expect(poison).toMatchObject({ duration: 3, potency: 2 });
      expect(newLines(before).at(-1)).toBe('Adventurer chokes on noxious poison fumes!');
    });

    it('dense steam does nothing to those inside', () => {
      engine.surfaces.setGas(3, 3, 'dense_steam', 5);
      const before = engine.messages.length;
      engine.surfaces.tick(engine);
      expect(newLines(before)).toEqual([]);
      expect(player.hp).toBe(50);
    });

    it('both layers act in one turn, ground first', () => {
      engine.surfaces.setSurface(3, 3, 'acid_pool', 5);
      engine.surfaces.setGas(3, 3, 'fire_storm', 5);
      const before = engine.messages.length;
      engine.surfaces.tick(engine);
      expect(newLines(before)).toEqual([
        'Adventurer suffers 3 acid burn from the caustic pool.',
        'Adventurer burns inside the raging FireStorm for 5 damage!',
      ]);
      expect(player.hp).toBe(42);
    });

    it('an empty tile hurts nobody, and a cell expires on its last turn', () => {
      engine.surfaces.setSurface(5, 5, 'fire', 1);
      engine.surfaces.tick(engine);
      expect(player.hp).toBe(50);
      expect(engine.surfaces.getCell(5, 5)).toBeUndefined();
    });

    it('the last turn of a hazard still hurts', () => {
      engine.surfaces.setSurface(3, 3, 'fire', 1);
      engine.surfaces.tick(engine);
      expect(player.hp).toBe(47);
      expect(engine.surfaces.getSurface(3, 3)).toBeUndefined();
    });

    it('death on a hazard names it', () => {
      player.hp = 2;
      engine.surfaces.setGas(3, 3, 'fire_storm', 5);
      engine.surfaces.tick(engine);
      expect(player.isAlive()).toBe(false);
    });
  });

  describe('sight', () => {
    it('only dense steam blocks it', () => {
      const gases = ['fire_storm', 'poison_cloud', 'dense_steam'];
      gases.forEach((g, i) => engine.surfaces.setGas(i, 0, g, 5));
      ['water', 'oil_slick', 'acid_pool', 'ice_sheet', 'mud', 'fire'].forEach((s, i) => engine.surfaces.setSurface(i, 1, s, 5));
      expect(gases.map((_, i) => engine.surfaces.isTransparent(i, 0))).toEqual([true, true, false]);
      for (let i = 0; i < 6; i++) expect(engine.surfaces.isTransparent(i, 1)).toBe(true);
      expect(engine.surfaces.isTransparent(9, 9)).toBe(true);
    });
  });
});
