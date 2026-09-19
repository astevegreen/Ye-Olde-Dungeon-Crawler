import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Entity } from '../../entities/entity';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { SubstanceGrid, SubstanceBitmask } from '../substanceGrid';

describe('SubstanceGrid', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;
  let substances: SubstanceGrid;

  beforeEach(() => {
    map = new GameMap(12, 12, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
    });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
    substances = map.substances;
  });

  it('manages layered substance bitmasks on cells', () => {
    substances.addSubstance(3, 3, SubstanceBitmask.FLOWING_FLUID);
    expect(substances.hasSubstance(3, 3, SubstanceBitmask.FLOWING_FLUID)).toBe(true);
    expect(substances.hasSubstance(3, 3, SubstanceBitmask.IGNITED)).toBe(false);

    substances.addSubstance(3, 3, SubstanceBitmask.IGNITED);
    expect(substances.hasSubstance(3, 3, SubstanceBitmask.FLOWING_FLUID)).toBe(true);
    expect(substances.hasSubstance(3, 3, SubstanceBitmask.IGNITED)).toBe(true);

    substances.removeSubstance(3, 3, SubstanceBitmask.FLOWING_FLUID);
    expect(substances.hasSubstance(3, 3, SubstanceBitmask.FLOWING_FLUID)).toBe(false);
    expect(substances.hasSubstance(3, 3, SubstanceBitmask.IGNITED)).toBe(true);
  });

  it('repels vulnerableToCurrents entities from FLOWING_FLUID cells', () => {
    substances.addSubstance(4, 5, SubstanceBitmask.FLOWING_FLUID);

    const waterSensitiveMonster = new Entity({
      id: 'fire_elemental',
      name: 'Fire Sprite',
      type: 'monster',
      faction: 'hostile',
      position: { x: 4, y: 4 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
      vulnerabilityTags: ['vulnerableToCurrents'],
    });

    const standardMonster = new Entity({
      id: 'orc',
      name: 'Orc',
      type: 'monster',
      faction: 'hostile',
      position: { x: 4, y: 6 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
      vulnerabilityTags: [],
    });

    expect(substances.canTraverse(waterSensitiveMonster, 4, 5)).toBe(false);
    expect(substances.canTraverse(standardMonster, 4, 5)).toBe(true);
  });

  it('blocks incorporeal entities from pathing through PURIFIED_BARRIER lines', () => {
    substances.addSubstance(2, 2, SubstanceBitmask.PURIFIED_BARRIER);

    const ghost = new Entity({
      id: 'ghost',
      name: 'Ghost',
      type: 'monster',
      faction: 'hostile',
      position: { x: 1, y: 2 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
      vulnerabilityTags: ['incorporeal'],
    });

    const corporealGolem = new Entity({
      id: 'golem',
      name: 'Golem',
      type: 'monster',
      faction: 'hostile',
      position: { x: 3, y: 2 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 },
    });

    expect(substances.canTraverse(ghost, 2, 2)).toBe(false);
    expect(substances.canTraverse(corporealGolem, 2, 2)).toBe(true);
  });

  it('deals continuous radiant degradation to photophobic entities in RADIANT_EXPOSURE', () => {
    substances.addSubstance(6, 6, SubstanceBitmask.RADIANT_EXPOSURE);

    const vampire = new Entity({
      id: 'vampire',
      name: 'Vampire Spawn',
      type: 'monster',
      faction: 'hostile',
      position: { x: 6, y: 6 },
      stats: { hp: 15, maxHp: 15, attack: 3, defense: 1 },
      vulnerabilityTags: ['photophobic'],
    });
    map.addEntity(vampire);

    const summary = substances.tickSubstances(map, engine);
    expect(summary.damageDealt).toBe(3);
    expect(vampire.hp).toBe(12); // 15 - 3 radiant damage
  });

  it('respects maxTickBudget for bounded spatial sweep complexity', () => {
    substances.maxTickBudget = 5;
    // Add 10 active cells
    for (let i = 0; i < 10; i++) {
      substances.addSubstance(i, 0, SubstanceBitmask.FLOWING_FLUID);
    }

    const summary = substances.tickSubstances(map, engine);
    expect(summary.cellsProcessed).toBe(5); // Strictly bounded by budget
  });
});
