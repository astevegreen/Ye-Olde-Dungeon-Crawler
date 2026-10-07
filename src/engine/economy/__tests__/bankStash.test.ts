import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { addCoinsToContainer } from '../currency';
import { BankService } from '../services';
import { serializeSaveData, deserializeSaveData } from '../../storage/serializer';
import { COTW_MANIFEST } from '../../../content/cotw';

const gem = (id: string) => new Item({ id, name: `Gem ${id}`, category: 'misc', weight: 100, bulk: 50, value: 100, identified: true });

describe("the bank's stash: items kept in town between delves", () => {
  let engine: GameEngine;

  beforeEach(() => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player, floor: 0, manifest: COTW_MANIFEST });
  });

  it('leaves a pack item with the bank and takes it back, as town services: no turn, a checkpoint', () => {
    engine.player.inventory.primaryPack.addItem(gem('g1'));
    const turn = engine.turnCount;
    expect(engine.commandBus.dispatch({ type: 'bank_stash', payload: { itemId: 'g1' } }).success).toBe(true);
    expect(engine.player.inventory.findItemById('g1')).toBeUndefined();
    expect(BankService.stashedItems(engine).map((i) => i.id)).toEqual(['g1']);
    expect(engine.commandBus.dispatch({ type: 'bank_withdraw', payload: { itemId: 'g1' } }).success).toBe(true);
    expect(engine.player.inventory.findItemById('g1')).toBeDefined();
    expect(BankService.stashedItems(engine)).toEqual([]);
    expect(engine.turnCount).toBe(turn);
  });

  it("keeps no coins or quest items, nothing worn, and no more than its capacity", () => {
    addCoinsToContainer(engine.player.inventory.primaryPack, 'copper', 10);
    engine.player.inventory.primaryPack.addItem(new Item({ id: 'relic', name: 'Relic', category: 'quest', weight: 10, bulk: 10 }));
    expect(BankService.stashableItems(engine)).toEqual([]);
    expect(BankService.stashItem(engine, 'relic').success).toBe(false);

    for (let i = 0; i < BankService.STASH_CAPACITY; i++) {
      engine.player.inventory.primaryPack.addItem(gem(`s${i}`));
      expect(BankService.stashItem(engine, `s${i}`).success).toBe(true);
    }
    engine.player.inventory.primaryPack.addItem(gem('one-too-many'));
    const full = BankService.stashItem(engine, 'one-too-many');
    expect(full.success).toBe(false);
    expect(full.message).toContain(`${BankService.STASH_CAPACITY}`);
    expect(engine.player.inventory.findItemById('one-too-many')).toBeDefined();
  });

  it('keeps the stash through a save and load', () => {
    engine.player.inventory.primaryPack.addItem(gem('g1'));
    BankService.stashItem(engine, 'g1');
    const restored = deserializeSaveData(serializeSaveData(engine), COTW_MANIFEST);
    expect(BankService.stashedItems(restored).map((i) => i.name)).toEqual(['Gem g1']);
  });
});
