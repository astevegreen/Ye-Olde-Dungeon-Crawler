import { describe, it, expect } from 'vitest';
import { CoinItem, COIN_BULK_CM3, GameEngine, GameMap, ItemFactory, Player } from '../../engine';
import { purseFill } from '../purseFill';

function hero(withPurse: boolean): Player {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
  new GameEngine({ map: GameMap.createBoxRoom(10, 10), player });
  if (withPurse) player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return player;
}

describe('purseFill', () => {
  it('is null for a hero with no purse', () => {
    expect(purseFill(hero(false))).toBeNull();
  });

  it('counts the coins in the purse against its room, and those that spilled into the pack', () => {
    const player = hero(true);
    const capacity = Math.floor(player.inventory.purse!.maxBulkCapacity / COIN_BULK_CM3);
    expect(purseFill(player)).toEqual({ held: 0, capacity, loose: 0 });

    player.inventory.storeItem(new CoinItem({ id: 'copper', denomination: 'copper', count: 120 }));
    expect(purseFill(player)).toEqual({ held: 120, capacity, loose: 0 });

    player.inventory.storeItem(new CoinItem({ id: 'silver', denomination: 'silver', count: capacity }));
    const full = purseFill(player)!;
    expect(full.held).toBe(capacity);
    expect(full.loose).toBe(120);
  });
});
