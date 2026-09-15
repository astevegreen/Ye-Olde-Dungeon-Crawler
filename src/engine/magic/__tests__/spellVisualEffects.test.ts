import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { CastSpellAction } from '../../actions/spell-actions';
import { registerSpells, SPELL_REGISTRY } from '../spellRegistry';
import { COTW_SPELLS } from '../../../content/cotw/spells';
import { WARCRAFT_SPELLS } from '../../../content/warcraft/spells';
import type {
  ProjectileEffectDescriptor,
  BurstEffectDescriptor,
  ChainLinkEffectDescriptor,
} from '../../types/effects';

describe('Visual Effect Queue & Declarative FX Engine', () => {
  beforeEach(() => {
    registerSpells([...COTW_SPELLS, ...WARCRAFT_SPELLS]);
  });

  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) {
      delete SPELL_REGISTRY[key];
    }
  });

  function createCorridorEngine() {
    // 15x7 map with corridor along y=3
    const map = new GameMap(15, 7, TILES.WALL);
    for (let x = 1; x <= 13; x++) {
      map.setTile(x, 3, TILES.FLOOR);
    }
    const player = new Player({
      id: 'p-hero',
      name: 'Mage',
      position: { x: 2, y: 3 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    player.mana = 100;
    player.maxMana = 100;
    player.energy = 100;

    const engine = new GameEngine({ map, player });
    return { engine, map, player };
  }

  function createRoomEngine(width = 12, height = 12) {
    const map = new GameMap(width, height, TILES.FLOOR);
    for (let x = 0; x < width; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, height - 1, TILES.WALL);
    }
    for (let y = 0; y < height; y++) {
      map.setTile(0, y, TILES.WALL);
      map.setTile(width - 1, y, TILES.WALL);
    }
    const player = new Player({
      id: 'p-hero',
      name: 'Mage',
      position: { x: 3, y: 3 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    player.mana = 100;
    player.maxMana = 100;
    player.energy = 100;

    const engine = new GameEngine({ map, player });
    return { engine, map, player };
  }

  it('generates declarative linear Bresenham path for Magic Arrow projectile', () => {
    const { engine, player } = createCorridorEngine();

    const action = new CastSpellAction(player, 'magic_arrow', 8, 3);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.effects).toBeDefined();
    expect(result.effects?.length).toBeGreaterThanOrEqual(1);

    const proj = result.effects?.find((e) => e.type === 'projectile') as ProjectileEffectDescriptor;
    expect(proj).toBeDefined();
    expect(proj.type).toBe('projectile');
    expect(proj.color).toBe('#60a5fa');
    expect(proj.travelMode).toBe('smooth');
    expect(proj.stepDelayMs).toBe(22);

    // Verify Bresenham discrete path along hallway y=3 from x=3 to x=8
    expect(proj.path.length).toBe(6);
    expect(proj.path[0]).toEqual({ x: 3, y: 3 });
    expect(proj.path[proj.path.length - 1]).toEqual({ x: 8, y: 3 });
    for (let i = 0; i < proj.path.length; i++) {
      expect(proj.path[i].x).toBe(3 + i);
      expect(proj.path[i].y).toBe(3);
    }
  });

  it('generates wall reflection flags in projectile path for Lightning Bolt', () => {
    const { engine, player, map } = createRoomEngine(12, 12);
    // Player at (2, 6), aim diagonally at top wall (8, 0)
    player.setPosition(2, 6);

    const action = new CastSpellAction(player, 'lightning_bolt', 8, 0);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.effects).toBeDefined();

    const proj = result.effects?.find((e) => e.type === 'projectile') as ProjectileEffectDescriptor;
    expect(proj).toBeDefined();
    expect(proj.color).toBe('#facc15');

    // Verify wall reflection flags exist in the path
    const reflectionPoints = proj.path.filter((p) => p.isReflection);
    expect(reflectionPoints.length).toBeGreaterThanOrEqual(1);

    // CRITICAL: Ensure no points in the path enter a wall tile
    for (const pt of proj.path) {
      const tile = map.getTile(pt.x, pt.y);
      expect(tile?.passable).toBe(true);
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.x).toBeLessThan(11);
      expect(pt.y).toBeGreaterThan(0);
      expect(pt.y).toBeLessThan(11);
    }
  });

  it('generates sequential projectile and explosive burst descriptors for Fireball', () => {
    const { engine, player } = createRoomEngine(12, 12);

    const action = new CastSpellAction(player, 'fireball', 7, 7);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.effects).toBeDefined();
    expect(result.effects?.length).toBe(2);

    // 1st: Projectile leading to epicenter
    const proj = result.effects?.[0] as ProjectileEffectDescriptor;
    expect(proj.type).toBe('projectile');
    expect(proj.color).toBe('#ef4444');
    expect(proj.path[proj.path.length - 1].x).toBe(7);
    expect(proj.path[proj.path.length - 1].y).toBe(7);

    // 2nd: Area burst descriptor centered at (7, 7)
    const burst = result.effects?.[1] as BurstEffectDescriptor;
    expect(burst.type).toBe('burst');
    expect(burst.epicenter).toEqual({ x: 7, y: 7 });
    expect(burst.radius).toBe(1);
    expect(burst.color).toBe('#ef4444');
    expect(burst.style).toBe('flame');
    expect(burst.durationMs).toBe(280);
  });

  it('generates multi-hop chain link descriptors for Chain Lightning', () => {
    const { engine, player, map } = createRoomEngine(15, 15);
    player.setPosition(2, 5);

    const target1 = new Monster({
      id: 'm-target1',
      name: 'Goblin Alpha',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 4, defense: 0 },
    });
    const target2 = new Monster({
      id: 'm-target2',
      name: 'Goblin Beta',
      position: { x: 7, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 4, defense: 0 },
    });
    const target3 = new Monster({
      id: 'm-target3',
      name: 'Goblin Gamma',
      position: { x: 9, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 4, defense: 0 },
    });
    map.addEntity(target1);
    map.addEntity(target2);
    map.addEntity(target3);

    const action = new CastSpellAction(player, 'chain_lightning', 5, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.effects).toBeDefined();

    // Initial ray to target 1 + chain links between subsequent hops
    const chainLinks = result.effects?.filter((e) => e.type === 'chain_link') as ChainLinkEffectDescriptor[];
    expect(chainLinks.length).toBeGreaterThanOrEqual(2);

    // Check first chain link: target1 -> target2
    expect(chainLinks[0].from).toEqual({ x: 5, y: 5 });
    expect(chainLinks[0].to).toEqual({ x: 7, y: 5 });
    expect(chainLinks[0].color).toBe('#38bdf8');
    expect(chainLinks[0].durationMs).toBe(160);

    // Check second chain link: target2 -> target3
    expect(chainLinks[1].from).toEqual({ x: 7, y: 5 });
    expect(chainLinks[1].to).toEqual({ x: 9, y: 5 });
    expect(chainLinks[1].durationMs).toBe(160);
  });

  it('generates self-buff burst aura descriptor for Holy Light', () => {
    const { engine, player } = createRoomEngine(10, 10);
    player.setPosition(4, 4);

    const action = new CastSpellAction(player, 'holy_light', 4, 4);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.effects).toBeDefined();

    const burst = result.effects?.find((e) => e.type === 'burst') as BurstEffectDescriptor;
    expect(burst).toBeDefined();
    expect(burst.epicenter).toEqual({ x: 4, y: 4 });
    expect(burst.radius).toBe(1);
    expect(burst.color).toBe('#fef08a');
    expect(burst.durationMs).toBe(240);
  });

  it('buffers effects in GameEngine and clears them on consumePendingVisualEffects', () => {
    const { engine, player } = createCorridorEngine();

    const effectSpy = vi.fn();
    engine.onVisualEffect = effectSpy;

    player.energy = 100;
    const action = new CastSpellAction(player, 'magic_arrow', 7, 3);
    const res = engine.handlePlayerAction(action);

    expect(res.success).toBe(true);
    expect(effectSpy).toHaveBeenCalled();
    expect(engine.pendingVisualEffects.length).toBeGreaterThanOrEqual(1);

    const consumed = engine.consumePendingVisualEffects();
    expect(consumed.length).toBeGreaterThanOrEqual(1);
    expect(consumed[0].type).toBe('projectile');
    expect(engine.pendingVisualEffects.length).toBe(0);
  });

  it('executes 1,000 instant-mode casts headlessly, each producing exactly one effect descriptor', () => {
    const { engine, player } = createCorridorEngine();

    // The wall-clock budget for this workload lives in `npm run sim` (scripts/headless-sim.ts).
    for (let i = 0; i < 1000; i++) {
      player.mana = 100;
      const action = new CastSpellAction(player, 'magic_arrow', 8, 3);
      const result = action.perform(engine);
      expect(result.success).toBe(true);
      expect(result.effects?.length).toBe(1);
    }
  });
});
