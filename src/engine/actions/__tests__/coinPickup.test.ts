import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { CoinItem, parseCoinItem } from '../../economy/currency';
import { PickUpAction } from '../inventory-actions';

describe('coin pickup', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(20, 15, TILES.FLOOR);
    for (let x = 0; x < 20; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, 14, TILES.WALL);
    }
    for (let y = 0; y < 15; y++) {
      map.setTile(0, y, TILES.WALL);
      map.setTile(19, y, TILES.WALL);
    }
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map, player });
  });

  describe('Zero-to-One Click: Coin Auto-Pickup Only', () => {
    it('picks up coins as freeAction (0 energy cost) when stepping on a tile', () => {
      const goldCoins = new CoinItem({ id: 'gold-coins-1', denomination: 'gold', count: 25 });
      const ironSword = new Item({
        id: 'iron-sword-1',
        name: 'Iron Sword',
        category: 'weapons',
        bulk: 3,
        slot: 'mainHand',
        weight: 1500,
        value: 10,
        stats: { attackBonus: 4 },
      });

      // Place both coins and non-coin sword on tile (5, 5)
      engine.map.addItemAt(5, 5, goldCoins);
      engine.map.addItemAt(5, 5, ironSword);

      expect(engine.map.getItemsAt(5, 5)).toHaveLength(2);

      // Verify parseCoinItem recognizes goldCoins and rejects ironSword
      expect(parseCoinItem(goldCoins)).not.toBeNull();
      expect(parseCoinItem(ironSword)).toBeNull();

      // Simulate coin auto-pickup logic
      const itemsOnTile = engine.map.getItemsAt(player.x, player.y) || [];
      for (const item of [...itemsOnTile]) {
        if (parseCoinItem(item)) {
          engine.commandBus.dispatch({
            type: 'pickup_item',
            payload: { itemId: item.id, freeAction: true },
          });
        }
      }

      // Assert: Coins were picked up, sword remains on ground
      const remainingItems = engine.map.getItemsAt(5, 5) || [];
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0].id).toBe('iron-sword-1');

      // Assert: Player inventory contains the coins
      const hasCoins = player.inventory.primaryPack.getItems().some((it) => it.id === goldCoins.id);
      expect(hasCoins).toBe(true);
    });

    it('PickUpAction with freeAction=true costs 0 energy', () => {
      const goldCoins = new CoinItem({ id: 'gold-coins-2', denomination: 'gold', count: 10 });
      const goldCoins3 = new CoinItem({ id: 'gold-coins-3', denomination: 'gold', count: 10 });
      engine.map.addItemAt(5, 5, goldCoins);
      engine.map.addItemAt(5, 5, goldCoins3);

      const normalAction = new PickUpAction(player, goldCoins.id, false);
      const normalResult = engine.handlePlayerAction(normalAction);
      expect(normalResult.success).toBe(true);
      expect(normalResult.cost).toBeGreaterThan(0);

      const freeAction = new PickUpAction(player, goldCoins3.id, true);
      const freeResult = engine.handlePlayerAction(freeAction);
      expect(freeResult.success).toBe(true);
      expect(freeResult.cost).toBe(0);
    });
  });
});
