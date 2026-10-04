import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp, getPlayerCurrencyBreakdown } from '../currency';
import { TempleService, SageService, BankService } from '../services';

describe('Town Services (Temple, Sage, Bank)', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({
      id: 'service-hero',
      name: 'Rolf',
      position: { x: 5, y: 5 },
      stats: { hp: 10, maxHp: 35, attack: 10, defense: 5 },
      mana: 5,
      maxMana: 30,
      strength: 15,
    });
    const purse = ItemFactory.createCoinPurse('rolf-purse');
    player.inventory.paperdoll.equip(purse, 'purse');
  });

  describe('Temple of Thor', () => {
    it('cleanses curses from equipped equipment for 50 GP', () => {
      // Equip cursed armor
      const cursedArmor = ItemFactory.createLeatherArmor('curse-armor');
      cursedArmor.quality = 'cursed';
      player.inventory.primaryPack.addItem(cursedArmor);
      player.inventory.equipFromPack('curse-armor');

      // Player funds: 50 GP (5,000 CP)
      addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 50, platinum: 0 });

      const result = TempleService.cleanseCurses(player);
      expect(result.success).toBe(true);
      expect(result.message).toContain('shatters the foul bindings');
      expect(cursedArmor.quality).toBe('normal');
      expect(getPlayerTotalCp(player)).toBe(0);

      // Armor was cleansed and placed safely in pack
      expect(player.inventory.paperdoll.getItem('torso')).toBeNull();
      expect(player.inventory.primaryPack.getItem('curse-armor')).toBeDefined();
    });

    it('leaves a cleansed item worn, free of its curse, when the pack has no room for it', () => {
      const cursedArmor = ItemFactory.createLeatherArmor('curse-armor');
      cursedArmor.quality = 'cursed';
      player.inventory.primaryPack.addItem(cursedArmor);
      player.inventory.equipFromPack('curse-armor');
      for (let i = 0; i < 500; i++) {
        if (!player.inventory.primaryPack.addItem(ItemFactory.createLeatherArmor(`filler-${i}`))) break;
      }
      expect(player.inventory.primaryPack.canContain(cursedArmor).allowed).toBe(false);
      addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 50, platinum: 0 });

      const result = TempleService.cleanseCurses(player);

      expect(result.success).toBe(true);
      expect(cursedArmor.quality).toBe('normal');
      expect(player.inventory.paperdoll.getItem('torso')).toBe(cursedArmor);
      expect(result.message).not.toContain('stored in your pack');
      expect(result.message).toContain('Leather Armor');
    });

    it('heals and restores HP/Mana and removes negative status effects for 25 GP', () => {
      // Apply poison and slow
      player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 2 });
      player.statusManager.applyStatus({ type: 'slow', duration: 4 });

      // Player funds: 30 GP
      addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 30, platinum: 0 });

      const result = TempleService.healAndRestore(player);
      expect(result.success).toBe(true);
      expect(result.message).toContain('bathes you in healing light');

      // Restored to max
      expect(player.hp).toBe(player.maxHp);
      expect(player.mana).toBe(player.maxMana);
      expect(player.statusManager.hasStatus('poison')).toBe(false);
      expect(player.statusManager.hasStatus('slow')).toBe(false);

      // Remaining funds: 30 - 25 = 5 GP (500 CP)
      expect(getPlayerTotalCp(player)).toBe(500);
    });
  });

  describe('Sage Mimir (Identification)', () => {
    it('identifies unknown magical items for 20 GP', () => {
      const mysteriousWand = ItemFactory.createWandOfLightning('mystery-wand');
      mysteriousWand.identified = false;
      player.inventory.primaryPack.addItem(mysteriousWand);

      // Player funds: 20 GP (2000 CP)
      addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 20, platinum: 0 });

      const result = SageService.identifyItem(player, mysteriousWand.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('traces the hidden runes');
      expect(mysteriousWand.identified).toBe(true);
      expect(getPlayerTotalCp(player)).toBe(0);
    });

    it('rejects identification if item is already identified or funds are lacking', () => {
      const knownDagger = ItemFactory.createDagger('known-dagger');
      knownDagger.identified = true;
      player.inventory.primaryPack.addItem(knownDagger);

      addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 20, platinum: 0 });

      const result = SageService.identifyItem(player, knownDagger.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('already identified');
      expect(getPlayerTotalCp(player)).toBe(2000); // No fee charged
    });
  });

  describe('Bank of Bjarnarhaven (Coin Compaction)', () => {
    it('exchanges many low-value coins for the fewest of the same worth, at zero fee', () => {
      // Player carries 500 Copper and 60 Silver: 560 coins
      addCurrencyToPlayer(player, { copper: 500, silver: 60, gold: 0, platinum: 0 });
      // Total value: 500 CP + 600 CP = 1100 CP
      expect(getPlayerTotalCp(player)).toBe(1100);

      const result = BankService.compactCurrency(player);
      expect(result.success).toBe(true);
      expect(result.message).toContain('560 coins for 2');

      // Value strictly preserved
      expect(getPlayerTotalCp(player)).toBe(1100);

      // Optimal denomination: 1 Platinum (1000 CP), 1 Gold (100 CP) = 2 coins total!
      const breakdown = getPlayerCurrencyBreakdown(player);
      expect(breakdown).toEqual({
        platinum: 1,
        gold: 1,
        silver: 0,
        copper: 0,
      });

      // 560 coins become 2.
      expect(result.coinsSaved).toBe(558);
    });
  });
});
