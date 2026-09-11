import { describe, it, expect } from 'vitest';
import { RunAdvisor } from '../runAdvisor';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { GameEngine } from '../../engine';
import { ItemFactory } from '../../items/factory';
import { Item } from '../../items/item';

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

  it('detects excessive loose currency (> 5,000 CP or > 2,000g coin weight)', () => {
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
    expect(warn?.message).toContain('6 PP');
    expect(warn?.recommendation).toContain('Banker Haakon');
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
      quality: 'cursed',
    });
    player.inventory.paperdoll.equip(cursedSword, 'mainHand');

    const warn = RunAdvisor.checkCursedGear(player);
    expect(warn).not.toBeNull();
    expect(warn?.type).toBe('cursed');
    expect(warn?.severity).toBe('danger');
    expect(warn?.message).toContain('Cursed Broadsword of Despair');
    expect(warn?.recommendation).toContain('Temple of Thor');
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
    expect(warn?.recommendation).toContain('Astrid\'s Alchemy');

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
    const coldWarn = RunAdvisor.checkElementalPreparedness(player, 12);
    expect(coldWarn).not.toBeNull();
    expect(coldWarn?.type).toBe('elemental');
    expect(coldWarn?.message).toContain('frost drakes');

    // Floor 28 fire threats
    const fireWarn = RunAdvisor.checkElementalPreparedness(player, 28);
    expect(fireWarn).not.toBeNull();
    expect(fireWarn?.type).toBe('elemental');
    expect(fireWarn?.message).toContain('fire elementals');
  });

  it('aggregates full advisory report with status classification and Sage quote', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 0, y: 0 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 0 });

    const report = RunAdvisor.evaluateRun(engine, 1);
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
      quality: 'cursed',
    });
    player.inventory.paperdoll.equip(cursedArmor, 'head');

    const dangerReport = RunAdvisor.evaluateRun(engine, 12);
    expect(dangerReport.overallStatus).toBe('danger');
    expect(dangerReport.warnings.some((w) => w.type === 'cursed')).toBe(true);
    expect(dangerReport.warnings.some((w) => w.type === 'consumables')).toBe(true);
    expect(dangerReport.warnings.some((w) => w.type === 'elemental')).toBe(true);
  });
});
