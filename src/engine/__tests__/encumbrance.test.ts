import { describe, it, expect } from 'vitest';
import {
  EncumbranceLevel,
  getMaxCarryWeight,
  getEncumbranceLevel,
  calculateEncumberedActionCost,
} from '../inventory/encumbrance';
import { Player } from '../entities/player';
import { ItemFactory } from '../items/factory';
import { Item } from '../items/item';
import { MovementAction } from '../actions/movement';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';

describe('Encumbrance System', () => {
  it('calculates max carrying weight based on strength (2500g per strength)', () => {
    expect(getMaxCarryWeight(10)).toBe(25000); // 25kg
    expect(getMaxCarryWeight(15)).toBe(37500); // 37.5kg
    expect(getMaxCarryWeight(20)).toBe(50000); // 50kg
  });

  it('determines encumbrance level tiers correctly', () => {
    const strength = 10; // Max = 25000g
    // <= 50% (<= 12500g) -> Unencumbered
    expect(getEncumbranceLevel(5000, strength)).toBe(EncumbranceLevel.Unencumbered);
    expect(getEncumbranceLevel(12500, strength)).toBe(EncumbranceLevel.Unencumbered);

    // 50% - 75% (12501g - 18750g) -> Burdened
    expect(getEncumbranceLevel(12501, strength)).toBe(EncumbranceLevel.Burdened);
    expect(getEncumbranceLevel(18750, strength)).toBe(EncumbranceLevel.Burdened);

    // 75% - 100% (18751g - 25000g) -> Overburdened
    expect(getEncumbranceLevel(18751, strength)).toBe(EncumbranceLevel.Overburdened);
    expect(getEncumbranceLevel(25000, strength)).toBe(EncumbranceLevel.Overburdened);

    // > 100% (> 25000g) -> Immobilized
    expect(getEncumbranceLevel(25001, strength)).toBe(EncumbranceLevel.Immobilized);
  });

  it('applies progressive action energy penalties', () => {
    const baseCost = 100;
    expect(calculateEncumberedActionCost(baseCost, EncumbranceLevel.Unencumbered)).toBe(100);
    expect(calculateEncumberedActionCost(baseCost, EncumbranceLevel.Burdened)).toBe(125); // +25%
    expect(calculateEncumberedActionCost(baseCost, EncumbranceLevel.Overburdened)).toBe(160); // +60%
    expect(calculateEncumberedActionCost(baseCost, EncumbranceLevel.Immobilized)).toBe(250); // +150%
  });

  it('dynamically updates player stats and encumbrance action cost when items are added', () => {
    const player = new Player({
      position: { x: 5, y: 5 },
      strength: 10, // Max carry = 25000g
    });

    // Base player stats
    expect(player.attack).toBe(6);
    expect(player.defense).toBe(2);

    // Initial pack weighs 1200g (Unencumbered)
    expect(player.inventory.getEncumbrance(player.strength)).toBe(EncumbranceLevel.Unencumbered);
    expect(player.getActionCost(100)).toBe(100);

    // Equip broadsword (+8 attack)
    const sword = ItemFactory.createBroadsword('sw-1');
    player.inventory.primaryPack.addItem(sword);
    player.inventory.equipFromPack('sw-1');
    expect(player.attack).toBe(14); // 6 + 8 = 14

    // Equip iron chainmail (+8 defense, 12000g)
    const chainmail = ItemFactory.createChainmail('cm-1');
    player.inventory.primaryPack.addItem(chainmail);
    player.inventory.equipFromPack('cm-1');
    expect(player.defense).toBe(10); // 2 + 8 = 10

    // Weight is now 1200 (pack) + 1600 (sword) + 12000 (armor) = 14800g
    // 14800 / 25000 = 59.2% -> Burdened
    expect(player.inventory.getEncumbrance(player.strength)).toBe(EncumbranceLevel.Burdened);
    expect(player.getActionCost(100)).toBe(125);
  });

  it('prevents player movement when Immobilized', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({
      position: { x: 5, y: 5 },
      strength: 10, // Max carry 25000g
    });
    const engine = new GameEngine({ map, player });

    // Add 30kg of boulders into player's pack -> over 25kg max
    const boulder = new Item({
      id: 'boulder-1',
      name: 'Heavy Boulder',
      category: 'misc',
      weight: 26000,
      bulk: 5000,
    });
    player.inventory.primaryPack.addItem(boulder);

    expect(player.inventory.getEncumbrance(player.strength)).toBe(EncumbranceLevel.Immobilized);
    expect(player.canMove()).toBe(false);

    player.gainEnergy(300);
    const moveAction = new MovementAction(player, 1, 0);
    const result = moveAction.perform(engine);

    expect(result.success).toBe(false);
    expect(result.message).toContain('overburdened and cannot move');
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });
});
