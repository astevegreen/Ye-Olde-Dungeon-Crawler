import { describe, it, expect } from 'vitest';
import { GameMap, Player, createWorldState, setFlag, type EngineContext } from '../../../engine';
import { COTW_TEMPLE_MET_HOOK, TEMPLE_MET_FLAG } from '../factions';
import { TOWN_BUILDINGS } from '../townLayout';

function context(floor: number, x: number, y: number): { engine: EngineContext; player: Player } {
  const worldState = createWorldState();
  const player = new Player({ name: 'Sven', position: { x, y } });
  const engine: EngineContext = {
    player,
    map: new GameMap(60, 40),
    surfaces: null as never,
    worldState,
    rng: () => 0.5,
    log: () => undefined,
    getWorldFlag: (f) => Boolean(worldState.flags[f]),
    setWorldFlag: (f, v) => setFlag(worldState, f, v),
    currentFloor: floor,
    removeEntity: () => true,
    compendium: null as never,
  };
  return { engine, player };
}

const run = ({ engine, player }: ReturnType<typeof context>) =>
  COTW_TEMPLE_MET_HOOK.execute({ action: null as never, actionType: 'MovementAction', actor: player, engine });

describe('Temple faction: met on the first visit', () => {
  const temple = TOWN_BUILDINGS.find((b) => b.buildingType === 'temple')!;

  it('is met once the hero stands in the temple, its door included', () => {
    const ctx = context(0, temple.door.x, temple.door.y);
    run(ctx);
    expect(ctx.engine.getWorldFlag(TEMPLE_MET_FLAG)).toBe(true);
  });

  it('is not met elsewhere in town, or below at the same spot', () => {
    const plaza = context(0, temple.bounds.x1 - 2, temple.bounds.y1 - 2);
    run(plaza);
    expect(plaza.engine.getWorldFlag(TEMPLE_MET_FLAG)).toBe(false);

    const below = context(3, temple.door.x, temple.door.y + 2);
    run(below);
    expect(below.engine.getWorldFlag(TEMPLE_MET_FLAG)).toBe(false);
  });
});
