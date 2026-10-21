import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import type { ItemModifier } from '../../items/modifiers';
import { MovementAction } from '../movement';
import type { ChoiceDefinition } from '../../types/choice';
import type { GameContentManifest } from '../../types/manifest';
import type { SurfaceBehaviourTable } from '../../surfaces/surfaceBehaviours';

/**
 * A step's tile reactions (stairs line, learning stone, altar rite, tile choice) belong to the
 * tile the hero ends the step on: a Trickster's fling or an ice slide may carry them past the
 * tile they stepped onto (sprint B7).
 */

const SHRINE: ChoiceDefinition = {
  id: 'test_shrine',
  title: 'The Test Shrine',
  description: 'A shrine for testing.',
  options: [{ id: 'accept', label: 'Accept', consequences: [{ type: 'setFlag', flag: 'accepted', value: true }] }],
  cancelable: true,
};

const TRICKSTER: ItemModifier = {
  id: 'c-trickster',
  name: "Trickster's Step",
  alignment: 'chaotic',
  category: 'chaotic',
  blinkEverySteps: 10,
  blinkRange: [2, 4],
};

const EMBERS: SurfaceBehaviourTable = {
  surfaces: { test_embers: { enter: { harm: { amount: 5, element: 'fire', cause: 'embers', line: '{name} lands in embers for {n}.' } } } },
};

function setup(surfaceBehaviours?: SurfaceBehaviourTable) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 0 } });
  const manifest = { id: 'test', name: 'Test', choices: { test_shrine: SHRINE }, surfaceBehaviours } as unknown as GameContentManifest;
  const engine = new GameEngine({ map, player, manifest });
  engine.registries.tiles.register({ type: 'test_shrine', name: 'Test Shrine', passable: true, walkable: true, transparent: true, glyph: '?', interactionHandlerId: 'test_shrine' });
  const onChoice = vi.fn();
  engine.onChoiceInteract = onChoice;
  return { engine, map, player, onChoice };
}

/** The hero wears a Trickster's piece whose next step is the tenth: it flings. */
function armFling(engine: GameEngine, player: Player): void {
  const ring = new Item({ id: 'ring', name: 'Ring', category: 'ring', slot: 'fingerLeft', weight: 100, bulk: 100, identified: true });
  ring.addModifier(TRICKSTER);
  player.inventory.paperdoll.equip(ring, 'fingerLeft');
  engine.modifyWorldCounter(`steps:${TRICKSTER.id}`, 9);
}

const SHRINE_TILE = { ...TILES.FLOOR, type: 'test_shrine', interactionHandlerId: 'test_shrine' } as unknown as typeof TILES.FLOOR;
const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const stairsLine = (engine: GameEngine) => engine.messages.some((m) => /You stand upon stairs leading down/.test(m));

describe("a Trickster's fling: the step's tile is the landing tile", () => {
  it('a choice on the stepped-on tile does not open after the fling', () => {
    const { engine, map, player, onChoice } = setup();
    map.setTile(6, 5, SHRINE_TILE);
    armFling(engine, player);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    const d = chebyshev(player, { x: 6, y: 5 });
    expect(d).toBeGreaterThanOrEqual(2);
    expect(d).toBeLessThanOrEqual(4);
    expect(onChoice).not.toHaveBeenCalled();
    expect(engine.getWorldFlag('test_shrine_resolved')).toBeFalsy();
  });

  it('stairs on the stepped-on tile are not announced after the fling', () => {
    const { engine, map, player } = setup();
    map.setTile(6, 5, TILES.STAIRS_DOWN);
    armFling(engine, player);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(chebyshev(player, { x: 6, y: 5 })).toBeGreaterThanOrEqual(2);
    expect(stairsLine(engine)).toBe(false);
  });

  it('the landing tile surface acts on the flung hero', () => {
    const { engine, player } = setup(EMBERS);
    for (let y = 1; y <= 9; y++) {
      for (let x = 2; x <= 10; x++) {
        const d = chebyshev({ x, y }, { x: 6, y: 5 });
        if (d >= 2 && d <= 4) engine.surfaces.setSurface(x, y, 'test_embers', 50);
      }
    }
    armFling(engine, player);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(chebyshev(player, { x: 6, y: 5 })).toBeGreaterThanOrEqual(2);
    expect(engine.messages.some((m) => /Hero lands in embers for \d+\./.test(m))).toBe(true);
    expect(player.hp).toBeLessThan(50);
  });
});

describe("an ice slide: the step's tile is where the slide ends", () => {
  it('a choice on the ice does not open, and stairs where the slide ends are announced', () => {
    const { engine, map, player, onChoice } = setup();
    map.setTile(6, 5, SHRINE_TILE);
    map.setTile(8, 5, TILES.STAIRS_DOWN);
    engine.surfaces.setSurface(6, 5, 'ice_sheet', 50);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect({ x: player.x, y: player.y }).toEqual({ x: 8, y: 5 });
    expect(onChoice).not.toHaveBeenCalled();
    expect(engine.getWorldFlag('test_shrine_resolved')).toBeFalsy();
    expect(stairsLine(engine)).toBe(true);
  });

  it('a plain step onto a choice tile still opens it', () => {
    const { engine, map, player, onChoice } = setup();
    map.setTile(6, 5, SHRINE_TILE);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect({ x: player.x, y: player.y }).toEqual({ x: 6, y: 5 });
    expect(onChoice).toHaveBeenCalledTimes(1);
  });
});
