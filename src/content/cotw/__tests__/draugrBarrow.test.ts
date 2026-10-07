import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { cotwManifest } from '../index';
import { COTW_QUEST } from '../quest';
import { COTW_FLOOR_LAYOUTS } from '../floorLayouts';
import { COTW_VAULTS } from '../vaults';

/**
 * The Draugr Barrow guards with an Ancient Draugr, a floor-14 monster; on floor 1 it met a
 * third of new heroes (the floor 1-10 playtest), so the owner moved the barrow to floors 6+.
 */
describe('The Draugr Barrow stands on floors 6-9 only', () => {
  it('is the landmark of floors 6-9, and no random vault before floor 6', () => {
    for (let floor = 1; floor <= 9; floor++) {
      const band = COTW_FLOOR_LAYOUTS.find((b) => floor >= b.minFloor && (b.maxFloor === undefined || floor <= b.maxFloor))!;
      const landmarks = (band.params?.landmarkVaultIds as string[] | undefined) ?? [];
      expect(landmarks.includes('draugr_barrow'), `floor ${floor}`).toBe(floor >= 6);
    }
    const barrow = COTW_VAULTS.find((v) => v.id === 'draugr_barrow')!;
    expect(barrow.minFloor).toBe(6);
    // The Rime Hollows still open in their threshold room on floor 1, and only there.
    expect(COTW_FLOOR_LAYOUTS.filter((b) => b.minFloor <= 9 && b.threshold).map((b) => b.minFloor)).toEqual([1]);
  });

  it('puts no Ancient Draugr on floors 1-5, and still some on 6-9', () => {
    const engine = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ id: 'p', name: 'P', position: { x: 1, y: 1 } }),
      manifest: cotwManifest,
    });
    const quest = { ...COTW_QUEST, maxFloor: 50, bossFloor: 50 };
    const draugrOn = (floor: number, seed: number) =>
      DungeonArc.generateFloor(floor, seed * 7919, quest, cotwManifest, 1, undefined, engine.registries)
        .map.getAllEntities()
        .filter((e) => e instanceof Monster && e.definitionId === 'draugr').length;

    let shallow = 0;
    let deep = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const floor of [1, 3, 5]) shallow += draugrOn(floor, seed);
      for (const floor of [6, 8]) deep += draugrOn(floor, seed);
    }
    expect(shallow).toBe(0);
    expect(deep).toBeGreaterThan(0);
  }, 30_000);
});
