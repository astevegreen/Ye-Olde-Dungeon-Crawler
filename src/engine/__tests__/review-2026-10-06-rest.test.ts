import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { AutoRestManager } from '../actions/autoRest';
import { ChannelRuneOfReturnAction, RuneOfReturnItem } from '../magic/runeOfReturn';

/**
 * Whole-codebase review, 2026-10-06, Phase C1: one rest. The R key ran an atomic 100-turn
 * `RestAction` and the Rest button ran `stepRestTurn` outside the pipeline; now both run
 * `AutoRestManager`, a `RestTurnAction` per turn through `handlePlayerAction`
 * (`executeFullRest` is that rest without the UI's pacing).
 */

describe('R-rend-1 · the R key’s rest rests the hero to death under unseen fire', () => {
  it('a hit from an archer out of sight stops the rest before the hero dies', () => {
    const map = new GameMap(20, 9, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 3, y: 4 }, stats: { hp: 40, maxHp: 400, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 3 });
    player.statusManager.applyStatus({ type: 'blindness', duration: 200 });
    const archer = new Monster({
      id: 'archer',
      name: 'Archer',
      position: { x: 7, y: 4 },
      stats: { hp: 30, maxHp: 30, attack: 8, defense: 0 },
      aiType: 'caster',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 1,
      lootTable: [],
    });
    engine.addEntity(archer);
    engine.updateFov();
    expect(engine.fov.isVisible(archer.x, archer.y)).toBe(false);
    const t0 = engine.turnCount;

    AutoRestManager.executeFullRest(engine);

    expect(player.isAlive()).toBe(true);
    expect(engine.turnCount - t0).toBeLessThan(10);
  });
});

describe('R-pipe-15 · resting does not break a Rune of Return channel', () => {
  it('a rest begun mid-channel cancels it, and the hero stays on the floor', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 2, y: 2 }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 } });
    player.hasDiscoveredRune = true;
    player.hp = 50;
    player.inventory.primaryPack.addItem(new RuneOfReturnItem({ id: 'rune-1', name: 'Rune of Return' } as never));
    const engine = new GameEngine({ map, player, floor: 3 });
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    AutoRestManager.executeFullRest(engine);

    expect(engine.currentFloor).toBe(3);
  });
});

describe('R-ai-3 · the world stands still while the hero rests', () => {
  it('a fire elsewhere on the floor burns out over a long rest', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 2, y: 2 }, stats: { hp: 10, maxHp: 50, attack: 5, defense: 0 } });
    const engine = new GameEngine({ map, player, floor: 1, seed: 5 });
    player.mana = player.maxMana;
    engine.surfaces.setSurface(10, 10, 'fire', 5);

    const result = AutoRestManager.executeFullRest(engine);

    expect(result.turn).toBeGreaterThan(5);
    expect(engine.surfaces.getCell(10, 10)?.surface?.type).not.toBe('fire');
  });
});
