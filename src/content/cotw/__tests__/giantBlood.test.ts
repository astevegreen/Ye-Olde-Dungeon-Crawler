import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../../engine';
import { WaitAction } from '../../../engine/actions/wait';
import { GIANT_BLOOD_STATUS, giantBloodHandler, GIANT_BLOOD_BOOTSTRAP_HOOK } from '../giantBlood';
import { StatusHandlerRegistry } from '../../../engine/status/statusHandlers';

function buildEngine(floor: number) {
  StatusHandlerRegistry.register(GIANT_BLOOD_STATUS, giantBloodHandler);
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 200, maxHp: 200, attack: 10, defense: 5 },
    level: 1,
  });
  const engine = new GameEngine({ map, player, floor });
  engine.actionPipeline.registerHook(GIANT_BLOOD_BOOTSTRAP_HOOK);
  return { engine, player };
}

describe("Giant's Blood heritage buff (Act 1, replaces the old permafrost/obsidian hazard)", () => {
  afterAll(() => {
    StatusHandlerRegistry.resetToDefaults();
  });

  it('applies itself to the player on the first action and never re-applies', () => {
    const { engine, player } = buildEngine(3);
    expect(player.statusManager.hasStatus(GIANT_BLOOD_STATUS)).toBe(false);

    engine.handlePlayerAction(new WaitAction(player));
    expect(player.statusManager.hasStatus(GIANT_BLOOD_STATUS)).toBe(true);

    engine.handlePlayerAction(new WaitAction(player));
    expect(player.statusManager.getAll().filter((e) => e.type === GIANT_BLOOD_STATUS)).toHaveLength(1);
  });

  it('grants +3 attack / +3 defense on floors 1-9 (Rime Hollows)', () => {
    const { engine, player } = buildEngine(3);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.attack).toBe(baseAttack + 3);
    expect(player.defense).toBe(baseDefense + 3);
  });

  it('grants +2 attack / +2 defense on floors 10-17 (Abandoned Dwarven Works)', () => {
    const { engine, player } = buildEngine(12);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.attack).toBe(baseAttack + 2);
    expect(player.defense).toBe(baseDefense + 2);
  });

  it('grants +1 attack / +1 defense on floors 18-25 (Obsidian Siphon)', () => {
    const { engine, player } = buildEngine(20);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.attack).toBe(baseAttack + 1);
    expect(player.defense).toBe(baseDefense + 1);
  });

  it('removes itself once Act 2 begins (floor 26), dropping the bonus back to zero', () => {
    const { engine, player } = buildEngine(26);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.statusManager.hasStatus(GIANT_BLOOD_STATUS)).toBe(false);
    expect(player.attack).toBe(baseAttack);
    expect(player.defense).toBe(baseDefense);
  });

  it('never deals damage on any floor — the old damage-over-time hazard is gone', () => {
    const { engine, player } = buildEngine(3);
    const startHp = player.hp;

    for (let i = 0; i < 30; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }

    expect(player.hp).toBe(startHp);
  });
});
