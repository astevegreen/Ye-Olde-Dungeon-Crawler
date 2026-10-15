import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { TILES } from '../grid/tile';
import { MovementAction } from '../actions/movement';
import type { GameContentManifest } from '../types/manifest';
import type { SurfaceBehaviourTable } from '../surfaces/surfaceBehaviours';

// A pack's surface and gas behaviours (P-32): new types, and replacements for built-in ones.
function setup(surfaceBehaviours?: SurfaceBehaviourTable) {
  const map = new GameMap(12, 12);
  map.fill(TILES.FLOOR);
  const player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 } });
  map.addEntity(player);
  const manifest = surfaceBehaviours ? ({ id: 'test', name: 'Test', surfaceBehaviours } as unknown as GameContentManifest) : undefined;
  const engine = new GameEngine({ map, player, manifest });
  return { engine, map, player };
}

const DARKNESS: SurfaceBehaviourTable = {
  gases: {
    darkness: {
      blocksSight: true,
      enter: { status: { type: 'blindness', duration: 2 }, line: '{name} steps into the dark.' },
      standing: { status: { type: 'blindness', duration: 2 } },
    },
  },
};

describe('pack surface and gas behaviours', () => {
  it('a pack gas laid with its rule blocks sight, and blinds whoever stands in it', () => {
    const { engine, map, player } = setup(DARKNESS);
    engine.surfaces.layGas(engine, 3, 3, 'darkness', 5);
    expect(map.isTransparent(3, 3)).toBe(false);
    engine.surfaces.tick(engine);
    expect(player.statusManager.hasStatus('blindness')).toBe(true);
  });

  it('it blinds on stepping in too, through a real move', () => {
    const { engine, player } = setup(DARKNESS);
    engine.surfaces.layGas(engine, 4, 3, 'darkness', 5);
    new MovementAction(player, 1, 0).perform(engine);
    expect(player.statusManager.hasStatus('blindness')).toBe(true);
    expect(engine.messages).toContain('Adventurer steps into the dark.');
  });

  it('the stamped sight rule survives a save, with no table to read', () => {
    const { engine } = setup(DARKNESS);
    engine.surfaces.layGas(engine, 3, 3, 'darkness', 5);
    const saved = engine.surfaces.serialize();
    const other = setup();
    other.engine.surfaces.deserialize(saved);
    expect(other.engine.surfaces.isTransparent(3, 3)).toBe(false);
  });

  it('a gas laid with no rule, or with no table, is no wall', () => {
    const { engine } = setup();
    engine.surfaces.layGas(engine, 3, 3, 'darkness', 5);
    expect(engine.surfaces.isTransparent(3, 3)).toBe(true);
    expect(engine.surfaces.getCell(3, 3)?.gas?.blocksSight).toBeUndefined();
  });

  it('a built-in gas laid with its built-in rule carries no stamp', () => {
    const { engine } = setup(DARKNESS);
    engine.surfaces.layGas(engine, 3, 3, 'dense_steam', 5);
    expect(engine.surfaces.isTransparent(3, 3)).toBe(false);
    expect(engine.surfaces.getCell(3, 3)?.gas?.blocksSight).toBeUndefined();
  });

  it('a pack entry replaces a built-in one: thin steam, stronger acid', () => {
    const { engine, player } = setup({
      gases: { dense_steam: {} },
      surfaces: {
        acid_pool: { standing: { harm: { amount: 7, element: 'acid', cause: 'acid', line: '{name} melts for {n}.' } } },
      },
    });
    engine.surfaces.layGas(engine, 5, 5, 'dense_steam', 5);
    expect(engine.surfaces.isTransparent(5, 5)).toBe(true);

    engine.surfaces.setSurface(3, 3, 'acid_pool', 5);
    expect(engine.surfaces.handleEntityStep(player, 3, 3, 0, 0, engine)).toEqual({ slid: false, energyPenalty: 0 });
    expect(player.hp).toBe(50); // the pack's acid has no entering hurt
    engine.surfaces.tick(engine);
    expect(player.hp).toBe(43);
    expect(engine.messages).toContain('Adventurer melts for 7.');
  });

  it('a hurt of any element goes through affinity and names its element', () => {
    const { engine, player } = setup({
      surfaces: { bog: { standing: { harm: { amount: 4, element: 'poison', cause: 'a bog', line: '{name} chokes for {n}.' } } } },
    });
    player.elementalResistances.poison = 'immune';
    engine.surfaces.setSurface(3, 3, 'bog', 5);
    engine.surfaces.tick(engine);
    expect(player.hp).toBe(50);
    expect(engine.messages).toContain('Adventurer is unharmed by the poison.');
  });

  it('entering adds the surface and gas costs, and a slide skips the gas left behind', () => {
    const { engine, player } = setup({
      surfaces: { tar: { enter: { moveCost: 30 } } },
      gases: { haze: { enter: { moveCost: 20 } }, gale: { enter: { line: 'gale' } } },
    });
    engine.surfaces.setSurface(3, 3, 'tar', 5);
    engine.surfaces.setGas(3, 3, 'haze', 5);
    expect(engine.surfaces.handleEntityStep(player, 3, 3, 1, 0, engine).energyPenalty).toBe(50);

    engine.surfaces.setSurface(6, 3, 'ice_sheet', 5);
    engine.surfaces.setGas(6, 3, 'gale', 5);
    engine.map.moveEntity(player, 6, 3);
    const before = engine.messages.length;
    engine.surfaces.handleEntityStep(player, 6, 3, 1, 0, engine);
    expect(player.x).toBe(8);
    expect(engine.messages.slice(before)).not.toContain('gale');
  });
});
