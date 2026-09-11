import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { ItemFactory } from '../../items/factory';
import { DwarvenWinch } from '../dwarvenWinch';

describe('DwarvenWinch Mechanic', () => {
  function createTestEngine(floor = 10) {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 80, maxHp: 80, attack: 6, defense: 2 },
      strength: 15,
    });
    const engine = new GameEngine({ map, player, floor });
    return { engine, player };
  }

  it('calculates target weight and tolerance based on player body + gear weight', () => {
    const { player } = createTestEngine();
    const winch = new DwarvenWinch(10, { x: 5, y: 5 });

    const carried = player.inventory.totalWeight();
    const expectedPlayerTotal = 70000 + carried;
    const expectedTarget = Math.floor(expectedPlayerTotal * 1.5);

    const evalRes = winch.evaluateBalance(player);
    expect(evalRes.playerWeight).toBe(expectedPlayerTotal);
    expect(evalRes.targetWeight).toBe(expectedTarget);
    expect(evalRes.tolerance).toBe(1500);
    expect(evalRes.status).toBe('underweight'); // 0g in hopper
  });

  it('allows depositing and retrieving items from the hopper', () => {
    const { player } = createTestEngine();
    const winch = new DwarvenWinch(10, { x: 5, y: 5 });

    const stone = ItemFactory.createScrapCobblestone('ballast-test-1', 4000);
    player.inventory.primaryPack.addItem(stone);
    expect(player.inventory.primaryPack.hasItem('ballast-test-1')).toBe(true);

    const depositOk = winch.depositItem(player, 'ballast-test-1');
    expect(depositOk).toBe(true);
    expect(player.inventory.primaryPack.hasItem('ballast-test-1')).toBe(false);
    expect(winch.getHopperWeight()).toBe(4000);

    const retrieveOk = winch.retrieveItem(player, 'ballast-test-1');
    expect(retrieveOk).toBe(true);
    expect(player.inventory.primaryPack.hasItem('ballast-test-1')).toBe(true);
    expect(winch.getHopperWeight()).toBe(0);
  });

  it('pulling lever when balanced teleports player directly to Bjarnarhaven town square (Floor 0, x:25, y:14)', () => {
    const { engine, player } = createTestEngine(10);
    const winch = new DwarvenWinch(10, { x: 5, y: 5 });

    const evalBefore = winch.evaluateBalance(player);
    // Add ballast exactly matching target
    const ballast = ItemFactory.createScrapCobblestone('ballast-exact', evalBefore.targetWeight);
    winch.hopper.addItem(ballast);

    const evalAfter = winch.evaluateBalance(player);
    expect(evalAfter.status).toBe('balanced');

    const result = winch.pullLever(engine);
    expect(result.success).toBe(true);
    expect(result.balanced).toBe(true);
    expect(engine.currentFloor).toBe(0);
    expect(player.x).toBe(25);
    expect(player.y).toBe(14);
  });

  it('pulling lever when imbalanced results in cable slip, halfway ascent, and fall damage', () => {
    const { engine, player } = createTestEngine(10);
    const winch = new DwarvenWinch(10, { x: 5, y: 5 });

    // Empty hopper -> underweight
    const initialHp = player.hp;
    const result = winch.pullLever(engine);

    expect(result.success).toBe(true);
    expect(result.balanced).toBe(false);
    // Halved ascent: Floor 10 -> Floor 5
    expect(engine.currentFloor).toBe(5);
    // 10% fall damage: 80 maxHp * 0.10 = 8 HP
    expect(player.hp).toBe(initialHp - 8);
  });

  it('computes accurate delta in evaluateBalance for underweight, balanced, and overweight states', () => {
    const { player } = createTestEngine(7);
    const winch = new DwarvenWinch(7, { x: 5, y: 5 });

    // Underweight (empty hopper)
    const evalUnder = winch.evaluateBalance(player);
    expect(evalUnder.status).toBe('underweight');
    expect(evalUnder.delta).toBe(-evalUnder.targetWeight);

    // Balanced (exact target weight)
    const exactBallast = ItemFactory.createScrapCobblestone('ballast-exact-weight', evalUnder.targetWeight);
    winch.hopper.addItem(exactBallast);
    const evalBal = winch.evaluateBalance(player);
    expect(evalBal.status).toBe('balanced');
    expect(evalBal.delta).toBe(0);

    // Overweight (extra 5,000g)
    const excessBallast = ItemFactory.createScrapCobblestone('ballast-excess', 5000);
    winch.hopper.addItem(excessBallast);
    const evalOver = winch.evaluateBalance(player);
    expect(evalOver.status).toBe('overweight');
    expect(evalOver.delta).toBe(5000);
  });

  it('ensures Floor 7 down-stairs to Floor 8 remain intact and unobstructed', () => {
    const { engine } = createTestEngine(7);
    engine.map.setTile(20, 20, TILES.STAIRS_DOWN);

    const winch = new DwarvenWinch(7, { x: 5, y: 5 });
    const evalRes = winch.evaluateBalance(engine.player);
    expect(evalRes.status).toBe('underweight');

    // Winch sitting in secondary alcove does not obstruct down-stairs
    const stairs = engine.map.getTile(20, 20);
    expect(stairs?.type).toBe('stairs_down');
    expect(stairs?.passable).toBe(true);
  });
});
