import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import {
  getItemBuyPrice,
  getItemSellPrice,
} from '../merchant';
import {
  createOlafGeneralStore,
  createGuntherArmory,
} from '../../../content/cotw/town';

describe('Merchant Economy & Trading Engine', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({
      id: 'trader-hero',
      name: 'Freya',
      position: { x: 5, y: 5 },
      stats: { hp: 35, maxHp: 35, attack: 10, defense: 5 },
      strength: 15,
    });
    const purse = ItemFactory.createCoinPurse('freya-purse');
    player.inventory.paperdoll.equip(purse, 'purse');
  });

  it('calculates dynamic pricing modifiers for buying and selling', () => {
    const normalSword = ItemFactory.createBroadsword('test-sword'); // Steel Broadsword: base 15000 CP
    normalSword.identified = true;
    expect(getItemBuyPrice(normalSword)).toBe(15000);
    // Base sell is 50% = 7500 CP
    expect(getItemSellPrice(normalSword)).toBe(7500);

    // Unidentified item suffers 75% valuation penalty
    const unIdSword = ItemFactory.createBroadsword('unid-sword');
    unIdSword.identified = false;
    // 7500 * 0.25 = 1875 CP
    expect(getItemSellPrice(unIdSword)).toBe(1875);

    // A positive family receives a 50% valuation bonus
    const enchantedSword = ItemFactory.createBroadsword('ench-sword');
    enchantedSword.identified = true;
    enchantedSword.modifiers = [{ id: 'e', name: 'Enchanted', alignment: 'positive', category: 'enchanted' }];
    // 7500 * 1.5 = 11250 CP
    expect(getItemSellPrice(enchantedSword)).toBe(11250);

    // A negative family suffers a 90% valuation penalty
    const cursedSword = ItemFactory.createBroadsword('cursed-sword');
    cursedSword.identified = true;
    cursedSword.modifiers = [{ id: 'c', name: 'Cursed', alignment: 'negative', category: 'cursed', binds: true }];
    // 7500 * 0.10 = 750 CP
    expect(getItemSellPrice(cursedSword)).toBe(750);
  });

  it('allows player to purchase items if they have sufficient currency and pack capacity', () => {
    const olaf = createOlafGeneralStore();
    // Give player 5 Gold (500 CP)
    addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 5 });

    const brothItem = olaf.stock.find((i) => i.id === 'olaf-broth-1');
    expect(brothItem).toBeDefined();
    if (!brothItem) return;

    const initialStockCount = olaf.stock.length;
    const price = getItemBuyPrice(brothItem);

    const result = olaf.buyItem(player, brothItem.id);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Purchased Hearth-Broth Flask');

    // Player funds deducted by exactly the listed price
    expect(getPlayerTotalCp(player)).toBe(500 - price);

    // Item placed in player primary pack
    const purchasedItem = player.inventory.primaryPack.getItem(brothItem.id);
    expect(purchasedItem).toBeDefined();
    expect(purchasedItem?.name).toBe('Hearth-Broth Flask');

    // Merchant stock decremented
    expect(olaf.stock.length).toBe(initialStockCount - 1);
  });

  it('rejects purchase if player does not have enough funds', () => {
    const gunther = createGuntherArmory();
    // Player has 10 CP
    addCurrencyToPlayer(player, { copper: 10, silver: 0, gold: 0 });

    const swordItem = gunther.stock.find((i) => i.name.includes('Broadsword'));
    expect(swordItem).toBeDefined();
    if (!swordItem) return;

    const result = gunther.buyItem(player, swordItem.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot afford');
    expect(getPlayerTotalCp(player)).toBe(10);
  });

  it('allows player to sell items from inventory to merchant', () => {
    const gunther = createGuntherArmory();
    // Seed dagger into player pack
    const dagger = ItemFactory.createDagger('seller-dagger'); // Iron Dagger: base 2000 CP -> sell 1000 CP
    player.inventory.primaryPack.addItem(dagger);

    expect(getPlayerTotalCp(player)).toBe(0);

    const result = gunther.sellItem(player, dagger.id);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Sold Iron Dagger');

    // Item removed from player inventory
    expect(player.inventory.primaryPack.getItem('seller-dagger')).toBeNull();

    // Player received 1000 CP in optimal change (1 PP)
    expect(getPlayerTotalCp(player)).toBe(1000);
  });

  it('pays a windfall for an unidentified item that turns out blessed, and scrap for one that turns out cursed', () => {
    const blessedSword = ItemFactory.createBroadsword('blessed-sword');
    blessedSword.identified = false;
    blessedSword.modifiers = [
      {
        id: 'blessed-test',
        name: 'Blessed',
        alignment: 'positive',
        category: 'blessed',
      },
    ];
    // Base sell 7500 CP * 2.0 windfall = 15000 CP
    expect(getItemSellPrice(blessedSword)).toBe(15000);

    const hexedSword = ItemFactory.createBroadsword('hexed-sword');
    hexedSword.identified = false;
    hexedSword.modifiers = [
      {
        id: 'hexed-test',
        name: 'Hexed',
        alignment: 'negative',
        category: 'hexed',
      },
    ];
    // Base sell 7500 CP * 0.1 scrap = 750 CP
    expect(getItemSellPrice(hexedSword)).toBe(750);

    // A plain unidentified item (no hidden attribute either way) keeps the ordinary penalty
    const plainSword = ItemFactory.createBroadsword('plain-sword');
    plainSword.identified = false;
    expect(getItemSellPrice(plainSword)).toBe(1875);
  });

  it('identifies an item once it is sold, so it shows its true color scheme in shop stock', () => {
    const gunther = createGuntherArmory();
    const blessedDagger = ItemFactory.createDagger('blessed-dagger');
    blessedDagger.identified = false;
    blessedDagger.modifiers = [
      { id: 'blessed-test', name: 'Blessed', alignment: 'positive', category: 'blessed' },
    ];
    player.inventory.primaryPack.addItem(blessedDagger);

    const result = gunther.sellItem(player, 'blessed-dagger');
    expect(result.success).toBe(true);

    const soldItem = gunther.stock.find((i) => i.id === 'blessed-dagger');
    expect(soldItem).toBeDefined();
    expect(soldItem?.identified).toBe(true);
  });

  it('rejects selling cursed equipment that is currently bound to player paperdoll', () => {
    const gunther = createGuntherArmory();
    const cursedSword = ItemFactory.createBroadsword('cursed-sword');
    cursedSword.modifiers = [{ id: 'c', name: 'Cursed', alignment: 'negative', category: 'cursed', binds: true }];
    cursedSword.identified = true;

    player.inventory.primaryPack.addItem(cursedSword);
    player.inventory.equipFromPack('cursed-sword');

    // Attempting to sell bound cursed weapon fails
    const result = gunther.sellItem(player, 'cursed-sword');
    expect(result.success).toBe(false);
    expect(result.message).toContain('cursed and bound to your body');
  });
});
