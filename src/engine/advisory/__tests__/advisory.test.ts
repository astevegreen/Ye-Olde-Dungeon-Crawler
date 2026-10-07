import { describe, it, expect } from 'vitest';
import { RunAdvisor } from '../runAdvisor';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { GameEngine } from '../../engine';
import { ItemFactory } from '../../items/factory';
import { Item } from '../../items/item';
import { COTW_FLOOR_HAZARDS } from '../../../content/cotw/floorBands';
import { COTW_MANIFEST } from '../../../content/cotw';

describe('Town Sage Run Advisory Heuristics', () => {
  it('detects and warns when inventory bulk or weight exceeds 80% capacity', () => {
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });

    expect(RunAdvisor.checkInventoryBulk(player)).toBeNull();

    // Primary pack maxWeightCapacity is 30,000g. Add 25,000g (83%)
    const heavyArmor = new Item({
      id: 'heavy-plate',
      name: 'Heavy Plate',
      category: 'armor',
      weight: 25000,
      bulk: 200,
    });
    player.inventory.primaryPack.addItem(heavyArmor);

    const warn = RunAdvisor.checkInventoryBulk(player);
    expect(warn).not.toBeNull();
    expect(warn?.type).toBe('bulk');
    expect(warn?.severity).toBe('warning');
    expect(warn?.message).toContain('Backpack is currently at 83% capacity');
  });

  it('flags coins riding loose in the pack, outside the purse', () => {
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });

    expect(RunAdvisor.checkLooseCurrency(player)).toBeNull();

    // Add 60 gold coins = 6,000 CP
    const goldCoins = ItemFactory.createGoldCoins('g-stack-1', 60);
    player.inventory.primaryPack.addItem(goldCoins);

    const warn = RunAdvisor.checkLooseCurrency(player);
    expect(warn).not.toBeNull();
    expect(warn?.type).toBe('currency');
    expect(warn?.message).toContain('60 coins worth 6,000 CP');
    expect(warn?.recommendation).toContain('town banker');
  });

  it('flags equipped cursed gear on paperdoll', () => {
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });

    expect(RunAdvisor.checkCursedGear(player)).toBeNull();

    // Equip cursed broadsword (item first, slot second)
    const cursedSword = new Item({
      id: 'cursed-blade',
      name: 'Cursed Broadsword of Despair',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1500,
      bulk: 10,
      modifiers: [{ id: 'cursed-mod', name: 'Cursed', alignment: 'negative', category: 'cursed', prefix: 'Cursed', binds: true }],
    });
    player.inventory.paperdoll.equip(cursedSword, 'mainHand');

    const warn = RunAdvisor.checkCursedGear(player);
    expect(warn).not.toBeNull();
    expect(warn?.type).toBe('cursed');
    expect(warn?.severity).toBe('danger');
    expect(warn?.message).toContain('Cursed Broadsword of Despair');
    expect(warn?.recommendation).toContain('town temple priest');
  });

  it('checks emergency consumables for deep dungeon floors (Floor 10+)', () => {
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });

    // Floor 5 does not require deep consumables
    expect(RunAdvisor.checkDeepFloorConsumables(player, 5)).toBeNull();

    // Floor 10 without potions/scrolls raises danger
    const warn = RunAdvisor.checkDeepFloorConsumables(player, 10);
    expect(warn).not.toBeNull();
    expect(warn?.type).toBe('consumables');
    expect(warn?.severity).toBe('danger');
    expect(warn?.recommendation).toContain('before descending');

    // Add 2 Health Potions
    player.inventory.primaryPack.addItem(ItemFactory.createHealthPotion('hp-1'));
    player.inventory.primaryPack.addItem(ItemFactory.createHealthPotion('hp-2'));

    expect(RunAdvisor.checkDeepFloorConsumables(player, 10)).toBeNull();
  });

  it('evaluates elemental threats on deep floors vs player resistances', () => {
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });

    // Floor 12 cold threats
    // A pack with no floorHazards gets no elemental warnings at all.
    expect(RunAdvisor.checkElementalPreparedness(player, 12)).toBeNull();

    const coldWarn = RunAdvisor.checkElementalPreparedness(player, 12, COTW_FLOOR_HAZARDS);
    expect(coldWarn).not.toBeNull();
    expect(coldWarn?.type).toBe('elemental');
    expect(coldWarn?.message).toContain('frost drakes');

    // Floor 28 fire threats
    const fireWarn = RunAdvisor.checkElementalPreparedness(player, 28, COTW_FLOOR_HAZARDS);
    expect(fireWarn).not.toBeNull();
    expect(fireWarn?.type).toBe('elemental');
    expect(fireWarn?.message).toContain('fire elementals');
  });

  // R-dbg-12: from town the Sage judged floor 1 whatever the hero had reached, so a hero
  // about to take the Rune of Return to floor 14 heard "the runes smile upon your readiness".
  it('from town judges the deepest floor the hero has reached, floor 1 for a new hero; below, the floor the hero is on', () => {
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 0, y: 0 }, stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 } });
    const engine = new GameEngine({ map: new GameMap(10, 10), player, floor: 0, manifest: COTW_MANIFEST });
    expect(RunAdvisor.evaluateRun(engine).targetFloor).toBe(1);

    engine.gameState.updateFloor(14);
    const report = RunAdvisor.evaluateRun(engine);
    expect(engine.currentFloor).toBe(0);
    expect(report.targetFloor).toBe(14);
    expect(report.overallStatus).toBe('danger');
    expect(report.warnings.find((w) => w.type === 'consumables')?.message).toContain('Floor 14');

    const below = new GameEngine({ map: new GameMap(10, 10), player, floor: 6, manifest: COTW_MANIFEST });
    below.gameState.updateFloor(14);
    expect(RunAdvisor.evaluateRun(below).targetFloor).toBe(6);
  });

  it('aggregates full advisory report with status classification and Sage quote', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 0, manifest: COTW_MANIFEST });

    const report = RunAdvisor.evaluateRun(engine);
    expect(report.targetFloor).toBe(1);
    expect(report.overallStatus).toBe('safe');
    expect(report.warnings.length).toBe(0);
    expect(report.sageQuote).toBeDefined();

    // Equip cursed item and evaluate for Floor 12
    const cursedArmor = new Item({
      id: 'cursed-helm',
      name: 'Cursed Iron Helm',
      category: 'armor',
      slot: 'head',
      weight: 1000,
      bulk: 5,
      modifiers: [{ id: 'cursed-mod', name: 'Cursed', alignment: 'negative', category: 'cursed', prefix: 'Cursed', binds: true }],
    });
    player.inventory.paperdoll.equip(cursedArmor, 'head');

    engine.gameState.updateFloor(12); // the deepest floor the hero has reached
    const dangerReport = RunAdvisor.evaluateRun(engine);
    expect(dangerReport.targetFloor).toBe(12);
    expect(dangerReport.overallStatus).toBe('danger');
    expect(dangerReport.warnings.some((w) => w.type === 'cursed')).toBe(true);
    expect(dangerReport.warnings.some((w) => w.type === 'consumables')).toBe(true);
    expect(dangerReport.warnings.some((w) => w.type === 'elemental')).toBe(true);
  });
});

describe('R-dbg-9 · consulting the Sage draws nothing from the run PRNG', () => {
  it('evaluateRun leaves the PRNG where it was, so a bug-report replay stays in step', () => {
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 }, stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 } });
    const engine = new GameEngine({ map: GameMap.createBoxRoom(10, 10), player });
    const before = engine.prng.getState();

    const report = RunAdvisor.evaluateRun(engine);

    expect(engine.prng.getState()).toBe(before);
    expect(report.sageQuote).toBeTruthy();
  });
});
