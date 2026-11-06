import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine, GameMap, TILES, Player, activateRegistries } from '../../../engine';
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
    activateRegistries(null);
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

  // Each band's first and last floor: Rime Hollows 1-9 (+3), Dwarven Works 10-17 (+2),
  // Obsidian Siphon 18-25 (+1).
  it.each([
    [1, 3], [9, 3],
    [10, 2], [17, 2],
    [18, 1], [25, 1],
  ])('on floor %i grants +%i attack and defense', (floor, bonus) => {
    const { engine, player } = buildEngine(floor);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.attack).toBe(baseAttack + bonus);
    expect(player.defense).toBe(baseDefense + bonus);
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

  it('says it is gone once past floor 26, not on every turn after', () => {
    const { engine, player } = buildEngine(27);
    player.statusManager.applyStatus({ type: GIANT_BLOOD_STATUS, duration: 9999 });

    for (let i = 0; i < 10; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }

    expect(engine.messages.filter((m) => m.includes('gutters out'))).toHaveLength(1);
    expect(player.statusManager.hasStatus(GIANT_BLOOD_STATUS)).toBe(false);
  });

  it('tells its fading once a run, though a trip home stirs the blood again', () => {
    const { engine, player } = buildEngine(27);
    for (let trip = 0; trip < 3; trip++) {
      // What the bootstrap does in town, before the hero walks back down.
      player.statusManager.applyStatus({ type: GIANT_BLOOD_STATUS, duration: 9999 });
      engine.handlePlayerAction(new WaitAction(player));
    }

    expect(engine.messages.filter((m) => m.includes('gutters out'))).toHaveLength(1);
    expect(engine.messages.filter((m) => m.includes('blood of Thrym stirs'))).toHaveLength(0);
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
