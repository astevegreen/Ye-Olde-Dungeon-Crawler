import { describe, it, expect } from 'vitest';
import { getCarriedPotionKinds, potionKindKey, resolvePotionSlots, POTION_ROW_SLOT_COUNT } from '../potionRow';
import { GameEngine, GameMap, TILES, Player, PotionItem, Item, serializeGame, deserializeGame } from '../../engine';

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

describe('getCarriedPotionKinds', () => {
  it('groups carried potions by kind and counts them', () => {
    const engine = buildEngine();
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(potion('p1', 'Potion of Healing'));
    pack.addItem(potion('p2', 'Potion of Healing'));
    pack.addItem(new Item({ id: 'gem', name: 'Ruby', category: 'misc', weight: 10, bulk: 5, value: 100 }));

    expect(getCarriedPotionKinds(engine)).toEqual([
      { key: 'Potion of Healing', itemId: 'p1', name: 'Potion of Healing', count: 2, identified: true },
    ]);
  });

  it('shows an unidentified kind by its appearance, keyed by what it really is', () => {
    const engine = buildEngine();
    const murky = potion('u1', 'Potion of Speed', false, 'Murky Flask');
    engine.player.inventory.primaryPack.addItem(murky);

    const [kind] = getCarriedPotionKinds(engine);
    expect(kind.name).toBe('Murky Flask');
    expect(kind.key).toBe(potionKindKey(murky));
  });

  it('a known and an unknown bottle of one kind are two kinds, each under its own name, in either order (R-econ-8)', () => {
    const bottle = (id: string, identified: boolean) => {
      const p = new PotionItem({ id, definitionId: 'tonic', name: 'Bog-Myrtle Tonic', unidentifiedName: 'Murky Amber Draft', weight: 100, bulk: 50, potionType: 'health', potency: 10 });
      p.identified = identified;
      return p;
    };
    for (const order of [[true, false], [false, true]]) {
      const engine = buildEngine();
      order.forEach((known, i) => engine.player.inventory.primaryPack.addItem(bottle(`t${i}`, known)));

      const kinds = getCarriedPotionKinds(engine).map((k) => [k.name, k.count, k.identified]);

      expect(kinds).toEqual([
        ['Bog-Myrtle Tonic', 1, true],
        ['Murky Amber Draft', 1, false],
      ]);
    }
  });
});

describe('resolvePotionSlots', () => {
  it('pins what the hero carries the first time, then leaves pins to the player', () => {
    const engine = buildEngine();
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(potion('h1', 'Potion of Healing'));
    pack.addItem(potion('m1', 'Potion of Mana'));

    const first = resolvePotionSlots(engine);
    expect(first.map((s) => s.key)).toEqual(['Potion of Healing', 'Potion of Mana', null, null]);

    // The player empties slot 1; a new kind picked up does not refill it.
    engine.player.setQuickPotion(0, null, POTION_ROW_SLOT_COUNT);
    pack.addItem(potion('x1', 'Potion of Extra'));
    expect(resolvePotionSlots(engine).map((s) => s.key)).toEqual([null, 'Potion of Mana', null, null]);
  });

  it('keeps a pinned kind in its slot after the last one is drunk', () => {
    const engine = buildEngine();
    engine.player.setQuickPotion(2, 'Potion of Healing', POTION_ROW_SLOT_COUNT);

    const slots = resolvePotionSlots(engine);
    expect(slots[2]).toEqual({ key: 'Potion of Healing', carried: null });
  });

  it('moves a kind rather than pinning it twice', () => {
    const engine = buildEngine();
    engine.player.setQuickPotion(0, 'Potion of Healing', POTION_ROW_SLOT_COUNT);
    engine.player.setQuickPotion(3, 'Potion of Healing', POTION_ROW_SLOT_COUNT);
    expect(engine.player.quickPotions).toEqual([null, null, null, 'Potion of Healing']);
  });

  it('survives a save and load', () => {
    const engine = buildEngine();
    engine.player.setQuickPotion(1, 'Potion of Mana', POTION_ROW_SLOT_COUNT);
    const restored = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))));
    expect(restored.engine.player.quickPotions).toEqual([null, 'Potion of Mana', null, null]);
  });
});
