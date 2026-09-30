import { describe, it, expect } from 'vitest';
import { getPotionRowEntries, POTION_ROW_SLOT_COUNT } from '../potionRow';
import { GameEngine, GameMap, TILES, Player, PotionItem, Item } from '../../engine';

function buildEngine() {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  return new GameEngine({ map, player });
}

function potion(id: string, name: string, identified = true, unidentifiedName?: string) {
  const p = new PotionItem({ id, name, unidentifiedName, weight: 100, bulk: 50, potionType: 'health', potency: 10 });
  p.identified = identified;
  return p;
}

describe('getPotionRowEntries', () => {
  it('groups carried potions by name and counts them', () => {
    const engine = buildEngine();
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(potion('p1', 'Potion of Healing'));
    pack.addItem(potion('p2', 'Potion of Healing'));
    pack.addItem(new Item({ id: 'gem', name: 'Ruby', category: 'misc', weight: 10, bulk: 5, value: 100 }));

    const entries = getPotionRowEntries(engine);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ itemId: 'p1', name: 'Potion of Healing', count: 2, identified: true });
  });

  it('lists identified kinds first, then unknown ones, each alphabetically, capped at the slot count', () => {
    const engine = buildEngine();
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(potion('u1', 'Potion of Speed', false, 'Murky Flask'));
    pack.addItem(potion('h1', 'Potion of Healing'));
    pack.addItem(potion('u2', 'Potion of Poison', false, 'Bubbling Vial'));
    pack.addItem(potion('m1', 'Potion of Mana'));
    pack.addItem(potion('x1', 'Potion of Extra'));

    const entries = getPotionRowEntries(engine);
    expect(entries).toHaveLength(POTION_ROW_SLOT_COUNT);
    expect(entries.map((e) => e.identified)).toEqual([true, true, true, false]);
    expect(entries.slice(0, 3).map((e) => e.name)).toEqual(['Potion of Extra', 'Potion of Healing', 'Potion of Mana']);
  });

  it('is empty when the hero carries no potions', () => {
    expect(getPotionRowEntries(buildEngine())).toEqual([]);
  });
});
