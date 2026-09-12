import { describe, it, expect, beforeEach } from 'vitest';
import { ItemInspector } from '../inventory/itemInspector';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';
import { Item } from '../../engine';
import { Container } from '../../engine';
import { PotionItem, ScrollItem, WandItem } from '../../engine';
import { EncumbranceLevel } from '../../engine';

describe('ItemInspector Stationary Pane & State Presenter', () => {
  let engine: GameEngine;
  let inspector: ItemInspector;

  beforeEach(() => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({
      id: 'test-player',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
    });
    engine = new GameEngine({ map, player });
    inspector = new ItemInspector();
  });

  describe('Unselected State & Player Aggregate Stats', () => {
    it('initializes in unselected state with default paperdoll panel focus', () => {
      expect(inspector.selectedItem).toBeNull();
      expect(inspector.selectedSource).toBe('none');
      expect(inspector.focusedPanel).toBe('paperdoll');
      expect(inspector.focusedIndex).toBe(0);
    });

    it('computes complete player aggregate stats when no item is selected', () => {
      const p = engine.player;
      const stats = inspector.getAggregateStats(p);

      expect(stats.name).toBe(p.name);
      expect(stats.level).toBe(p.level);
      expect(stats.hp).toBe(p.hp);
      expect(stats.maxHp).toBe(p.maxHp);
      expect(stats.mana).toBe(p.mana);
      expect(stats.maxMana).toBe(p.maxMana);
      expect(stats.strength).toBe(p.strength);
      expect(stats.intelligence).toBe(p.intelligence);
      expect(stats.constitution).toBe(p.constitution);
      expect(stats.dexterity).toBe(p.dexterity);
      expect(stats.totalAttack).toBe(p.attack);
      expect(stats.totalDefense).toBe(p.defense);
      expect(stats.encumbranceLevel).toBe(EncumbranceLevel.Unencumbered);
      expect(stats.maxCarryWeight).toBe(p.strength * 2500);
      expect(stats.maxPackBulk).toBe(p.inventory.primaryPack.maxBulkCapacity);
    });

    it('accurately factors equipped gear bonuses into base vs gear attack/defense values', () => {
      const p = engine.player;
      const sword = new Item({
        id: 'iron-sword',
        name: 'Iron Sword',
        category: 'weapon',
        weight: 1200,
        bulk: 600,
        stats: { attackBonus: 5 },
      });
      const shield = new Item({
        id: 'iron-shield',
        name: 'Iron Shield',
        category: 'shield',
        weight: 1500,
        bulk: 800,
        stats: { defenseBonus: 3 },
      });

      p.inventory.paperdoll.equip(sword, 'mainHand');
      p.inventory.paperdoll.equip(shield, 'offHand');

      const stats = inspector.getAggregateStats(p);
      expect(stats.equipmentAttackBonus).toBe(5);
      expect(stats.equipmentDefenseBonus).toBe(3);
      expect(stats.baseAttack).toBe(p.attack - 5);
      expect(stats.baseDefense).toBe(p.defense - 3);
    });
  });

  describe('Item Breakdown Generation', () => {
    it('generates item breakdown for regular items with slot compatibility', () => {
      const helm = new Item({
        id: 'steel-helm',
        name: 'Steel Helm',
        category: 'helmet',
        weight: 900,
        bulk: 500,
        stats: { defenseBonus: 4 },
        description: 'Forged from tempered northern steel.',
        identified: true,
      });

      const breakdown = inspector.getItemBreakdown(helm, 'backpack', undefined, engine.player.inventory.paperdoll);
      expect(breakdown.displayName).toBe('Steel Helm');
      expect(breakdown.category).toBe('helmet');
      expect(breakdown.isEnchanted).toBe(false);
      expect(breakdown.isCursed).toBe(false);
      expect(breakdown.stats.defenseBonus).toBe(4);
      expect(breakdown.description).toBe('Forged from tempered northern steel.');
      expect(breakdown.slotCompatibility).toContain('Head');
    });

    it('identifies enchanted items with tier, enchantment level, and elemental affixes', () => {
      const fireBlade = new Item({
        id: 'flame-blade',
        name: 'Flame Blade',
        category: 'weapon',
        weight: 1100,
        bulk: 400,
        tier: 3,
        quality: 'enchanted',
        enchantmentLevel: 2,
        elementalAffix: { element: 'fire', bonusDamage: 6, name: 'of Embers' },
        stats: { attackBonus: 8 },
        identified: true,
      });

      const breakdown = inspector.getItemBreakdown(fireBlade, 'backpack', undefined, engine.player.inventory.paperdoll);
      expect(breakdown.isEnchanted).toBe(true);
      expect(breakdown.enchantmentLevel).toBe(2);
      expect(breakdown.tier).toBe(3);
      expect(breakdown.elementalAffix?.element).toBe('fire');
      expect(breakdown.elementalAffix?.bonusDamage).toBe(6);
    });

    it('identifies cursed items properly when identified', () => {
      const cursedRing = new Item({
        id: 'cursed-band',
        name: 'Iron Band',
        category: 'ring',
        weight: 50,
        bulk: 20,
        quality: 'cursed',
        identified: true,
      });

      const breakdown = inspector.getItemBreakdown(cursedRing, 'paperdoll', 'fingerLeft');
      expect(breakdown.isCursed).toBe(true);
      expect(breakdown.displayName).toContain('Cursed');
    });
  });

  describe('Context-Sensitive Action Determination', () => {
    it('offers [Equip] and [Drop] for equippable items in backpack', () => {
      const armor = new Item({
        id: 'chain-mail',
        name: 'Chain Mail',
        category: 'armor',
        weight: 5000,
        bulk: 2000,
      });
      engine.player.inventory.primaryPack.addItem(armor);

      inspector.select(armor, 'backpack');
      const actions = inspector.getAvailableActions(engine);

      const actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain('equip');
      expect(actionIds).toContain('drop');
      expect(actionIds).not.toContain('take');
      expect(actionIds).not.toContain('unequip');
    });

    it('offers [Unequip] and [Drop] for items equipped in paperdoll', () => {
      const sword = new Item({
        id: 'arming-sword',
        name: 'Arming Sword',
        category: 'weapon',
        weight: 1200,
        bulk: 500,
      });
      engine.player.inventory.paperdoll.equip(sword, 'mainHand');

      inspector.select(sword, 'paperdoll', 'mainHand');
      const actions = inspector.getAvailableActions(engine);

      const actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain('unequip');
      expect(actionIds).toContain('drop');
      expect(actionIds).not.toContain('equip');
    });

    it('disables unequip/drop for cursed items in paperdoll', () => {
      const cursedSword = new Item({
        id: 'blood-blade',
        name: 'Blood Blade',
        category: 'weapon',
        weight: 1200,
        bulk: 500,
        quality: 'cursed',
      });
      engine.player.inventory.paperdoll.equip(cursedSword, 'mainHand');

      inspector.select(cursedSword, 'paperdoll', 'mainHand');
      const actions = inspector.getAvailableActions(engine);

      const unequipAction = actions.find((a) => a.id === 'unequip');
      expect(unequipAction?.enabled).toBe(false);
      expect(unequipAction?.reason).toContain('cursed');
    });

    it('offers [Drink] for potions in backpack', () => {
      const potion = new PotionItem({
        id: 'heal-pot',
        name: 'Potion of Minor Healing',
        potionType: 'health',
        potency: 25,
        weight: 300,
        bulk: 150,
      });
      engine.player.inventory.primaryPack.addItem(potion);

      inspector.select(potion, 'backpack');
      const actions = inspector.getAvailableActions(engine);

      const useAction = actions.find((a) => a.id === 'use');
      expect(useAction).toBeDefined();
      expect(useAction?.label).toContain('Drink');
      expect(useAction?.shortcut).toBe('U');
    });

    it('offers [Read] for scrolls in backpack', () => {
      const scroll = new ScrollItem({
        id: 'scroll-teleport',
        name: 'Scroll of Phase Door',
        spellId: 'phase_door',
        weight: 50,
        bulk: 40,
      });
      engine.player.inventory.primaryPack.addItem(scroll);

      inspector.select(scroll, 'backpack');
      const actions = inspector.getAvailableActions(engine);

      const useAction = actions.find((a) => a.id === 'use');
      expect(useAction).toBeDefined();
      expect(useAction?.label).toContain('Read');
    });

    it('offers [Zap] for wands in backpack with charges', () => {
      const wand = new WandItem({
        id: 'wand-magic-missile',
        name: 'Wand of Magic Missile',
        spellId: 'magic_missile',
        charges: 5,
        weight: 200,
        bulk: 100,
      });
      engine.player.inventory.primaryPack.addItem(wand);

      inspector.select(wand, 'backpack');
      const actions = inspector.getAvailableActions(engine);

      const useAction = actions.find((a) => a.id === 'use');
      expect(useAction).toBeDefined();
      expect(useAction?.label).toContain('Zap');
      expect(useAction?.enabled).toBe(true);
    });

    it('offers [Take] for items on ground and [Open] for ground chests', () => {
      const groundItem = new Item({
        id: 'loose-dagger',
        name: 'Iron Dagger',
        category: 'weapon',
        weight: 400,
        bulk: 200,
      });
      inspector.select(groundItem, 'ground');
      let actions = inspector.getAvailableActions(engine);
      expect(actions.some((a) => a.id === 'take')).toBe(true);

      const chest = new Container({
        id: 'iron-chest',
        name: 'Iron Chest',
        category: 'container',
        containerType: 'chest',
        maxWeightCapacity: 50000,
        maxBulkCapacity: 30000,
        weight: 8000,
        bulk: 30000,
      });
      inspector.select(chest, 'ground');
      actions = inspector.getAvailableActions(engine);
      expect(actions.some((a) => a.id === 'peek')).toBe(true);
    });

    it('offers [Put] when ground container is open and backpack item is selected', () => {
      const chest = new Container({
        id: 'open-chest',
        name: 'Wooden Chest',
        category: 'container',
        containerType: 'chest',
        maxWeightCapacity: 50000,
        maxBulkCapacity: 30000,
        weight: 5000,
        bulk: 20000,
      });
      inspector.selectedContainer = chest;

      const gem = new Item({
        id: 'ruby',
        name: 'Ruby',
        category: 'misc',
        weight: 100,
        bulk: 50,
      });
      inspector.select(gem, 'backpack');

      const actions = inspector.getAvailableActions(engine);
      const putAction = actions.find((a) => a.id === 'put');
      expect(putAction).toBeDefined();
      expect(putAction?.enabled).toBe(true);
    });
  });

  describe('Focus & Panel Navigation', () => {
    it('cycles focus panel forward and backward through all 4 panels', () => {
      expect(inspector.focusedPanel).toBe('paperdoll');

      inspector.cyclePanel(true);
      expect(inspector.focusedPanel).toBe('backpack');

      inspector.cyclePanel(true);
      expect(inspector.focusedPanel).toBe('ground');

      inspector.cyclePanel(true);
      expect(inspector.focusedPanel).toBe('inspector');

      inspector.cyclePanel(true);
      expect(inspector.focusedPanel).toBe('paperdoll');

      inspector.cyclePanel(false);
      expect(inspector.focusedPanel).toBe('inspector');
    });

    it('executes primary action when executePrimaryAction() is called', () => {
      const p = engine.player;
      const potion = new PotionItem({
        id: 'pot-test',
        name: 'Healing Draught',
        potionType: 'health',
        potency: 20,
        weight: 300,
        bulk: 150,
      });
      p.hp = 10;
      p.inventory.primaryPack.addItem(potion);

      inspector.select(potion, 'backpack');
      const executed = inspector.executePrimaryAction(engine);

      expect(executed).toBe(true);
      expect(p.hp).toBe(30); // 10 + 20
      expect(inspector.selectedItem).toBeNull(); // selection cleared after execution
    });
  });
});
