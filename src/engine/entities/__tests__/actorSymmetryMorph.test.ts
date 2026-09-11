import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Actor } from '../actor';
import { Monster } from '../monster';
import { Player } from '../player';
import { Item } from '../../items/item';
import { PotionItem, WandItem } from '../../items/consumables';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { MonsterAI } from '../../ai/behaviorTree';
import { DrinkPotionAction, ZapWandAction } from '../../actions/spell-actions';
import { registerSpell, SPELL_REGISTRY } from '../../magic/spellRegistry';

describe('Symmetrical Actor Parity & Morph Envelope (actor.ts, monster.ts)', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    registerSpell({
      id: 'firebolt',
      name: 'Firebolt',
      school: 'Combat',
      manaCost: 5,
      element: 'fire',
      range: 7,
      basePower: 12,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'ray',
      targetingMode: 'ray',
      description: '',
      effects: [{ type: 'damage', amount: 12, element: 'fire' }],
    });
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'test-hero',
      name: 'Test Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    engine = new GameEngine({ map, player });
  });

  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) delete SPELL_REGISTRY[key];
  });

  describe('Universal Inventory & Equipment Parity', () => {
    it('allows a monster to add, check, and remove items via IItemContainer', () => {
      const monster = new Monster({
        id: 'goblin-scout',
        name: 'Goblin Scout',
        position: { x: 6, y: 5 },
        stats: { hp: 15, maxHp: 15, attack: 4, defense: 1 },
      });

      const dagger = new Item({
        id: 'iron-dagger',
        name: 'Iron Dagger',
        category: 'weapon',
        weight: 300,
        bulk: 100,
        slot: 'mainHand',
      });

      // Initially empty
      expect(monster.hasItem('iron-dagger')).toBe(false);
      expect(monster.getItems().length).toBe(0);

      // Add item
      const added = monster.addItem(dagger);
      expect(added).toBe(true);
      expect(monster.hasItem('iron-dagger')).toBe(true);
      expect(monster.getItems().length).toBe(1);

      // Remove item
      const removed = monster.removeItem('iron-dagger');
      expect(removed).toBe(dagger);
      expect(monster.hasItem('iron-dagger')).toBe(false);
      expect(monster.getItems().length).toBe(0);
    });

    it('allows a monster to equip gear via IEquipmentBearer and track paperdoll stats', () => {
      const orc = new Monster({
        id: 'orc-warrior',
        name: 'Orc Warrior',
        position: { x: 6, y: 5 },
        stats: { hp: 30, maxHp: 30, attack: 8, defense: 3 },
      });

      const shield = new Item({
        id: 'tower-shield',
        name: 'Tower Shield',
        category: 'shield',
        slot: 'offHand',
        weight: 1500,
        bulk: 800,
        stats: { defenseBonus: 4 },
      });

      orc.addItem(shield);
      const equipped = orc.equipItem(shield, 'offHand');
      expect(equipped).toBe(true);
      expect(orc.getEquippedItem('offHand')).toBe(shield);

      // Stat check via paperdoll
      const stats = orc.inventory.getEquipmentStats();
      expect(stats.defenseBonus).toBe(4);

      // Unequip
      const unequipped = orc.unequipItem('offHand');
      expect(unequipped).toBe(shield);
      expect(orc.getEquippedItem('offHand')).toBeNull();
    });
  });

  describe('Shape-Shifting & Morph Envelope', () => {
    it('snapshots original stats and applies morph envelope stats', () => {
      const actor = new Actor({
        id: 'shifter',
        name: 'Novice Shifter',
        type: 'monster',
        faction: 'neutral',
        position: { x: 3, y: 3 },
        stats: { hp: 25, maxHp: 25, attack: 5, defense: 2 },
        speed: 100,
      });

      actor.applyMorph('dire-bear', 10, {
        name: 'Dire Bear',
        hp: 60,
        maxHp: 60,
        attack: 14,
        defense: 6,
        speed: 80,
      });

      expect(actor.morphEnvelope).toBeDefined();
      expect(actor.name).toBe('Dire Bear');
      expect(actor.hp).toBe(60);
      expect(actor.maxHp).toBe(60);
      expect(actor.attack).toBe(14);
      expect(actor.defense).toBe(6);
      expect(actor.speed).toBe(80);

      // Original archetype saved in envelope
      expect(actor.morphEnvelope?.originalName).toBe('Novice Shifter');
      expect(actor.morphEnvelope?.originalStats.hp).toBe(25);
    });

    it('reverts morph automatically when remainingTicks reaches zero', () => {
      const actor = new Actor({
        id: 'shifter-timer',
        name: 'Druid',
        type: 'monster',
        faction: 'neutral',
        position: { x: 3, y: 3 },
        stats: { hp: 20, maxHp: 20, attack: 4, defense: 1 },
      });

      actor.applyMorph('hawk', 3, { name: 'Giant Hawk', speed: 150 });
      expect(actor.name).toBe('Giant Hawk');

      actor.tickMorph(1);
      expect(actor.morphEnvelope?.remainingTicks).toBe(2);
      expect(actor.name).toBe('Giant Hawk');

      actor.tickMorph(2);
      expect(actor.morphEnvelope).toBeUndefined();
      expect(actor.name).toBe('Druid');
    });

    it('absorbs damage in morph and spills fatal excess damage into original HP', () => {
      const actor = new Actor({
        id: 'wildshaper',
        name: 'Archdruid',
        type: 'player',
        faction: 'player',
        position: { x: 5, y: 5 },
        stats: { hp: 40, maxHp: 40, attack: 6, defense: 2 },
      });

      // Morph into wolf with 20 temporary HP
      actor.applyMorph('winter-wolf', 10, { hp: 20, maxHp: 20, attack: 10 }, true);
      expect(actor.hp).toBe(20);

      // Non-fatal hit to morph form
      const hit1 = actor.takeDamage(12);
      expect(hit1.killed).toBe(false);
      expect(actor.hp).toBe(8);
      expect(actor.morphEnvelope?.temporaryHp).toBe(8);

      // Fatal hit of 15 damage: breaks 8 temp HP, with 7 excess damage spilling into original 40 HP
      const hit2 = actor.takeDamage(15);
      expect(actor.morphEnvelope).toBeUndefined(); // Morph broken
      expect(actor.name).toBe('Archdruid'); // Restored
      expect(actor.hp).toBe(33); // 40 - 7 = 33 HP
      expect(hit2.killed).toBe(false);
    });

    it('kills actor if excess spill damage exceeds original HP', () => {
      const actor = new Actor({
        id: 'fragile-druid',
        name: 'Fragile Druid',
        type: 'monster',
        faction: 'hostile',
        position: { x: 2, y: 2 },
        stats: { hp: 10, maxHp: 10, attack: 3, defense: 0 },
      });

      actor.applyMorph('badger', 5, { hp: 5, maxHp: 5 }, true);

      // Massive hit of 25 damage: breaks 5 temp HP, 20 excess spill damage > 10 orig HP
      const hit = actor.takeDamage(25);
      expect(actor.morphEnvelope).toBeUndefined();
      expect(actor.hp).toBe(0);
      expect(hit.killed).toBe(true);
      expect(actor.isAlive()).toBe(false);
    });
  });

  describe('Monster Symmetrical Consumable Usage in AI', () => {
    it('causes low-HP monster to drink carried healing potion via MonsterAI.decideAction', () => {
      const goblin = new Monster({
        id: 'smart-goblin',
        name: 'Smart Goblin',
        position: { x: 7, y: 5 },
        stats: { hp: 5, maxHp: 25, attack: 5, defense: 1 }, // 5/25 = 20% HP (under 30%)
      });
      engine.addEntity(goblin);

      const potion = new PotionItem({
        id: 'heal-pot-1',
        name: 'Minor Healing Draught',
        potionType: 'health',
        effects: [{ type: 'restore_hp', amount: 15 }],
      });
      goblin.addItem(potion);
      expect(goblin.hasItem('heal-pot-1')).toBe(true);

      // AI should decide to drink potion
      const action = MonsterAI.decideAction(goblin, engine);
      expect(action).toBeInstanceOf(DrinkPotionAction);

      // Performing action heals goblin and removes potion
      const res = action.perform(engine);
      expect(res.success).toBe(true);
      expect(goblin.hp).toBe(20);
      expect(goblin.hasItem('heal-pot-1')).toBe(false);
    });

    it('causes monster with attack wand to zap player within LOS and range', () => {
      const wizard = new Monster({
        id: 'evil-wizard',
        name: 'Evil Wizard',
        position: { x: 5, y: 8 }, // 3 tiles away from player at (5, 5)
        stats: { hp: 30, maxHp: 30, attack: 4, defense: 2 },
      });
      engine.addEntity(wizard);

      const wand = new WandItem({
        id: 'fire-wand-1',
        name: 'Wand of Firebolts',
        spellId: 'firebolt',
        charges: 5,
        maxCharges: 5,
      });
      wizard.addItem(wand);

      const action = MonsterAI.decideAction(wizard, engine);
      expect(action).toBeInstanceOf(ZapWandAction);

      const res = action.perform(engine);
      expect(res.success).toBe(true);
      expect(wand.charges).toBe(4);
    });
  });
});
