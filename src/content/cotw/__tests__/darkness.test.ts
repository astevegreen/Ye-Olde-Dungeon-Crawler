import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster } from '../../../engine';
import { WaitAction } from '../../../engine/actions/wait';
import { StatusHandlerRegistry } from '../../../engine/status/statusHandlers';
import { makeShopItem } from '../items/makeItem';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { cotwManifest } from '..';
import {
  createDarknessHook,
  darknessHandlers,
  DARK_SPAWN_CAP,
  DARK_SPAWN_INTERVAL,
  DARKNESS_STATUS,
  EMBOLDENED_STATUS,
  TORCHLIT_STATUS,
  type DarkFloor,
} from '../darkness';

const FLOOR = 7;
const DARK: DarkFloor[] = [{ floor: FLOOR, relitFlag: 'test:relit', enterMessage: 'The light here has been drunk.' }];

function buildEngine(floor = FLOOR) {
  for (const [id, handler] of Object.entries(darknessHandlers(DARK))) StatusHandlerRegistry.register(id, handler);
  const map = new GameMap(40, 40, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 20, y: 20 }, stats: { hp: 900, maxHp: 900, attack: 10, defense: 5 }, level: 7 });
  const engine = new GameEngine({ map, player, floor });
  engine.actionPipeline.registerHook(createDarknessHook(DARK));
  return { engine, player };
}

/** The farthest visible tile from the hero, in Chebyshev tiles. */
function sightReach(engine: GameEngine): number {
  engine.updateFov();
  let reach = 0;
  for (let y = 0; y < engine.map.height; y++) {
    for (let x = 0; x < engine.map.width; x++) {
      if (engine.fov.isVisible(x, y)) reach = Math.max(reach, Math.abs(x - engine.player.x), Math.abs(y - engine.player.y));
    }
  }
  return reach;
}

function goblin(engine: GameEngine, x: number, y: number): Monster {
  const monster = new Monster({
    id: `gob-${x}-${y}`,
    name: 'Goblin',
    position: { x, y },
    stats: { hp: 20, maxHp: 20, attack: 20, defense: 0 },
    aiType: 'melee',
    xpValue: 1,
    lootTable: [],
  });
  engine.addEntity(monster);
  return monster;
}

describe('dark floors', () => {
  afterAll(() => StatusHandlerRegistry.resetToDefaults());

  it('cut the hero\'s sight to 2, and say so once', () => {
    const { engine, player } = buildEngine();
    expect(sightReach(engine)).toBe(8);

    engine.handlePlayerAction(new WaitAction(player));
    engine.handlePlayerAction(new WaitAction(player));

    expect(player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(true);
    expect(sightReach(engine)).toBe(2);
    expect(engine.messages.filter((m) => m.includes('has been drunk'))).toHaveLength(1);
  });

  it('let a torch in the off hand see 5', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Torchbearer', { seed: 11 });
    const player = engine.player;
    player.inventory.paperdoll.unequip('offHand');
    expect(player.inventory.paperdoll.equip(makeShopItem('wooden_torch', 'torch-1'), 'offHand')).toMatchObject({ success: true });
    engine.changeFloor(FLOOR);
    engine.actionPipeline.registerHook(createDarknessHook(DARK));
    for (const [id, handler] of Object.entries(darknessHandlers(DARK))) engine.registries.statusHandlers.register(id, handler);

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.statusManager.hasStatus(TORCHLIT_STATUS)).toBe(true);
    expect(player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
    expect(sightReach(engine)).toBeLessThanOrEqual(5);
    expect(sightReach(engine)).toBeGreaterThan(2);
  });

  it('lift once relit, and leave other floors alone', () => {
    const { engine, player } = buildEngine();
    engine.handlePlayerAction(new WaitAction(player));
    engine.setWorldFlag('test:relit', true);
    engine.handlePlayerAction(new WaitAction(player));
    engine.handlePlayerAction(new WaitAction(player));

    expect(player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
    expect(sightReach(engine)).toBe(8);

    const lit = buildEngine(FLOOR + 1);
    lit.engine.handlePlayerAction(new WaitAction(lit.player));
    expect(lit.player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
  });

  it('embolden the monsters there: a quarter more attack', () => {
    const { engine, player } = buildEngine();
    const gob = goblin(engine, 30, 30);
    const before = gob.attack;

    engine.handlePlayerAction(new WaitAction(player));

    expect(gob.statusManager.hasStatus(EMBOLDENED_STATUS)).toBe(true);
    expect(gob.attack).toBe(Math.round(before * 1.25));
  });

  it('give up monsters out of the dark, awake and coming, up to a cap', () => {
    const { engine, player } = buildEngine();
    const count = () => engine.map.getAllEntities().filter((e) => e.id.startsWith('dark-')).length;

    for (let t = 0; t < DARK_SPAWN_INTERVAL * 30; t++) {
      engine.handlePlayerAction(new WaitAction(player));
      for (const m of engine.map.getAllEntities()) if (m.id.startsWith('dark-')) engine.removeEntity(m); // keep the hero alive
      if (t === DARK_SPAWN_INTERVAL * 4) expect(engine.worldState.counters[`cotw:dark_spawned_${FLOOR}`] ?? 0).toBeGreaterThan(0);
    }

    expect(count()).toBe(0);
    expect(engine.worldState.counters[`cotw:dark_spawned_${FLOOR}`]).toBe(DARK_SPAWN_CAP);
  });

  it('bring a spawned monster in beyond torchlight, hunting', () => {
    const { engine, player } = buildEngine();
    let spawned: Monster | undefined;
    for (let t = 0; t < DARK_SPAWN_INTERVAL * 20 && !spawned; t++) {
      engine.handlePlayerAction(new WaitAction(player));
      spawned = engine.map.getAllEntities().find((e): e is Monster => e instanceof Monster && e.id.startsWith('dark-'));
    }

    expect(spawned).toBeDefined();
    expect(spawned!.aiState).toBe('hunting');
    expect(spawned!.statusManager.hasStatus(EMBOLDENED_STATUS)).toBe(true);
  });
});
