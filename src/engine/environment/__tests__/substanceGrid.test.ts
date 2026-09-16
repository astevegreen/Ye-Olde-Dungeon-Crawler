import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Entity } from '../../entities/entity';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { SubstanceGrid, SubstanceBitmask } from '../substanceGrid';
import {
  CorpseItemInstance,
  ReanimateCorpseAction,
  ConsumeCorpseAction,
  CremateCorpseAction,
} from '../../items/corpse';
import { DeathResolver } from '../../combat/deathResolver';

describe('SubstanceGrid & Organic Corpse Lifecycle', () => {
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

  it('drops CorpseItemInstance on monster death and supports reanimation, consumption, and cremation', () => {
    const goblin = new Monster({
      id: 'goblin-1',
      name: 'Goblin Scout',
      position: { x: 7, y: 7 },
      stats: { hp: 1, maxHp: 10, attack: 3, defense: 1 },
      definitionId: 'goblin',
    });
    map.addEntity(goblin);

    // Monster death resolution
    DeathResolver.resolveDeath(engine, player, goblin);

    // Verify corpse dropped on death tile (7, 7)
    const items = map.getItemsAt(7, 7);
    const corpse = items.find((i) => i instanceof CorpseItemInstance) as CorpseItemInstance;
    expect(corpse).toBeDefined();
    expect(corpse.archetypeId).toBe('goblin');

    // 1. Reanimate Corpse Action
    const reanimateAction = new ReanimateCorpseAction(player, corpse, 7, 7);
    const reanimateRes = reanimateAction.perform(engine);
    expect(reanimateRes.success).toBe(true);

    const thrall = map.getEntityAt(7, 7) as Monster;
    expect(thrall).toBeDefined();
    expect(thrall.name).toContain('Thrall');
    expect(thrall.faction).toBe(player.faction);
    expect(map.getItemsAt(7, 7).some((i) => i.id === corpse.id)).toBe(false);
  });

  it('consumes corpse to restore health and cremates corpse with thermal substance', () => {
    player.hp = 30; // 30 / 50 HP

    const corpse1 = new CorpseItemInstance({ id: 'corpse-test-1', archetypeId: 'wolf' });
    map.addItemAt(5, 6, corpse1);

    const consumeAction = new ConsumeCorpseAction(player, corpse1, 5, 6);
    const consumeRes = consumeAction.perform(engine);
    expect(consumeRes.success).toBe(true);
    expect(player.hp).toBe(45); // 30 + 15
    expect(map.getItemsAt(5, 6).length).toBe(0);

    // Thermal cremation in ignited cell
    const corpse2 = new CorpseItemInstance({ id: 'corpse-test-2', archetypeId: 'ogre' });
    map.addItemAt(8, 8, corpse2);
    substances.addSubstance(8, 8, SubstanceBitmask.IGNITED);

    const summary = substances.tickSubstances(map, engine);
    expect(summary.crematedCount).toBe(1);

    const remainingItems = map.getItemsAt(8, 8);
    expect(remainingItems.some((i) => i instanceof CorpseItemInstance)).toBe(false);
    expect(remainingItems.some((i) => i.name === 'Pile of Ash')).toBe(true);

    // Manual cremation action
    const corpse3 = new CorpseItemInstance({ id: 'corpse-test-3', archetypeId: 'goblin' });
    map.addItemAt(4, 4, corpse3);
    const cremateAction = new CremateCorpseAction(player, corpse3, 4, 4);
    const cremateRes = cremateAction.perform(engine);
    expect(cremateRes.success).toBe(true);
    expect(map.getItemsAt(4, 4).some((i) => i.name === 'Pile of Ash')).toBe(true);
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
