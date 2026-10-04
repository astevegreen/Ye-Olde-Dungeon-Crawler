import { describe, it, expect } from 'vitest';
import { CoinItem, GameEngine, GameMap, Item, Player, PotionItem, ScrollItem, WandItem } from '../../engine';
import { autoPickupGroupOf, autoPickupTargets, DEFAULT_AUTO_PICKUP } from '../autoPickup';
import { SettingsManager } from '../settings/settingsManager';
import { MemoryStorage } from '../../engine';

/** Tracker 2.5 (Q2 "C"): auto-pickup by kind of item, chosen in the settings. */
function hero(): GameEngine {
  return new GameEngine({ map: GameMap.createBoxRoom(10, 10), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
}
const potion = (id: string) => new PotionItem({ id, name: 'Healing Draught', potionType: 'health', potency: 10, identified: true });
const sword = (id: string, weight = 1000) => new Item({ id, name: 'Sword', category: 'weapon', slot: 'mainHand', weight, bulk: 500 });
const ring = (id: string) => new Item({ id, name: 'Band', category: 'ring', slot: 'fingerLeft', weight: 20, bulk: 10 });

describe('auto-pickup', () => {
  it('sorts items into the groups the settings name', () => {
    expect(autoPickupGroupOf(potion('p'))).toBe('potions');
    expect(autoPickupGroupOf(new ScrollItem({ id: 's', name: 'Scroll', spellId: 'x' }))).toBe('scrolls');
    expect(autoPickupGroupOf(new WandItem({ id: 'w', name: 'Wand', spellId: 'x', charges: 3, maxCharges: 3 }))).toBe('wands');
    expect(autoPickupGroupOf(ring('r'))).toBe('jewelry');
    expect(autoPickupGroupOf(sword('x'))).toBe('weapons');
    expect(autoPickupGroupOf(new Item({ id: 'h', name: 'Helm', category: 'helmet', slot: 'head', weight: 500, bulk: 300 }))).toBe('armor');
    expect(autoPickupGroupOf(new Item({ id: 'q', name: 'Relic', category: 'quest', weight: 1, bulk: 1 }))).toBeNull();
  });

  it('takes coins always, and by default potions, scrolls and wands but not gear', () => {
    expect(DEFAULT_AUTO_PICKUP).toEqual({ potions: true, scrolls: true, wands: true, jewelry: false, weapons: false, armor: false });
    const engine = hero();
    for (const item of [new CoinItem({ id: 'c', denomination: 'copper', count: 5 }), potion('p'), sword('x'), ring('r')]) engine.map.addItemAt(5, 5, item);
    expect(autoPickupTargets(engine, DEFAULT_AUTO_PICKUP).map((i) => i.id).sort()).toEqual(['c', 'p']);
    expect(autoPickupTargets(engine, { ...DEFAULT_AUTO_PICKUP, weapons: true, jewelry: true }).map((i) => i.id).sort()).toEqual(['c', 'p', 'r', 'x']);
  });

  it('leaves junk and anything the pack has no room for', () => {
    const engine = hero();
    const marked = potion('junk');
    marked.junk = true;
    engine.map.addItemAt(5, 5, marked);
    engine.map.addItemAt(5, 5, sword('anvil', 10_000_000));
    expect(autoPickupTargets(engine, { ...DEFAULT_AUTO_PICKUP, weapons: true })).toEqual([]);
  });

  it('keeps the choice in the settings, and an old settings file gets the defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem('yodc_settings', JSON.stringify({ hintsEnabled: false }));
    const settings = new SettingsManager(storage);
    expect(settings.getSettings().autoPickup).toEqual(DEFAULT_AUTO_PICKUP);
    settings.updateSettings({ autoPickup: { ...DEFAULT_AUTO_PICKUP, potions: false, armor: true } });
    expect(new SettingsManager(storage).getSettings().autoPickup).toEqual({ ...DEFAULT_AUTO_PICKUP, potions: false, armor: true });
  });
});
