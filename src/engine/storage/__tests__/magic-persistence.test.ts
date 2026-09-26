import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { ItemFactory } from '../../items/factory';
import { WandItem } from '../../items/consumables';
import { serializeGame, deserializeGame } from '../serializer';
import type { CharacterProfile } from '../types';

describe('Magic & Consumables Persistence', () => {
  it('preserves player mana, learned spells, and wand charges across serialize/deserialize cycles', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'magus-1',
      name: 'Freya',
      position: { x: 3, y: 3 },
      stats: { hp: 28, maxHp: 35, attack: 7, defense: 4 },
      mana: 14,
      maxMana: 40,
      spellsKnown: ['magic_arrow', 'lightning_bolt', 'fireball', 'heal_minor'],
    });

    // Create a wand with 4 of 8 charges remaining and place in pack
    const wand = ItemFactory.createWandOfLightning('wand-persist-1', 8);
    wand.charges = 4;
    player.inventory.primaryPack.addItem(wand);

    // Create a scroll and place in pack
    const scroll = ItemFactory.createScrollOfIdentify('scroll-persist-1');
    player.inventory.primaryPack.addItem(scroll);

    // Create a potion and place in pack
    const potion = ItemFactory.createManaPotion('mana-pot-persist-1');
    player.inventory.primaryPack.addItem(potion);

    const engine = new GameEngine({ map, player });

    const profile: CharacterProfile = {
      id: player.id,
      name: player.name,
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      mana: player.mana,
      maxMana: player.maxMana,
    };

    // Serialize
    const saveData = serializeGame(engine, profile);

    // Deserialize into fresh engine
    const loaded = deserializeGame(saveData);
    const loadedPlayer = loaded.engine.player;

    // Verify Player Mana & Spells
    expect(loadedPlayer.mana).toBe(14);
    expect(loadedPlayer.maxMana).toBe(40);
    expect(loadedPlayer.spellsKnown).toEqual(['magic_arrow', 'lightning_bolt', 'fireball', 'heal_minor']);

    // Verify Wand charges
    const loadedItems = loadedPlayer.inventory.primaryPack.getItems();
    expect(loadedItems).toHaveLength(3);

    const loadedWand = loadedItems.find((i) => i.id === 'wand-persist-1') as WandItem;
    expect(loadedWand).toBeDefined();
    expect(loadedWand).toBeInstanceOf(WandItem);
    expect(loadedWand.spellId).toBe('lightning_bolt');
    expect(loadedWand.charges).toBe(4);
    expect(loadedWand.maxCharges).toBe(8);
  });

  it('preserves discoveryEvents across serialize/deserialize cycles', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero-1', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, floor: 3 });

    engine.emitDiscovery({ type: 'secret_door', text: 'Revealed a hidden rune vault!' });
    engine.emitDiscovery({ type: 'boss_slain', text: 'Defeated Gálmr the Frost-Warden!' });

    expect(engine.discoveryEvents).toHaveLength(2);

    const saveData = serializeGame(engine);
    const loaded = deserializeGame(saveData);

    expect(loaded.engine.discoveryEvents).toHaveLength(2);
    expect(loaded.engine.discoveryEvents[0].type).toBe('secret_door');
    expect(loaded.engine.discoveryEvents[0].text).toBe('Revealed a hidden rune vault!');
    expect(loaded.engine.discoveryEvents[1].type).toBe('boss_slain');
    expect(loaded.engine.discoveryEvents[1].text).toBe('Defeated Gálmr the Frost-Warden!');
  });
});
