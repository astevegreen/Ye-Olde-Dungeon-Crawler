import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { Player } from '../src/engine/entities/player';
import { Monster } from '../src/engine/entities/monster';
import { Item } from '../src/engine/items/item';
import {
  createModifier,
  rollItemModifiers,
  applyProceduralModifiers,
} from '../src/engine/items/modifierRoller';
import { MeleeAttackAction } from '../src/engine/actions/combat';
import { CastSpellAction } from '../src/engine/actions/spell-actions';
import { UncurseAction } from '../src/engine/actions/uncurseAction';
import { Mulberry32 } from '../src/engine/dungeon/prng';
import { serializeItem, deserializeItem } from '../src/engine/storage/serializer';
import type { GameEvent, AlignmentRenownEvent, ChaoticProcEvent, UncurseEvent } from '../src/engine/events';
import type { SpellDefinition } from '../src/engine/magic/types';

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

  describe('PRNG Determinism & Modifier Rolling', () => {
    it('produces bit-for-bit identical modifiers given identical PRNG seeds', () => {
      const prng1 = new Mulberry32(1337);
      const prng2 = new Mulberry32(1337);

      const weapon1 = new Item({
        id: 'w1',
        name: 'Broadsword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
      });
      const weapon2 = new Item({
        id: 'w2',
        name: 'Broadsword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
      });

      const mods1 = rollItemModifiers(weapon1, 15, () => prng1.next());
      const mods2 = rollItemModifiers(weapon2, 15, () => prng2.next());

      expect(mods1.length).toBe(1);
      expect(mods2.length).toBe(1);
      expect(mods1[0].name).toBe(mods2[0].name);
      expect(mods1[0].category).toBe(mods2[0].category);
      expect(mods1[0].alignment).toBe(mods2[0].alignment);
      expect(mods1[0].meleeDamageMultiplier).toBe(mods2[0].meleeDamageMultiplier);
    });

    it('scales modifier tiers with dungeon depth', () => {
      const weapon = new Item({
        id: 'w1',
        name: 'Longsword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
      });

      // Shallow floor (depth 1)
      const shallowMods = rollItemModifiers(weapon, 1, () => 0.0); // selects blessed t1
      expect(shallowMods[0].name).toBe('Blessed');
      expect(shallowMods[0].meleeDamageMultiplier).toBe(1.15);

      // Deep floor (depth 30)
      const deepMods = rollItemModifiers(weapon, 30, () => 0.0); // selects blessed t3
      expect(deepMods[0].name).toBe('Celestial');
      expect(deepMods[0].meleeDamageMultiplier).toBe(1.4);
    });

    it('attaches modifiers to item instance via applyProceduralModifiers', () => {
      const prng = new Mulberry32(999);
      const dagger = new Item({
        id: 'd1',
        name: 'Dagger',
        category: 'weapon',
        slot: 'mainHand',
        weight: 500,
        bulk: 500,
      });
      applyProceduralModifiers(dagger, 15, () => prng.next());
      expect(dagger.modifiers.length).toBe(1);
    });

    it('returns no modifiers for non-equipment categories (consumables, currency)', () => {
      const potion = new Item({
        id: 'pot1',
        name: 'Minor Health Potion',
        category: 'consumable',
        weight: 200,
        bulk: 200,
      });
      const mods = rollItemModifiers(potion, 20, Math.random);
      expect(mods).toEqual([]);
    });
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

      sword.addModifier(createModifier('blessed', 1)); // prefix: 'Blessed'
      sword.addModifier(createModifier('holy', 2)); // suffix: 'of Dawn'

      expect(sword.displayName).toBe('Blessed Claymore of Dawn');
    });

    it('preserves unidentified name when item is not identified', () => {
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
      sword.addModifier(createModifier('blessed', 1));
      expect(sword.displayName).toBe('Heavy Blade');
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

    it('zeroes effectiveStats when item is broken regardless of positive modifiers', () => {
      const sword = new Item({
        id: 'sw1',
        name: 'Broadsword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
        quality: 'broken',
        stats: { attackBonus: 5 },
      });
      sword.addModifier(createModifier('blessed', 2));
      expect(sword.effectiveStats.attackBonus).toBe(0);
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
      blessedSword.addModifier(createModifier('blessed', 1)); // +15% melee, +1 flat, +2 ATK

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
      enchantedStaff.addModifier(createModifier('enchanted', 1)); // +20% spell damage, -2 mana discount

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
      holyMace.addModifier(createModifier('holy', 1)); // +30% dmg, +2 flat vs Undead/Demon
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
      holyMace.addModifier(createModifier('holy', 1));
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

  describe('Unholy Scaling, Renown Generation, and Consecrated Ground Penalty', () => {
    it('inflicts bonus damage against clergy, awards dark_renown, and emits AlignmentRenownEvent', () => {
      const unholyDagger = new Item({
        id: 'dag1',
        name: 'Sacrificial Dagger',
        category: 'weapon',
        slot: 'mainHand',
        weight: 800,
        bulk: 900,
        identified: true,
      });
      unholyDagger.addModifier(createModifier('unholy', 1)); // +40% dmg, +3 flat vs clergy/innocents, +1 dark_renown
      player.inventory.paperdoll.equip(unholyDagger, 'mainHand');

      const priest = new Monster({
        id: 'priest1',
        name: 'High Priest',
        position: { x: 6, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 2, defense: 0 },
        tags: ['clergy'],
      });
      map.addEntity(priest);

      player.attack = 10;
      const attack = new MeleeAttackAction(player, priest);
      attack.perform(engine);

      // 10 * 1.4 = 14 + 3 = 17 damage. 100 - 17 = 83 HP
      expect(priest.hp).toBe(83);

      // Verify dark_renown in world state
      expect(engine.getWorldCounter('dark_renown')).toBe(1);

      // Verify AlignmentRenownEvent was emitted
      const renownEvent = emittedEvents.find((e) => e.type === 'alignment_renown') as AlignmentRenownEvent;
      expect(renownEvent).toBeDefined();
      expect(renownEvent.renownCategory).toBe('dark_renown');
      expect(renownEvent.amount).toBe(1);
      expect(renownEvent.totalRenown).toBe(1);
    });

    it('inflicts damage penalty and self-damage when wielding unholy weapon on consecrated ground', () => {
      const unholyAxe = new Item({
        id: 'axe1',
        name: 'Profane Greataxe',
        category: 'weapon',
        slot: 'mainHand',
        weight: 3000,
        bulk: 3500,
        identified: true,
      });
      unholyAxe.addModifier(createModifier('unholy', 1)); // consecrated penalty: 50% reduction, 3 self-damage
      player.inventory.paperdoll.equip(unholyAxe, 'mainHand');

      // Place player on consecrated ground surface
      engine.surfaces.setSurface(player.x, player.y, 'consecrated_ground', 10);

      const target = new Monster({
        id: 'mon1',
        name: 'Goblin',
        position: { x: player.x + 1, y: player.y },
        stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
      });
      map.addEntity(target);

      player.hp = 30;
      player.attack = 20;

      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);

      // Target takes penalized damage: 20 * (1 - 0.5) = 10 damage
      expect(target.hp).toBe(90);

      // Player took 3 retribution self-damage from consecrated ground
      expect(player.hp).toBe(27);
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
      hexedRing.addModifier(createModifier('hexed', 1)); // takes +25% + 2 flat damage
      target.inventory.paperdoll.equip(hexedRing, 'fingerLeft');
      map.addEntity(target);

      player.attack = 20;
      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);

      // 20 * 1.25 = 25 + 2 = 27 damage taken. 100 - 27 = 73 HP
      expect(target.hp).toBe(73);
    });
  });

  describe('Chaotic Procs: Backlash & Spatial Teleportation', () => {
    it('triggers backlash self-damage and emits ChaoticProcEvent on proc', () => {
      const chaoticBlade = new Item({
        id: 'cb1',
        name: 'Frenetic Blade',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
        identified: true,
      });
      // 100% chance to proc 5 backlash damage
      chaoticBlade.addModifier({
        id: 'mod_backlash_test',
        name: 'Frenetic',
        alignment: 'chaotic',
        category: 'chaotic',
        meleeDamageMultiplier: 1.3,
        chaoticProc: {
          procChance: 1.0,
          type: 'backlash',
          param: 5,
          description: 'Volatile recoil',
        },
      });

      player.inventory.paperdoll.equip(chaoticBlade, 'mainHand');
      player.hp = 30;

      const target = new Monster({
        id: 'mon1',
        name: 'Target Dummy',
        position: { x: 5, y: 5 },
        stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
      });

      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);

      // Player took 5 backlash damage
      expect(player.hp).toBe(25);

      const procEvent = emittedEvents.find((e) => e.type === 'chaotic_proc') as ChaoticProcEvent;
      expect(procEvent).toBeDefined();
      expect(procEvent.procType).toBe('backlash');
      expect(procEvent.damageDealt).toBe(5);
    });

    it('triggers tactical teleportation and emits ChaoticProcEvent on spatial warp proc', () => {
      const warpingStaff = new Item({
        id: 'ws1',
        name: 'Warping Staff',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 2000,
        identified: true,
      });
      // 100% chance to teleport within range 3
      warpingStaff.addModifier({
        id: 'mod_warp_test',
        name: 'Warping',
        alignment: 'chaotic',
        category: 'chaotic',
        chaoticProc: {
          procChance: 1.0,
          type: 'teleport',
          param: 3,
          description: 'Spatial dislocation',
        },
      });

      player.inventory.paperdoll.equip(warpingStaff, 'mainHand');
      const startX = player.x;
      const startY = player.y;

      const target = new Monster({
        id: 'mon1',
        name: 'Target Dummy',
        position: { x: startX + 1, y: startY },
        stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
      });

      const attack = new MeleeAttackAction(player, target);
      attack.perform(engine);

      const procEvent = emittedEvents.find((e) => e.type === 'chaotic_proc') as ChaoticProcEvent;
      expect(procEvent).toBeDefined();
      expect(procEvent.procType).toBe('teleport');
      expect(procEvent.teleportDestination).toBeDefined();
      expect(player.position).toEqual(procEvent.teleportDestination);
    });
  });

  describe('Cursed Equip-Lock & UncurseAction', () => {
    it('blocks unequipping when an item has a cursed modifier', () => {
      const cursedRing = new Item({
        id: 'cr1',
        name: 'Ring of Sorrow',
        category: 'ring',
        slot: 'fingerLeft',
        weight: 50,
        bulk: 50,
      });
      cursedRing.addModifier(createModifier('cursed', 1)); // cursed: true

      expect(cursedRing.isCursed()).toBe(true);

      player.inventory.paperdoll.equip(cursedRing, 'fingerLeft');

      const unequipCheck = player.inventory.paperdoll.canUnequip('fingerLeft');
      expect(unequipCheck.allowed).toBe(false);
      expect(unequipCheck.reason).toContain('cursed and bound');
    });

    it('UncurseAction purges cursed modifiers, emits UncurseEvent, and permits unequipping', () => {
      const cursedHelm = new Item({
        id: 'ch1',
        name: 'Iron Helm',
        category: 'helmet',
        slot: 'head',
        weight: 1500,
        bulk: 1800,
      });
      cursedHelm.addModifier(createModifier('cursed', 1));
      cursedHelm.addModifier(createModifier('blessed', 1)); // keep non-cursed modifier!

      player.inventory.paperdoll.equip(cursedHelm, 'head');
      expect(cursedHelm.isCursed()).toBe(true);

      const uncurseAction = new UncurseAction(player, { slot: 'head' });
      const res = uncurseAction.perform(engine);
      expect(res.success).toBe(true);

      // Verify curse was removed while keeping blessed modifier
      expect(cursedHelm.isCursed()).toBe(false);
      expect(cursedHelm.modifiers.length).toBe(1);
      expect(cursedHelm.modifiers[0].category).toBe('blessed');

      // Verify UncurseEvent was emitted
      const uncurseEv = emittedEvents.find((e) => e.type === 'uncurse') as UncurseEvent;
      expect(uncurseEv).toBeDefined();
      expect(uncurseEv.item.id).toBe('ch1');
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

      weapon.addModifier(createModifier('blessed', 2));
      weapon.addModifier(createModifier('holy', 1));

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
