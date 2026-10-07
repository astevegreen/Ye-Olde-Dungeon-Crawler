import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { Player } from '../src/engine/entities/player';
import { Monster } from '../src/engine/entities/monster';
import { Item } from '../src/engine/items/item';
import { familyModifier } from '../src/engine/items/modifierRoller';
import type { ItemModifier, ModifierCategory } from '../src/engine/items/modifiers';
import { COTW_ITEM_FAMILIES } from '../src/content/cotw/itemFamilies';
import { MeleeAttackAction } from '../src/engine/actions/combat';
import { CastSpellAction } from '../src/engine/actions/spell-actions';
import { breakCurses } from '../src/engine/items/breakCurses';
import { EquipAction } from '../src/engine/actions/inventory-actions';
import { MovementAction } from '../src/engine/actions/movement';
import { TILES } from '../src/engine/grid/tile';
import { AutoRestManager, RestTurnAction } from '../src/engine/actions/autoRest';
import { ManaOverflowManager } from '../src/engine/magic/manaOverflow';
import { cotwManifest } from '../src/content/cotw';
import { TempleService } from '../src/engine/economy/services';
import { ItemFactory } from '../src/engine/items/factory';
import { addCurrencyToPlayer } from '../src/engine/economy/currency';
import { serializeItem, deserializeItem } from '../src/engine/storage/serializer';
import type { GameEvent, UncurseEvent } from '../src/engine/events';
import type { SpellDefinition } from '../src/engine/magic/types';

/** The cotw family's modifier for an item found on `floor` (tier 1 on floor 1, tier 2 on floor 10/15, tier 3 on 25). */
const mod = (category: ModifierCategory, floor: number) => familyModifier(COTW_ITEM_FAMILIES, category, floor, 'test')!;

describe('Declarative Item Enchantment, Affliction, and Chaotic Alignment System', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;
  let emittedEvents: GameEvent[];

  beforeEach(() => {
    map = GameMap.createBoxRoom(20, 20);
    player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 },
      speed: 100,
    });
    player.gainEnergy(100);
    engine = new GameEngine({ map, player });
    emittedEvents = [];
    engine.onGameEvent = (ev) => emittedEvents.push(ev);
  });

  describe('Item Affix Display & Effective Stats Aggregation', () => {
    it('applies prefixes and suffixes to identified item display name', () => {
      const sword = new Item({
        id: 'sw1',
        name: 'Claymore',
        category: 'weapon',
        slot: 'mainHand',
        weight: 2500,
        bulk: 3000,
        identified: true,
      });

      sword.addModifier(mod('blessed', 1)); // prefix: 'Blessed'
      sword.addModifier(mod('holy', 10)); // suffix: 'of Dawn'

      expect(sword.displayName).toBe('Blessed Claymore of Dawn');
    });

    it('names a Holy item by its suffix alone, with no inferred "Blessed" prefix (the Holy name bug)', () => {
      const mace = new Item({ id: 'm1', name: 'Broadsword', category: 'weapon', slot: 'mainHand', weight: 1500, bulk: 1200, identified: true });
      mace.addModifier(mod('holy', 1));
      expect(mace.displayName).toBe('Broadsword of the Templar');
      const wand = new Item({ id: 'w1', name: 'Rod', category: 'weapon', slot: 'mainHand', weight: 500, bulk: 400, identified: true });
      wand.addModifier(mod('enchanted', 1));
      expect(wand.displayName).toBe('Enchanted Rod');
      expect(mace.isBlessed()).toBe(false);
      expect(mace.isHoly()).toBe(true);
    });

    it('formats unidentified name with Unidentified prefix when item is not identified', () => {
      const sword = new Item({
        id: 'sw1',
        name: 'Claymore',
        unidentifiedName: 'Heavy Blade',
        category: 'weapon',
        slot: 'mainHand',
        weight: 2500,
        bulk: 3000,
        identified: false,
      });
      sword.addModifier(mod('blessed', 1));
      expect(sword.displayName).toBe('Unidentified Heavy Blade');
    });

    it('aggregates stat deltas into effectiveStats', () => {
      const helm = new Item({
        id: 'h1',
        name: 'Iron Sallet',
        category: 'helmet',
        slot: 'head',
        weight: 1200,
        bulk: 1500,
        stats: { defenseBonus: 3 },
      });

      helm.addModifier({
        id: 'mod_custom',
        name: 'Stalwart',
        alignment: 'positive',
        category: 'blessed',
        statDeltas: { defenseBonus: 2, strengthBonus: 1 },
      });

      expect(helm.effectiveStats.defenseBonus).toBe(5);
      expect(helm.effectiveStats.strengthBonus).toBe(1);
    });
  });

  describe('Combat Pipeline: Physical & Magical Invariant Separation', () => {
    it('Blessed strictly boosts melee damage without altering spell damage or mana cost', () => {
      const blessedSword = new Item({
        id: 'sw1',
        name: 'Blessed Sword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
        identified: true,
      });
      blessedSword.addModifier(mod('blessed', 1)); // +15% melee, +1 flat, +2 ATK

      player.inventory.paperdoll.equip(blessedSword, 'mainHand');

      const target = new Monster({
        id: 'mon1',
        name: 'Goblin',
        position: { x: 5, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 },
      });

      // 1. Melee check
      player.attack = 10;
      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);
      // Base attack 10 + 2 (from ATK delta) = 12. 12 * 1.15 = 13.8 -> 14 + 1 flat = 15.
      expect(target.hp).toBeLessThan(86);

      // 2. Spell cast check: blessed item should NOT discount mana cost
      const testSpell: SpellDefinition = {
        id: 'test_spark',
        name: 'Spark',
        school: 'Combat',
        basePower: 10,
        element: 'fire',
        manaCost: 10,
        range: 5,
        areaOfEffect: 0,
        reflects: false,
        targetType: 'tile',
        description: 'Test spark',
        effects: [{ type: 'damage', element: 'fire', amount: 10 }],
      };
      engine.manifest.spells = [testSpell];
      player.mana = 20;

      const cast = new CastSpellAction(player, 'test_spark', target.x, target.y);
      cast.perform(engine);
      expect(player.mana).toBe(10); // Exactly 10 MP consumed, 0 discount
    });

    it('Enchanted strictly scales spell damage and discounts mana without affecting melee damage', () => {
      const enchantedStaff = new Item({
        id: 'staff1',
        name: 'Staff of the Archmage',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1200,
        bulk: 1800,
        identified: true,
      });
      enchantedStaff.addModifier(mod('enchanted', 1)); // +20% spell damage, -2 mana discount

      player.inventory.paperdoll.equip(enchantedStaff, 'mainHand');

      const target = new Monster({
        id: 'mon2',
        name: 'Practice Dummy',
        position: { x: 6, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
      });
      map.addEntity(target);

      // 1. Melee attack: base attack 10, defense 0 -> deals exactly 10 (no melee bonus)
      player.attack = 10;
      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);
      expect(target.hp).toBe(90);

      // 2. Spell casting: spell cost 10 -> discounted by 2 to 8 MP
      const spell: SpellDefinition = {
        id: 'arcane_blast',
        name: 'Arcane Blast',
        school: 'Combat',
        basePower: 20,
        element: 'arcane',
        manaCost: 10,
        range: 5,
        areaOfEffect: 0,
        reflects: false,
        targetType: 'tile',
        description: 'Blasts arcane force',
        effects: [{ type: 'damage', element: 'arcane', amount: 20 }],
      };
      engine.manifest.spells = [spell];
      player.mana = 20;

      const cast = new CastSpellAction(player, 'arcane_blast', target.x, target.y);
      cast.perform(engine);

      // Mana discounted: 20 - (10 - 2) = 12
      expect(player.mana).toBe(12);
      // Target damage: 20 * 1.20 = 24 damage dealt. 90 - 24 = 66 HP remaining
      expect(target.hp).toBe(66);
    });
  });

  describe('Melee fields apply by data, whatever the family', () => {
    it('applies a melee multiplier carried by a non-Blessed modifier', () => {
      const axe = new Item({ id: 'ax1', name: 'Axe', category: 'weapon', slot: 'mainHand', weight: 2000, bulk: 1500, identified: true });
      axe.addModifier({ id: 'x', name: 'Keen', alignment: 'positive', category: 'holy', meleeDamageMultiplier: 2, meleeDamageFlatBonus: 3 });
      player.inventory.paperdoll.equip(axe, 'mainHand');
      const target = new Monster({ id: 'mon-k', name: 'Dummy', position: { x: 5, y: 6 }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 } });
      map.addEntity(target);
      player.attack = 10;
      new MeleeAttackAction(player, target).perform(engine);
      // 10 raw -> x2 + 3 = 23 (no variance or crits in this engine's default combat config)
      expect(100 - target.hp).toBe(23);
    });
  });

  describe('Holy Radiant Scaling vs Undead/Demon', () => {
    it('applies radiant damage multiplier and flat bonus against undead', () => {
      const holyMace = new Item({
        id: 'mace1',
        name: 'Morningstar',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1800,
        bulk: 2200,
        identified: true,
      });
      holyMace.addModifier(mod('holy', 1)); // +30% dmg, +2 flat vs Undead/Demon
      player.inventory.paperdoll.equip(holyMace, 'mainHand');

      const skeleton = new Monster({
        id: 'skel1',
        name: 'Skeleton Warrior',
        position: { x: 6, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 },
        tags: ['undead'],
      });
      map.addEntity(skeleton);

      player.attack = 10;
      const attack = new MeleeAttackAction(player, skeleton);
      attack.perform(engine);

      // 10 base * 1.3 = 13 + 2 = 15 damage
      expect(skeleton.hp).toBe(85);
    });

    it('does not apply holy radiant bonus against non-undead/demon entities', () => {
      const holyMace = new Item({
        id: 'mace2',
        name: 'Morningstar',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1800,
        bulk: 2200,
        identified: true,
      });
      holyMace.addModifier(mod('holy', 1));
      player.inventory.paperdoll.equip(holyMace, 'mainHand');

      const beast = new Monster({
        id: 'wolf1',
        name: 'Cave Wolf',
        position: { x: 6, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 },
        tags: ['beast'],
      });
      map.addEntity(beast);

      player.attack = 10;
      const attack = new MeleeAttackAction(player, beast);
      attack.perform(engine);

      // 10 base with 0 bonus -> 90 HP remaining
      expect(beast.hp).toBe(90);
    });
  });

  describe('Hel-touched Unholy (Q23, Q34)', () => {
    const helTouchedDagger = () => {
      const dagger = new Item({ id: 'hel-dagger', name: 'Seax', category: 'weapon', slot: 'mainHand', weight: 800, bulk: 600, identified: true });
      dagger.addModifier(mod('unholy', 10));
      return dagger;
    };
    const foe = (id: string, x: number, tags: string[] = []) => {
      const m = new Monster({ id, name: id, position: { x, y: 5 }, stats: { hp: 100, maxHp: 100, attack: 2, defense: 0 }, tags });
      map.addEntity(m);
      return m;
    };

    it('adds 30% against the living and heals the bearer a fifth of it; the undead are immune', () => {
      player.inventory.paperdoll.equip(helTouchedDagger(), 'mainHand');
      player.attack = 20;
      player.hp = 50;
      const wolf = foe('wolf', 6);
      new MeleeAttackAction(player, wolf).perform(engine);
      expect(100 - wolf.hp).toBe(26); // 20 × 1.3
      expect(player.hp).toBe(55); // + a fifth of 26, rounded

      player.gainEnergy(100);
      const draugr = foe('draugr', 4, ['undead']);
      new MeleeAttackAction(player, draugr).perform(engine);
      expect(100 - draugr.hp).toBe(20);
      expect(player.hp).toBe(55);
    });

    it('binds, and while it is worn the temple serves only the cleanse, at double the price', () => {
      const dagger = helTouchedDagger();
      expect(dagger.isBound()).toBe(true);
      player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
      player.inventory.paperdoll.equip(dagger, 'mainHand');
      addCurrencyToPlayer(player, 2000);
      player.hp = 10;

      const heal = TempleService.healAndRestore(player, undefined, undefined, engine);
      expect(heal.success).toBe(false);
      expect(heal.message).toMatch(/cleans/i);
      expect(player.hp).toBe(10);

      const cleanse = TempleService.cleanseCurses(player, undefined, undefined, engine);
      expect(cleanse.success).toBe(true);
      expect(cleanse.costInCp).toBe(TempleService.CURSE_CLEANSE_COST_CP * 2);
      expect(dagger.modifiers).toEqual([]);
      expect(TempleService.healAndRestore(player, undefined, undefined, engine).success).toBe(true);
    });

    it('burns the bearer on sacred ground: stepping onto it, and striking from it', () => {
      player.inventory.paperdoll.equip(helTouchedDagger(), 'mainHand');
      player.hp = 50;
      map.setTile(6, 5, { ...TILES.FLOOR, type: 'shrine_floor', name: 'Shrine Floor', sacred: true });
      map.setTile(4, 5, { ...TILES.FLOOR });

      expect(new MovementAction(player, 1, 0).perform(engine).success).toBe(true);
      expect(player.position).toEqual({ x: 6, y: 5 });
      expect(player.hp).toBe(45);

      player.gainEnergy(100);
      const wolf = foe('wolf', 7, ['undead']); // undead: no lifesteal to muddy the burn
      new MeleeAttackAction(player, wolf).perform(engine);
      expect(player.hp).toBe(40);
      expect(wolf.hp).toBeLessThan(100);

      // Plain ground does not burn.
      player.gainEnergy(100);
      new MovementAction(player, -1, 0).perform(engine);
      new MovementAction(player, -1, 0).perform(engine);
      expect(player.hp).toBe(40);
    });
  });

  describe('Hexed Damage Amplification', () => {
    it('amplifies damage taken by an entity equipped with a Hexed item', () => {
      const target = new Monster({
        id: 'mon_hexed',
        name: 'Hexed Ogre',
        position: { x: 6, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 },
      });

      // Target has a hexed ring
      const hexedRing = new Item({
        id: 'ring_h',
        name: 'Cursed Band',
        category: 'ring',
        slot: 'fingerLeft',
        weight: 50,
        bulk: 50,
      });
      hexedRing.addModifier(mod('hexed', 1)); // takes +25% + 2 flat damage
      target.inventory.paperdoll.equip(hexedRing, 'fingerLeft');
      map.addEntity(target);

      player.attack = 20;
      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);

      // 20 * 1.25 = 25 + 2 = 27 damage taken. 100 - 27 = 73 HP
      expect(target.hp).toBe(73);
    });
  });

  describe('Loki-touched Chaotic (Q22): eight rule-benders that do not bind', () => {
    const chaotic = (name: string, fields: Partial<ItemModifier>): ItemModifier => ({ id: `c-${name}`, name, alignment: 'chaotic', category: 'chaotic', ...fields });
    const wear = (actor: Player | Monster, slot: 'mainHand' | 'fingerLeft' | 'head', modifier: ItemModifier) => {
      const item = new Item({ id: `${actor.id}-${slot}`, name: 'Thing', category: slot === 'mainHand' ? 'weapon' : slot === 'head' ? 'helmet' : 'ring', slot, weight: 100, bulk: 100, identified: true });
      item.addModifier(modifier);
      actor.inventory.paperdoll.equip(item, slot);
      return item;
    };
    const dummy = (id: string, x: number, y = 5, attack = 10) => {
      const m = new Monster({ id, name: id, position: { x, y }, stats: { hp: 100, maxHp: 100, attack, defense: 0 } });
      map.addEntity(m);
      return m;
    };

    it('none of the eight binds', () => {
      const family = COTW_ITEM_FAMILIES.families.find((f) => f.category === 'chaotic')!;
      expect(family.binds).toBeFalsy();
      expect(family.tiers.map((t) => t.name)).toEqual([
        'Wildfire', 'Bloodthirst', 'Twinstrike', 'Glass Fury', "Trickster's Step", 'Fickle Fortune', 'Void-Kissed', 'Mirror Hide',
      ]);
    });

    it('Twinstrike strikes twice in one action, and a miss costs 3 HP', () => {
      wear(player, 'mainHand', chaotic('Twinstrike', { extraMeleeStrikes: 1, missSelfDamage: 3 }));
      player.attack = 10;
      player.hp = 50;
      const foe = dummy('foe', 6);
      const res = new MeleeAttackAction(player, foe).perform(engine);
      expect(100 - foe.hp).toBe(20);
      expect(res.cost).toBeGreaterThan(0);
      expect(emittedEvents.filter((e) => e.type === 'damage_dealt').length).toBe(2);

      // Against a defender nothing can hit, the first blow misses and the second never comes.
      const slippery = dummy('slippery', 4);
      wear(slippery, 'fingerLeft', chaotic("Trickster's Step", { evasionBonus: 1 }));
      player.gainEnergy(100);
      new MeleeAttackAction(player, slippery).perform(engine);
      expect(slippery.hp).toBe(100);
      expect(player.hp).toBe(47);
    });

    it('Glass Fury adds half again to what the bearer deals and to what it takes', () => {
      wear(player, 'head', chaotic('Glass Fury', { meleeDamageMultiplier: 1.5, spellDamageMultiplier: 1.5, damageTakenMultiplier: 1.5 }));
      player.attack = 10;
      player.hp = 100;
      const foe = dummy('foe', 6, 5, 10);
      new MeleeAttackAction(player, foe).perform(engine);
      expect(100 - foe.hp).toBe(15);
      foe.gainEnergy(100);
      new MeleeAttackAction(foe, player).perform(engine);
      expect(100 - player.hp).toBe(15);
    });

    it('Fickle Fortune rolls each blow between nothing and two and a half times', () => {
      wear(player, 'mainHand', chaotic('Fickle Fortune', { meleeDamageRoll: [0, 2.5] }));
      player.attack = 10;
      const foe = dummy('foe', 6);
      engine.rng = () => 0.999; // the top of the roll: ×2.4975
      new MeleeAttackAction(player, foe).perform(engine);
      const top = 100 - foe.hp;
      expect(top).toBe(Math.round(player.attack * 0.999 * 2.5));
      expect(top).toBeGreaterThan(player.attack * 2);
      engine.rng = () => 0; // the bottom: a scratch (the mitigation floor is 1)
      player.gainEnergy(100);
      new MeleeAttackAction(player, foe).perform(engine);
      expect(100 - foe.hp).toBe(top + 1);
    });

    it('Mirror Hide turns a quarter of each blow back, and halves healing on the bearer', () => {
      wear(player, 'head', chaotic('Mirror Hide', { reflectMeleePercent: 0.25, healingReceivedMultiplier: 0.5 }));
      player.hp = 50;
      const foe = dummy('foe', 6, 5, 20);
      new MeleeAttackAction(foe, player).perform(engine);
      expect(player.hp).toBe(30);
      expect(foe.hp).toBe(95);
      expect(player.heal(10)).toBe(5);
      // Halving a rest's one point a tick still heals every other tick.
      expect(player.heal(1) + player.heal(1)).toBe(1);
    });

    it('Bloodthirst heals 15% of max HP on a kill and forbids rest', () => {
      wear(player, 'mainHand', chaotic('Bloodthirst', { killHealPercent: 0.15, forbidsRest: true }));
      player.maxHp = 100;
      player.hp = 50;
      player.attack = 200;
      const foe = dummy('foe', 6);
      new MeleeAttackAction(player, foe).perform(engine);
      expect(foe.isAlive()).toBe(false);
      expect(player.hp).toBe(65);
      expect(AutoRestManager.restRefusal(engine)).toMatch(/will not let you rest/);
      expect(new RestTurnAction(player).perform(engine).success).toBe(false);
    });

    it("Trickster's Step flings the bearer 2–4 tiles on every tenth step, and the count survives in the world state", () => {
      wear(player, 'fingerLeft', chaotic("Trickster's Step", { evasionBonus: 0.25, blinkEverySteps: 10, blinkRange: [2, 4] }));
      const start = { x: player.x, y: player.y };
      for (let i = 0; i < 9; i++) {
        player.gainEnergy(100);
        expect(new MovementAction(player, i % 2 === 0 ? 1 : -1, 0).perform(engine).success).toBe(true);
      }
      expect(engine.getWorldCounter('steps:c-Trickster\'s Step')).toBe(9);
      expect(Math.abs(player.x - start.x) + Math.abs(player.y - start.y)).toBeLessThanOrEqual(1);
      player.gainEnergy(100);
      const before = { x: player.x, y: player.y };
      new MovementAction(player, 1, 0).perform(engine);
      const stepped = { x: before.x + 1, y: before.y };
      const d = Math.max(Math.abs(player.x - stepped.x), Math.abs(player.y - stepped.y));
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(4);
      expect(engine.getWorldCounter('steps:c-Trickster\'s Step')).toBe(0);
      expect(emittedEvents.some((e) => e.type === 'chaotic_proc')).toBe(true);
    });

    it('Wildfire gives a damaging spell a random element of the pack, at +40% power', () => {
      const fire = new GameEngine({ map: GameMap.createBoxRoom(20, 20), player: new Player({ id: 'p2', name: 'Caster', position: { x: 5, y: 5 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } }), manifest: cotwManifest });
      fire.player.gainEnergy(100);
      fire.player.mana = 50;
      fire.player.spellsKnown.push('firebolt');
      wear(fire.player, 'fingerLeft', chaotic('Wildfire', { randomSpellElement: true, spellDamageMultiplier: 1.4 }));
      const foe = new Monster({ id: 'f', name: 'f', position: { x: 7, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 } });
      fire.map.addEntity(foe);
      fire.rng = () => 0.999; // the last element of the pack's list, which is not firebolt's own
      // The pack's elements Wildfire may pick: not healing or physical, nor one excluded from random draws (shadow).
      const elements = fire.affinityMatrix.getAllElements().filter((e) => !e.excludeFromRandom).map((e) => e.id).filter((e) => e !== 'healing' && e !== 'physical');
      const res = new CastSpellAction(fire.player, 'firebolt', 7, 5).perform(fire);
      expect(res.success).toBe(true);
      const logged = fire.messages.join('\n');
      expect(logged).toContain(`Wildfire turns Firebolt to ${elements[elements.length - 1]}`);
      expect(logged).toContain(`${elements[elements.length - 1]} damage`);
    });

    it('Void-Kissed casts past empty leave no debt and surge a tier worse', () => {
      const void_ = new GameEngine({ map: GameMap.createBoxRoom(20, 20), player: new Player({ id: 'p3', name: 'Caster', position: { x: 5, y: 5 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } }), manifest: cotwManifest });
      void_.player.voidDebt = 0;
      const plain = ManaOverflowManager.evaluateOverflow(void_, void_.player, 3, { accrueDebt: true, tierShift: 0 });
      expect(void_.player.voidDebt).toBe(3);
      expect(plain.tier).toBe(1);
      void_.player.voidDebt = 0;
      const kissed = ManaOverflowManager.evaluateOverflow(void_, void_.player, 3, { accrueDebt: false, tierShift: 1 });
      expect(void_.player.voidDebt).toBe(0);
      expect(kissed.tier).toBe(2);
    });

    it("Void-Kissed lifts a surge no higher than the pack's second tier (Q46)", () => {
      const tier = COTW_ITEM_FAMILIES.families.find((f) => f.category === 'chaotic')!.tiers.find((t) => t.name === 'Void-Kissed')!;
      expect(tier.overflowTierShiftCap).toBe(2);
      const e = new GameEngine({ map: GameMap.createBoxRoom(20, 20), player: new Player({ id: 'p4', name: 'Caster', position: { x: 5, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 10, defense: 0 } }), manifest: cotwManifest });
      const surge = (deficit: number) => {
        e.player.voidDebt = 0;
        return ManaOverflowManager.evaluateOverflow(e, e.player, deficit, { accrueDebt: false, tierShift: 1, tierShiftCap: 2 }).tier;
      };
      expect(surge(3)).toBe(2); // tier 1 rises to 2
      expect(surge(8)).toBe(2); // tier 2 would rise to 3: held at 2
      expect(surge(20)).toBe(3); // a surge already at tier 3 stays there
    });

    it('a cast short of mana passes the worn cap to the surge', () => {
      const e = new GameEngine({ map: GameMap.createBoxRoom(20, 20), player: new Player({ id: 'p5', name: 'Caster', position: { x: 5, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 10, defense: 0 } }), manifest: cotwManifest });
      e.player.gainEnergy(100);
      e.player.mana = 0;
      e.player.spellsKnown.push('firebolt');
      wear(e.player, 'fingerLeft', chaotic('Void-Kissed', { overflowNoDebt: true, overflowTierShift: 1, overflowTierShiftCap: 2 }));
      e.map.addEntity(new Monster({ id: 'vk-foe', name: 'foe', position: { x: 7, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 } }));
      const spy = vi.spyOn(ManaOverflowManager, 'evaluateOverflow');
      new CastSpellAction(e.player, 'firebolt', 7, 5).perform(e);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][3]).toMatchObject({ accrueDebt: false, tierShift: 1, tierShiftCap: 2 });
      spy.mockRestore();
    });
  });

  describe('Reveal on wearing; negative families bind until cleansed (Q21)', () => {
    const ring = (id: string, category: ModifierCategory) => {
      const item = new Item({ id, name: 'Iron Band', unidentifiedName: 'Dull Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40 });
      item.addModifier(mod(category, 20));
      return item;
    };

    it('identifies any item the moment it is worn, cursed or not', () => {
      const plain = ring('r-holy', 'holy');
      player.inventory.primaryPack.addItem(plain);
      expect(plain.identified).toBe(false);
      expect(new EquipAction(player, plain.id).perform(engine).success).toBe(true);
      expect(plain.identified).toBe(true);
    });

    it('binds Cursed, Hexed and Unholy items, and no positive or chaotic one', () => {
      for (const category of ['cursed', 'hexed', 'unholy'] as ModifierCategory[]) {
        expect(ring(`b-${category}`, category).isBound(), category).toBe(true);
      }
      for (const category of ['blessed', 'enchanted', 'holy', 'chaotic'] as ModifierCategory[]) {
        expect(ring(`f-${category}`, category).isBound(), category).toBe(false);
      }
      const hexed = ring('worn-hexed', 'hexed');
      player.inventory.primaryPack.addItem(hexed);
      const res = new EquipAction(player, hexed.id).perform(engine);
      expect(res.success).toBe(true);
      expect(res.message).toContain('binds');
      expect(player.inventory.paperdoll.canUnequip('fingerLeft').allowed).toBe(false);
    });

    it('the temple cleanse takes a worn Hexed item off, its hex gone, and leaves a Blessed one alone', () => {
      const hexed = ring('t-hexed', 'hexed');
      const blessed = new Item({ id: 't-blessed', name: 'Cap', category: 'helmet', slot: 'head', weight: 500, bulk: 400, identified: true });
      blessed.addModifier(mod('blessed', 1));
      player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
      player.inventory.paperdoll.equip(hexed, 'fingerLeft');
      player.inventory.paperdoll.equip(blessed, 'head');
      addCurrencyToPlayer(player, 5000);

      const res = TempleService.cleanseCurses(player);
      expect(res.success).toBe(true);
      expect(hexed.modifiers).toEqual([]);
      expect(hexed.isBound()).toBe(false);
      expect(hexed.identified).toBe(true);
      expect(player.inventory.paperdoll.getItem('fingerLeft')).toBeNull();
      expect(player.inventory.primaryPack.getItem('t-hexed')).toBeDefined();
      expect(blessed.modifiers.length).toBe(1);
      expect(player.inventory.paperdoll.getItem('head')).toBe(blessed);
    });
  });

  describe('Cursed Equip-Lock & breakCurses', () => {
    it('blocks unequipping when an item has a cursed modifier', () => {
      const cursedRing = new Item({
        id: 'cr1',
        name: 'Ring of Sorrow',
        category: 'ring',
        slot: 'fingerLeft',
        weight: 50,
        bulk: 50,
      });
      cursedRing.addModifier(mod('cursed', 1)); // cursed: true

      expect(cursedRing.isCursed()).toBe(true);

      player.inventory.paperdoll.equip(cursedRing, 'fingerLeft');

      const unequipCheck = player.inventory.paperdoll.canUnequip('fingerLeft');
      expect(unequipCheck.allowed).toBe(false);
      expect(unequipCheck.reason).toContain('cursed and bound');
    });

    it('breakCurses purges cursed modifiers, emits UncurseEvent, and permits unequipping', () => {
      const cursedHelm = new Item({
        id: 'ch1',
        name: 'Iron Helm',
        category: 'helmet',
        slot: 'head',
        weight: 1500,
        bulk: 1800,
      });
      cursedHelm.addModifier(mod('cursed', 1));
      cursedHelm.addModifier(mod('blessed', 1)); // keep non-cursed modifier!

      player.inventory.paperdoll.equip(cursedHelm, 'head');
      expect(cursedHelm.isCursed()).toBe(true);

      expect(breakCurses(engine, player, { slot: 'head' })).toEqual([cursedHelm]);

      // Verify curse was removed while keeping blessed modifier
      expect(cursedHelm.isCursed()).toBe(false);
      expect(cursedHelm.modifiers.length).toBe(1);
      expect(cursedHelm.modifiers[0].category).toBe('blessed');

      // Verify UncurseEvent was emitted
      const uncurseEv = emittedEvents.find((e) => e.type === 'uncurse') as UncurseEvent;
      expect(uncurseEv).toBeDefined();
      expect(uncurseEv.itemId).toBe('ch1');
      expect(uncurseEv.removedModifiers).toContain('Cursed');

      // Can now unequip cleanly
      const unequipCheck = player.inventory.paperdoll.canUnequip('head');
      expect(unequipCheck.allowed).toBe(true);
    });
  });

  describe('Storage Serialization & Roundtrip Integrity', () => {
    it('serializes and deserializes item modifiers without loss of fidelity', () => {
      const weapon = new Item({
        id: 'w_ser_1',
        name: 'Warhammer',
        category: 'weapon',
        slot: 'mainHand',
        weight: 2200,
        bulk: 2500,
        stats: { attackBonus: 4 },
        identified: true,
      });

      weapon.addModifier(mod('blessed', 10));
      weapon.addModifier(mod('holy', 1));

      const serialized = serializeItem(weapon);
      expect(serialized.modifiers).toBeDefined();
      expect(serialized.modifiers!.length).toBe(2);

      const restored = deserializeItem(serialized);
      expect(restored.modifiers.length).toBe(2);
      expect(restored.modifiers[0].name).toBe('Sanctified');
      expect(restored.modifiers[0].meleeDamageMultiplier).toBe(1.25);
      expect(restored.modifiers[1].name).toBe('of the Templar');
      expect(restored.effectiveStats.attackBonus).toBe(8); // 4 base + 4 Sanctified
      expect(restored.displayName).toBe('Sanctified Warhammer of the Templar');
    });
  });
});
