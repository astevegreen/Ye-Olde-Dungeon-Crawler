import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import {
  Merchant,
  getItemBuyPrice,
  getItemSellPrice,
} from '../merchant';
import {
  COTW_TOWN,
  createOlafGeneralStore,
  createGuntherArmory,
} from '../../../content/cotw/town';
import { cotwManifest } from '../../../content/cotw';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { serializeGame, deserializeGame } from '../../storage/serializer';

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
    const price = olaf.buyPrice(brothItem);

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

  it('offers the same mystery price for every unidentified item that looks alike, whatever it hides (Q21)', () => {
    // Base sell 7500 CP * 0.25 = 1875 CP, for the plain, the blessed and the hexed alike.
    const plainSword = ItemFactory.createBroadsword('plain-sword');
    plainSword.identified = false;
    expect(getItemSellPrice(plainSword)).toBe(1875);

    const blessedSword = ItemFactory.createBroadsword('blessed-sword');
    blessedSword.identified = false;
    blessedSword.modifiers = [{ id: 'blessed-test', name: 'Blessed', alignment: 'positive', category: 'blessed' }];
    expect(getItemSellPrice(blessedSword)).toBe(1875);

    const hexedSword = ItemFactory.createBroadsword('hexed-sword');
    hexedSword.identified = false;
    hexedSword.modifiers = [{ id: 'hexed-test', name: 'Hexed', alignment: 'negative', category: 'hexed', binds: true }];
    expect(getItemSellPrice(hexedSword)).toBe(1875);

    // Nor does a hidden +N show in the price: the appraisal is of the plain item.
    const plusThree = ItemFactory.createBroadsword('plus-sword');
    plusThree.identified = false;
    plusThree.enchantmentLevel = 3;
    plusThree.value = Math.round(15000 * 2.2);
    expect(getItemSellPrice(plusThree)).toBe(1875);

    // Identified, the family and the +N both count.
    blessedSword.identified = true;
    expect(getItemSellPrice(blessedSword)).toBe(11250);
    hexedSword.identified = true;
    expect(getItemSellPrice(hexedSword)).toBe(750);
    plusThree.identified = true;
    expect(getItemSellPrice(plusThree)).toBe(16500);
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

  describe('each merchant’s declared ratios set its prices (markupRatio, markdownRatio)', () => {
    const astridConfig = () => COTW_TOWN.npcs.find((n) => n.id === 'npc-astrid')!.merchantConfig!;
    const sword = (id: string, identified = true) => {
      const s = ItemFactory.createBroadsword(id); // 15000 CP
      s.identified = identified;
      return s;
    };

    it('a merchant that declares none prices as before: the value to buy, half of it to sell', () => {
      const plain = new Merchant('m', 'M', 'M', 'general', 'Hello.', []);
      expect(plain.buyPrice(sword('a'))).toBe(15000);
      expect(plain.sellPrice(sword('b'))).toBe(7500);
      expect(plain.sellPrice(sword('c', false))).toBe(1875);
    });

    it('cotw: Olaf sells at x1.25 and buys at half; Astrid sells at x1.35 and buys at x0.45', () => {
      const olaf = createOlafGeneralStore();
      const cfg = astridConfig();
      const astrid = new Merchant(cfg.id, cfg.name, cfg.name, 'general', cfg.greeting, cfg.initialInventory(), cfg);
      expect(olaf.buyPrice(sword('a'))).toBe(18750);
      expect(olaf.sellPrice(sword('b'))).toBe(7500);
      expect(astrid.buyPrice(sword('c'))).toBe(20250);
      expect(astrid.sellPrice(sword('d'))).toBe(6750);
      expect(astrid.sellPrice(sword('e', false))).toBe(Math.floor(6750 * 0.25));
      const broth = olaf.stock.find((i) => i.id === 'olaf-broth-1')!;
      expect(olaf.buyPrice(broth)).toBe(Math.floor(broth.value * 1.25));
    });

    it('charges what it asks and pays what it offers', () => {
      const olaf = createOlafGeneralStore();
      addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 5 });
      const broth = olaf.stock.find((i) => i.id === 'olaf-broth-1')!;
      const asked = olaf.buyPrice(broth);
      expect(asked).toBeGreaterThan(broth.value);
      expect(olaf.buyItem(player, broth.id).costInCp).toBe(asked);
      expect(getPlayerTotalCp(player)).toBe(500 - asked);

      const cfg = astridConfig();
      const astrid = new Merchant(cfg.id, cfg.name, cfg.name, 'general', cfg.greeting, [], cfg);
      const dagger = ItemFactory.createDagger('astrid-dagger');
      dagger.identified = true;
      player.inventory.primaryPack.addItem(dagger);
      const offered = astrid.sellPrice(dagger);
      expect(offered).toBe(Math.floor(dagger.value * 0.45));
      expect(astrid.sellItem(player, dagger.id).costInCp).toBe(offered);
      expect(getPlayerTotalCp(player)).toBe(500 - asked + offered);
    });

    it('the town the engine builds, and a load, give each merchant the ratios its pack declares', () => {
      const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Haggler', { seed: 8 });
      const ratios = (e: typeof engine) => Object.fromEntries([...e.merchants.values()].map((m) => [m.id, [m.markupRatio, m.markdownRatio]]));
      expect(ratios(engine)).toEqual({ 'merchant-olaf': [1.25, 0.5], 'merchant-gunther': [1.3, 0.5], 'merchant-astrid': [1.35, 0.45] });
      const { engine: loaded } = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest);
      expect(ratios(loaded)).toEqual(ratios(engine));
    });
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
