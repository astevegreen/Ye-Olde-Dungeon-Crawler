import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateAttribute,
  AttributeCalculator,
  type AttributeModifier,
} from '../stats/attributeCalculator';
import { Player } from '../entities/player';
import { Actor } from '../entities/actor';
import { Monster } from '../entities/monster';

describe('Phased Attribute & Stat Aggregator', () => {
  let player: Player;
  let actor: Actor;

  beforeEach(() => {
    AttributeCalculator.clearModifiers();
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      strength: 14,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
    });
    actor = new Actor({
      id: 'test-actor',
      name: 'Test Actor',
      type: 'monster',
      faction: 'hostile',
      position: { x: 0, y: 0 },
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
    });
  });

  describe('Phase 1: Base values', () => {
    it('evaluates inherent entity base values correctly', () => {
      expect(calculateAttribute(player, 'attack')).toBe(10);
      expect(calculateAttribute(player, 'defense')).toBe(5);
      expect(calculateAttribute(player, 'maxHp')).toBe(50);
      expect(calculateAttribute(player, 'speed')).toBe(100);
      expect(calculateAttribute(player, 'strength')).toBe(14);
      expect(calculateAttribute(player, 'actionCost', { baseCost: 100 })).toBe(100);
      expect(calculateAttribute(actor, 'attack')).toBe(4);
      expect(calculateAttribute(actor, 'defense')).toBe(2);
    });
  });

  describe('Phase 2: Flat Additions', () => {
    it('applies custom flat modifiers to stats', () => {
      const flatBonus: AttributeModifier = {
        id: 'blessing_of_strength',
        attributeKey: 'attack',
        phase: 'flat',
        apply: (val) => val + 8,
      };

      AttributeCalculator.registerModifier(flatBonus);

      expect(calculateAttribute(player, 'attack')).toBe(18); // 10 + 8
      // Defense unaffected
      expect(calculateAttribute(player, 'defense')).toBe(5);
    });

    it('respects wildcard attributeKey (*) for flat phase', () => {
      const globalBonus: AttributeModifier = {
        id: 'divine_presence',
        attributeKey: '*',
        phase: 'flat',
        apply: (val) => val + 2,
      };

      AttributeCalculator.registerModifier(globalBonus);

      expect(calculateAttribute(player, 'attack')).toBe(12);
      expect(calculateAttribute(player, 'defense')).toBe(7);
    });
  });

  describe('Phase 3: Multipliers', () => {
    it('applies status effect multipliers on actionCost', () => {
      // Base action cost
      expect(calculateAttribute(player, 'actionCost', { baseCost: 100 })).toBe(100);

      // Apply haste status -> 0.75x
      player.statusManager.applyStatus({ type: 'haste', duration: 10 });
      expect(calculateAttribute(player, 'actionCost', { baseCost: 100 })).toBe(75);

      // Apply slow status -> 1.5x
      player.statusManager.removeStatus('haste');
      player.statusManager.applyStatus({ type: 'slow', duration: 10 });
      expect(calculateAttribute(player, 'actionCost', { baseCost: 100 })).toBe(150);
    });

    it('applies custom multiplier modifier', () => {
      const rageModifier: AttributeModifier = {
        id: 'berserker_rage',
        attributeKey: 'attack',
        phase: 'multiplier',
        apply: (val) => val * 1.5,
      };

      AttributeCalculator.registerModifier(rageModifier);
      expect(calculateAttribute(player, 'attack')).toBe(15); // 10 * 1.5
    });
  });

  describe('Phase 4: Caps & Clamping', () => {
    it('clamps negative values to minimum thresholds', () => {
      const curseModifier: AttributeModifier = {
        id: 'crippling_curse',
        attributeKey: 'attack',
        phase: 'flat',
        apply: (val) => val - 50,
      };

      AttributeCalculator.registerModifier(curseModifier);

      // Attack cannot drop below 1
      expect(calculateAttribute(player, 'attack')).toBe(1);
    });

    it('clamps actionCost to minimum 10 energy', () => {
      const hyperSpeed: AttributeModifier = {
        id: 'lightspeed',
        attributeKey: 'actionCost',
        phase: 'multiplier',
        apply: () => 1,
      };

      AttributeCalculator.registerModifier(hyperSpeed);
      expect(calculateAttribute(player, 'actionCost', { baseCost: 100 })).toBe(10);
    });

    it('clamps elemental resistance to [-1.0, 1.0]', () => {
      const overResist: AttributeModifier = {
        id: 'elemental_mastery',
        attributeKey: 'elementalResistance',
        phase: 'flat',
        apply: () => 5.0,
      };

      AttributeCalculator.registerModifier(overResist);
      expect(calculateAttribute(player, 'elementalResistance')).toBe(1.0);
    });

    it('applies custom cap modifiers', () => {
      const ironCeiling: AttributeModifier = {
        id: 'iron_ceiling',
        attributeKey: 'defense',
        phase: 'cap',
        apply: (val) => Math.min(val, 20),
      };

      AttributeCalculator.registerModifier(ironCeiling);

      // Set high defense modifier
      AttributeCalculator.registerModifier({
        id: 'titan_skin',
        attributeKey: 'defense',
        phase: 'flat',
        apply: (val) => val + 100,
      });

      expect(calculateAttribute(player, 'defense')).toBe(20);
    });
  });

  describe('Deterministic 4-Phase Pipeline Execution', () => {
    it('executes phases strictly in order: Base -> Flat -> Multiplier -> Cap', () => {
      // Base is 10
      // Phase 2 (Flat): +10 -> 20
      // Phase 3 (Multiplier): * 2 -> 40
      // Phase 4 (Cap): max 30 -> 30
      AttributeCalculator.registerModifier({
        id: 'test_cap',
        attributeKey: 'attack',
        phase: 'cap',
        apply: (val) => Math.min(val, 30),
      });

      AttributeCalculator.registerModifier({
        id: 'test_mult',
        attributeKey: 'attack',
        phase: 'multiplier',
        apply: (val) => val * 2,
      });

      AttributeCalculator.registerModifier({
        id: 'test_flat',
        attributeKey: 'attack',
        phase: 'flat',
        apply: (val) => val + 10,
      });

      // Even if registered out of phase order, calculateAttribute applies phases in order
      expect(calculateAttribute(player, 'attack')).toBe(30);
    });

    it('unregisters modifiers cleanly', () => {
      const mod: AttributeModifier = {
        id: 'temp_boost',
        attributeKey: 'attack',
        phase: 'flat',
        apply: (v) => v + 5,
      };
      AttributeCalculator.registerModifier(mod);
      expect(calculateAttribute(player, 'attack')).toBe(15);

      const removed = AttributeCalculator.unregisterModifier('temp_boost');
      expect(removed).toBe(true);
      expect(calculateAttribute(player, 'attack')).toBe(10);
    });

    it('routes Player and Monster getters to calculateAttribute', () => {
      const monster = new Monster({
        id: 'goblin-1',
        name: 'Goblin',
        position: { x: 2, y: 2 },
        stats: { hp: 15, maxHp: 15, attack: 6, defense: 2 },
      });

      expect(player.attack).toBe(10);
      expect(player.defense).toBe(5);
      expect(monster.attack).toBe(6);
      expect(monster.defense).toBe(2);

      AttributeCalculator.registerModifier({
        id: 'war_horn',
        attributeKey: 'attack',
        phase: 'flat',
        apply: (v) => v + 4,
      });

      expect(player.attack).toBe(14);
      expect(monster.attack).toBe(10);
    });
  });
});
