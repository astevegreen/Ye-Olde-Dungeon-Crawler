import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { SmithService } from '../smith';
import { cotwManifest } from '../../../content/cotw';

/** Tracker 2.7: Gunther's steps to +3 (Q10 "A", Q47 "A") and Ivalda's +5 (Q29, Q48 "A"). */
const GUNTHER = 'npc-gunther';

function heroEngine(): GameEngine {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 }, strength: 15 });
  const engine = new GameEngine({ map: GameMap.createBoxRoom(12, 12), player, manifest: cotwManifest, floor: 0 });
  player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return engine;
}

const sword = (id = 'sword', extra: Partial<ConstructorParameters<typeof Item>[0]> = {}) =>
  new Item({ id, name: 'Broadsword', category: 'weapon', slot: 'mainHand', weight: 2000, bulk: 900, identified: true, stats: { attackBonus: 4 }, value: 100, ...extra });

describe('Gunther raises +N one step at a time, up to +3 (Q47 "A")', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
    addCurrencyToPlayer(engine.player, 5000);
  });

  it('charges 250, 750 and 2,000 CP for the three steps, and +2 attack a step on a weapon', () => {
    const blade = sword();
    engine.player.inventory.primaryPack.addItem(blade);
    const paid: number[] = [];
    for (let step = 1; step <= 3; step++) {
      const before = getPlayerTotalCp(engine.player);
      expect(SmithService.upgrade(engine, GUNTHER, blade).success, `step ${step}`).toBe(true);
      paid.push(before - getPlayerTotalCp(engine.player));
      expect(blade.enchantmentLevel).toBe(step);
    }
    expect(paid).toEqual([250, 750, 2000]);
    expect(blade.stats.attackBonus).toBe(4 + 6);
    expect(blade.displayName).toContain('+3');
    expect(SmithService.upgrade(engine, GUNTHER, blade).success).toBe(false);
    expect(SmithService.workableItems(engine, GUNTHER)).not.toContain(blade);
  });

  it('gives armor +1 defense a step, and works what the hero wears too', () => {
    const mail = new Item({ id: 'mail', name: 'Chainmail', category: 'armor', slot: 'torso', weight: 9000, bulk: 6000, identified: true, stats: { defenseBonus: 4 } });
    engine.player.inventory.paperdoll.equip(mail, 'torso');
    expect(SmithService.workableItems(engine, GUNTHER)).toContain(mail);
    expect(SmithService.upgrade(engine, GUNTHER, mail).success).toBe(true);
    expect(mail.stats.defenseBonus).toBe(5);
  });

  it('starts from the level an item already has: a +2 from the dungeon costs 2,000 for +3', () => {
    const found = sword('found', { enchantmentLevel: 2, stats: { attackBonus: 8 } });
    engine.player.inventory.primaryPack.addItem(found);
    expect(SmithService.nextStepPrice(engine, GUNTHER, found)).toBe(2000);
  });

  it('will not work an unidentified item, a bound one, a ring, or past the purse', () => {
    const hidden = sword('hidden', { identified: false });
    const bound = sword('bound');
    bound.addModifier({ id: 'c', name: 'Cursed', alignment: 'negative', category: 'cursed', prefix: 'Cursed', binds: true });
    const ring = new Item({ id: 'ring', name: 'Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
    for (const item of [hidden, bound, ring]) {
      engine.player.inventory.primaryPack.addItem(item);
      expect(SmithService.upgrade(engine, GUNTHER, item).success, item.id).toBe(false);
    }
    expect(SmithService.workableItems(engine, GUNTHER)).toEqual([]);
    const poor = heroEngine();
    const blade = sword();
    poor.player.inventory.primaryPack.addItem(blade);
    expect(SmithService.upgrade(poor, GUNTHER, blade).success).toBe(false);
    expect(blade.enchantmentLevel).toBe(0);
  });
});

describe('Ivalda takes one item to +5, once, free (Q29, Q48 "A")', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
  });

  it('waits for the clans’ trust and her anvil in town', () => {
    const blade = sword();
    engine.player.inventory.primaryPack.addItem(blade);
    expect(SmithService.masterworkAvailable(engine, GUNTHER)).toBe(false);
    engine.worldState.factions.iron_clans = 0;
    expect(SmithService.masterworkAvailable(engine, GUNTHER)).toBe(false);
    engine.setWorldFlag('ivalda_in_town', true);
    expect(SmithService.masterworkAvailable(engine, GUNTHER)).toBe(true);
  });

  it('takes the chosen item straight to +5 for nothing, and only once', () => {
    engine.worldState.factions.iron_clans = 0;
    engine.setWorldFlag('ivalda_in_town', true);
    const blade = sword('blade', { enchantmentLevel: 1, stats: { attackBonus: 6 } });
    engine.player.inventory.primaryPack.addItem(blade);
    const before = getPlayerTotalCp(engine.player);
    expect(SmithService.masterwork(engine, GUNTHER, blade).success).toBe(true);
    expect(blade.enchantmentLevel).toBe(5);
    expect(blade.stats.attackBonus).toBe(6 + 8);
    expect(getPlayerTotalCp(engine.player)).toBe(before);
    const other = sword('other');
    engine.player.inventory.primaryPack.addItem(other);
    expect(SmithService.masterworkAvailable(engine, GUNTHER)).toBe(false);
    expect(SmithService.masterwork(engine, GUNTHER, other).success).toBe(false);
  });

  it('will not spend itself on an item already at +5', () => {
    engine.worldState.factions.iron_clans = 0;
    engine.setWorldFlag('ivalda_in_town', true);
    const top = sword('top', { enchantmentLevel: 5 });
    engine.player.inventory.primaryPack.addItem(top);
    expect(SmithService.masterwork(engine, GUNTHER, top).success).toBe(false);
    expect(SmithService.masterworkAvailable(engine, GUNTHER)).toBe(true);
  });
});
