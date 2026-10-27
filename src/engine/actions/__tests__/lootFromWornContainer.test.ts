import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { cotwManifest } from '../../../content/cotw';
import type { GameEngine } from '../../engine';
import { Container } from '../../items/container';
import { Item } from '../../items/item';
import { PotionItem } from '../../items/consumables';
import { CoinItem } from '../../economy/currency';
import { createScaledItem } from '../../dungeon/lootSpawner';
import { LootAllFromContainerAction, LootFromContainerAction } from '../inventory-actions';

/**
 * B1 (sprint, 21 Oct): taking an item out of a worn belt, purse or rune pouch moved it straight
 * back where it was, spent a turn, and logged it as taken. It goes to the pack now.
 */
const newHero = () => new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Belt', { seed: 221 }).engine;

const make = (id: string, n = 1) => {
  const def = cotwManifest.items!.find((i) => i.id === id)!;
  return createScaledItem(def, `${id}-b1-${n}`, 1, () => 0.5);
};

const take = (engine: GameEngine, container: Container, item: Item) =>
  new LootFromContainerAction(engine.player, container, item).perform(engine);

const takeAll = (engine: GameEngine, container: Container) =>
  new LootAllFromContainerAction(engine.player, container).perform(engine);

/** Fills the pack to its last cm³, so nothing with bulk fits. */
const fillPack = (engine: GameEngine) => {
  const pack = engine.player.inventory.primaryPack;
  pack.addItem(
    new Item({ id: 'boulder', name: 'Boulder', category: 'misc', weight: 0, bulk: pack.maxBulkCapacity - pack.containedBulk() })
  );
};

/** How many of `definitionId` the container holds, stacks counted by quantity. */
const countOf = (c: Container, definitionId: string | undefined): number =>
  c.getItems().reduce((n, i) => n + (i.definitionId === definitionId ? (i.quantity ?? 1) : 0), 0);

const coinsIn = (c: Container | null | undefined): number =>
  (c?.getItems() ?? []).reduce((n, i) => n + (i instanceof CoinItem ? i.count : 0), 0);

describe('taking an item out of a worn container', () => {
  it('moves a potion from the worn belt into the pack and spends a turn', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const belt = inv.belt!;
    expect(belt.definitionId).toBe('braided_sinew_cord');
    const potion = belt.getItems().find((i) => i instanceof PotionItem)!;
    expect(potion).toBeDefined();
    const inPack = countOf(inv.primaryPack, potion.definitionId);

    const result = take(engine, belt, potion);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.message).toContain('(stored in pack)');
    expect(belt.getItem(potion.id)).toBeNull();
    expect(countOf(belt, potion.definitionId)).toBe(0);
    expect(countOf(inv.primaryPack, potion.definitionId)).toBe(inPack + (potion.quantity ?? 1));
  });

  it('moves a pile of coins from the worn purse into the pack, all of it', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const purse = inv.purse!;
    const pile = purse.getItems().find((i): i is CoinItem => i instanceof CoinItem)!;
    expect(pile).toBeDefined();
    const count = pile.count;
    const inPurse = coinsIn(purse);
    const inPack = coinsIn(inv.primaryPack);

    const result = take(engine, purse, pile);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.message).toContain('(stored in pack)');
    expect(coinsIn(purse)).toBe(inPurse - count);
    expect(coinsIn(inv.primaryPack)).toBe(inPack + count);
  });

  it('moves an essence from the worn rune pouch into the pack', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const pouch = inv.paperdoll.getItem('runes') as Container;
    const essence = make('essence_isa');
    expect(inv.storeItem(essence).destination).toBe('runes');

    const result = take(engine, pouch, essence);

    expect(result.success).toBe(true);
    expect(result.message).toContain('(stored in pack)');
    expect(pouch.getItem(essence.id)).toBeNull();
    expect(inv.primaryPack.getItem(essence.id)).toBe(essence);
  });

  it('with no room in the pack, fails at no cost and leaves the item where it was', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const belt = inv.belt!;
    const potion = belt.getItems().find((i) => i instanceof PotionItem)!;
    const quantity = potion.quantity;
    const purse = inv.purse!;
    const pile = purse.getItems().find((i): i is CoinItem => i instanceof CoinItem)!;
    const count = pile.count;
    fillPack(engine);
    const energy = engine.player.energy;

    const fromBelt = take(engine, belt, potion);
    const fromPurse = take(engine, purse, pile);

    expect(fromBelt).toMatchObject({ success: false, cost: 0 });
    expect(belt.getItem(potion.id)).toBe(potion);
    expect(potion.quantity).toBe(quantity);
    expect(fromPurse).toMatchObject({ success: false, cost: 0 });
    expect(purse.getItem(pile.id)).toBe(pile);
    expect(pile.count).toBe(count);
    expect(engine.player.energy).toBe(energy);
  });
});

/**
 * F1 (sprint, 25 Oct; #70): Take all from a worn belt, purse or rune pouch put every item straight
 * back, spent a turn, and logged "Looted N items". It moves them to the pack now.
 */
describe('taking everything out of a worn container', () => {
  it('moves the potions from the worn belt into the pack and leaves the belt empty', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const belt = inv.belt!;
    const held = [...belt.getItems()];
    const potion = held.find((i) => i instanceof PotionItem)!;
    expect(potion).toBeDefined();
    const inPack = countOf(inv.primaryPack, potion.definitionId);
    const energy = engine.player.energy;

    const result = takeAll(engine, belt);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(engine.player.energy).toBe(energy - result.cost);
    expect(belt.getItems()).toHaveLength(0);
    const potions = held.filter((i) => i.definitionId === potion.definitionId).reduce((n, i) => n + (i.quantity ?? 1), 0);
    expect(countOf(inv.primaryPack, potion.definitionId)).toBe(inPack + potions);
    expect(result.message).toContain(`Looted ${held.length} item`);
    expect(result.message).toContain('(stored in pack)');
    expect(engine.messages.at(-1)).toBe(result.message);
  });

  it('moves the coins from the worn purse into the pack, all of them', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const purse = inv.purse!;
    const inPurse = coinsIn(purse);
    expect(inPurse).toBeGreaterThan(0);
    const inPack = coinsIn(inv.primaryPack);

    const result = takeAll(engine, purse);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.message).toContain('(stored in pack)');
    expect(coinsIn(purse)).toBe(0);
    expect(coinsIn(inv.primaryPack)).toBe(inPack + inPurse);
  });

  it('moves an essence from the worn rune pouch into the pack', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const pouch = inv.paperdoll.getItem('runes') as Container;
    const essence = make('essence_isa');
    expect(inv.storeItem(essence).destination).toBe('runes');

    const result = takeAll(engine, pouch);

    expect(result.success).toBe(true);
    expect(result.message).toContain('(stored in pack)');
    expect(pouch.getItem(essence.id)).toBeNull();
    expect(inv.primaryPack.getItem(essence.id)).toBe(essence);
  });

  it('with no room in the pack, fails at no cost, says why, and leaves every item in the container', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const belt = inv.belt!;
    const held = belt.getItems().map((i) => [i, i.quantity] as const);
    expect(held.length).toBeGreaterThan(0);
    fillPack(engine);
    const energy = engine.player.energy;

    const result = takeAll(engine, belt);

    expect(result).toMatchObject({ success: false, cost: 0 });
    expect(result.message).toMatch(/^Could not loot from .+: .+/);
    expect(result.message).not.toContain('Looted');
    expect(engine.messages.at(-1)).toBe(result.message);
    expect(engine.player.energy).toBe(energy);
    expect(belt.getItems()).toHaveLength(held.length);
    for (const [item, quantity] of held) {
      expect(belt.getItem(item.id)).toBe(item);
      expect(item.quantity).toBe(quantity);
    }
  });

  it('from the worn pack itself, refuses at no cost and moves nothing', () => {
    const engine = newHero();
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(make('essence_isa'));
    const held = pack.getItems().map((i) => [i, i.quantity] as const);
    const energy = engine.player.energy;

    const result = takeAll(engine, pack);

    expect(result).toMatchObject({ success: false, cost: 0 });
    expect(result.message).toMatch(/already in your pack/);
    expect(result.message).not.toContain('Looted');
    expect(engine.messages.at(-1)).toBe(result.message);
    expect(engine.player.energy).toBe(energy);
    expect(pack.getItems()).toHaveLength(held.length);
    for (const [item, quantity] of held) {
      expect(pack.getItem(item.id)).toBe(item);
      expect(item.quantity).toBe(quantity);
    }
  });
});

describe('taking an item out of a chest on the ground', () => {
  const chestHolding = (engine: GameEngine, ...items: Item[]) => {
    const chest = new Container({
      id: 'b1-chest',
      name: 'Chest',
      category: 'container',
      containerType: 'chest',
      weight: 5000,
      bulk: 30000,
      maxWeightCapacity: 50000,
      maxBulkCapacity: 30000,
    });
    for (const item of items) chest.addItem(item);
    engine.map.addItemAt(engine.player.x, engine.player.y, chest);
    return chest;
  };

  it('still prefers the belt, the purse and the rune pouch', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const belt = inv.belt!;
    // Free one belt loop, so the belt has room as it would for a hero who drank a draught.
    const loose = belt.getItems()[0];
    belt.removeItem(loose.id);
    inv.primaryPack.addItem(loose);
    const scroll = make('scroll_phase_door');
    const coins = new CoinItem({ id: 'b1-coins', denomination: 'silver', count: 5 });
    const essence = make('essence_berkano');
    const chest = chestHolding(engine, scroll, coins, essence);

    expect(take(engine, chest, scroll).message).toContain('(stored in belt)');
    expect(take(engine, chest, coins).message).toContain('(stored in purse)');
    expect(take(engine, chest, essence).message).toContain('(stored in runes)');
    expect(belt.getItem(scroll.id)).toBe(scroll);
    expect((inv.paperdoll.getItem('runes') as Container).getItem(essence.id)).toBe(essence);
    expect(coinsIn(inv.purse)).toBeGreaterThanOrEqual(5);
  });

  it('Take all still prefers the belt, the purse and the rune pouch, and says where each went', () => {
    const engine = newHero();
    const inv = engine.player.inventory;
    const belt = inv.belt!;
    const loose = belt.getItems()[0];
    belt.removeItem(loose.id);
    inv.primaryPack.addItem(loose);
    const scroll = make('scroll_phase_door');
    const coins = new CoinItem({ id: 'b1-coins', denomination: 'silver', count: 5 });
    const essence = make('essence_berkano');
    const chest = chestHolding(engine, scroll, coins, essence);
    const inPurse = coinsIn(inv.purse);

    const result = takeAll(engine, chest);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Looted 3 items from Chest');
    expect(result.message).toContain('(stored in belt, purse, runes)');
    expect(chest.getItems()).toHaveLength(0);
    expect(belt.getItem(scroll.id)).toBe(scroll);
    expect((inv.paperdoll.getItem('runes') as Container).getItem(essence.id)).toBe(essence);
    expect(coinsIn(inv.purse)).toBe(inPurse + 5);
  });
});
