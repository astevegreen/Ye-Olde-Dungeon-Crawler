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
import { Actor } from '../entities/actor';

const OVERBURDENED_HINT = 'You are overburdened and cannot move. Drop something to lighten your pack.';

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
    expect(result.cost).toBe(0);
    expect(result.message).toBe(OVERBURDENED_HINT);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });

  describe('the overburdened hint', () => {
    function immobilizedHero() {
      const map = GameMap.createBoxRoom(10, 10);
      const player = new Player({ position: { x: 5, y: 5 }, strength: 10 });
      const engine = new GameEngine({ map, player });
      const boulder = new Item({ id: 'boulder-1', name: 'Heavy Boulder', category: 'misc', weight: 26000, bulk: 5000 });
      player.inventory.primaryPack.addItem(boulder);
      player.gainEnergy(300);
      const hints = () => engine.messages.filter((m) => m === OVERBURDENED_HINT).length;
      return { engine, player, boulder, hints };
    }

    it('is logged once however often the hero tries to move', () => {
      const { engine, player, hints } = immobilizedHero();
      const turn = engine.turnCount;
      const results = [1, 2, 3].map(() => new MovementAction(player, 1, 0).perform(engine));

      expect(hints()).toBe(1);
      expect(results[0].message).toBe(OVERBURDENED_HINT);
      for (const result of results) {
        expect(result.success).toBe(false);
        expect(result.cost).toBe(0);
      }
      expect(results[1].message).toBeUndefined();
      expect(results[2].message).toBeUndefined();
      expect(engine.turnCount).toBe(turn);
      expect(player.x).toBe(5);
    });

    it('is not logged again by presentation on a repeated attempt', () => {
      const { engine, player, hints } = immobilizedHero();
      for (let i = 0; i < 3; i++) {
        engine.log('Something else happens.');
        const result = engine.handlePlayerAction(new MovementAction(player, 1, 0));
        // runAndExplain (src/ui/actionFeedback.ts) logs a failed result's message again.
        if (!result.success && result.message && engine.messages.at(-1) !== result.message) engine.log(result.message);
      }
      expect(hints()).toBe(1);
    });

    it('shows again once the hero could move and is then immobilized again', () => {
      const { engine, player, boulder, hints } = immobilizedHero();
      new MovementAction(player, 1, 0).perform(engine);
      new MovementAction(player, 1, 0).perform(engine);
      expect(hints()).toBe(1);

      player.inventory.primaryPack.removeItem(boulder.id);
      expect(player.canMove()).toBe(true);
      expect(new MovementAction(player, 1, 0).perform(engine).success).toBe(true);

      player.inventory.primaryPack.addItem(boulder);
      player.gainEnergy(300);
      const result = new MovementAction(player, 1, 0).perform(engine);
      expect(result.message).toBe(OVERBURDENED_HINT);
      expect(hints()).toBe(2);
    });

    it('is not shown while the burden has not cleared in between', () => {
      const { engine, player, hints } = immobilizedHero();
      new MovementAction(player, 1, 0).perform(engine);
      new MovementAction(player, -1, 0).perform(engine);
      new MovementAction(player, 0, 1).perform(engine);
      expect(hints()).toBe(1);
    });

    it('never blames the pack when the hero is held for another reason', () => {
      const map = GameMap.createBoxRoom(10, 10);
      const player = new Player({ position: { x: 5, y: 5 } });
      const engine = new GameEngine({ map, player });
      player.capabilities.canMove = false;
      player.gainEnergy(300);
      const first = new MovementAction(player, 1, 0).perform(engine);
      const second = new MovementAction(player, 1, 0).perform(engine);

      expect(engine.messages.filter((m) => m === OVERBURDENED_HINT)).toHaveLength(0);
      expect(first.message).toBe(`${player.name} is overburdened and cannot move!`);
      expect(second.message).toBe(first.message);
      expect(second.cost).toBe(0);
    });

    it('leaves a monster that cannot move as it was: told every time', () => {
      const map = GameMap.createBoxRoom(10, 10);
      const player = new Player({ position: { x: 2, y: 2 } });
      const engine = new GameEngine({ map, player });
      const totem = new Actor({
        id: 'totem',
        name: 'Totem',
        type: 'monster',
        faction: 'hostile',
        position: { x: 6, y: 6 },
        stats: { hp: 30, maxHp: 30, attack: 0, defense: 5 },
        capabilities: { canMove: false },
      });
      map.addEntity(totem);
      const first = new MovementAction(totem, 1, 0).perform(engine);
      const second = new MovementAction(totem, 1, 0).perform(engine);
      expect(first.message).toBe('Totem is overburdened and cannot move!');
      expect(second.message).toBe('Totem is overburdened and cannot move!');
      expect(second.cost).toBe(0);
    });
  });
});
