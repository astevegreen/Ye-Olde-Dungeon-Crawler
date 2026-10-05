import { describe, it, expect } from 'vitest';
import { Container, GameMap, Player, createWorldState, setFlag, getCurrentObjective, type EngineContext } from '../../../engine';
import { createScaledItem } from '../../../engine';
import { COTW_ITEMS } from '../items';
import { COTW_RELIC_HOOK, HEARTH_TEAR_ID, HEARTH_TEAR_RETURNED_FLAG, RELIC_RECOVERED_FLAG } from '../relic';
import { COTW_TOWN_REACTIVE_HOOK } from '../narrative';
import { COTW_OBJECTIVES } from '../objectives';
import { COTW_DEEPEST_FLOOR_COUNTER } from '../spellTablets';

function context(floor: number): { engine: EngineContext; player: Player; logs: string[] } {
  const worldState = createWorldState();
  const logs: string[] = [];
  const player = new Player({ name: 'Sven', position: { x: 2, y: 2 } });
  const engine: EngineContext = {
    player,
    map: new GameMap(10, 10),
    surfaces: null as never,
    worldState,
    rng: () => 0.5,
    log: (m) => logs.push(m),
    getWorldFlag: (f) => Boolean(worldState.flags[f]),
    setWorldFlag: (f, v) => setFlag(worldState, f, v),
    currentFloor: floor,
    removeEntity: () => true,
    addEntity: () => true,
    compendium: null as never,
  };
  return { engine, player, logs };
}

const shard = () => createScaledItem(COTW_ITEMS.find((i) => i.id === HEARTH_TEAR_ID)!, 'shard-1', 25, () => 0.5);
const act = (hook: typeof COTW_RELIC_HOOK, { engine, player }: ReturnType<typeof context>) =>
  hook.execute({ action: null as never, actionType: 'WaitAction', actor: player, engine });

describe('The Hearth-Tear: reclaimed, carried home, the thaw', () => {
  it('is recovered once carried, even inside a nested container', () => {
    const ctx = context(25);
    act(COTW_RELIC_HOOK, ctx);
    expect(ctx.engine.getWorldFlag(RELIC_RECOVERED_FLAG)).toBe(false);

    const pouch = new Container({ id: 'pouch', name: 'Pouch', category: 'container', weight: 10, bulk: 10, quality: 'normal', identified: true, containerType: 'purse', maxWeightCapacity: 5000, maxBulkCapacity: 5000 });
    pouch.addItem(shard());
    ctx.player.inventory.primaryPack.addItem(pouch);
    act(COTW_RELIC_HOOK, ctx);
    expect(ctx.engine.getWorldFlag(RELIC_RECOVERED_FLAG)).toBe(true);
    expect(ctx.logs.some((l) => l.includes('Carry it home'))).toBe(true);
  });

  it("keeps Act 1's line up until the Hearth-Tear is found, whatever happened at the siphon", () => {
    const deep = context(22);
    const view = {
      manifest: { objectives: COTW_OBJECTIVES },
      getWorldFlag: (f: string) => deep.engine.getWorldFlag(f),
      getWorldCounter: (c: string) => deep.engine.worldState.counters[c] ?? 0,
    };
    deep.engine.worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] = 22;
    setFlag(deep.engine.worldState, 'savior_of_jarnvidr', true);
    setFlag(deep.engine.worldState, 'blood_tainted_hero', true);
    expect(getCurrentObjective(view as never)?.id).toBe('cotw_objective_act1');

    setFlag(deep.engine.worldState, RELIC_RECOVERED_FLAG, true);
    expect(getCurrentObjective(view as never)?.id).toBe('cotw_objective_return');
  });

  it('asks to be carried home, and the errand ends with the thaw in town', () => {
    const view = (ctx: ReturnType<typeof context>) => ({
      manifest: { objectives: COTW_OBJECTIVES },
      getWorldFlag: (f: string) => ctx.engine.getWorldFlag(f),
      getWorldCounter: (c: string) => ctx.engine.worldState.counters[c] ?? 0,
    });
    const town = context(0);
    town.engine.worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] = 26;
    setFlag(town.engine.worldState, RELIC_RECOVERED_FLAG, true);
    expect(getCurrentObjective(view(town) as never)?.id).toBe('cotw_objective_return');

    act(COTW_TOWN_REACTIVE_HOOK, town);
    expect(town.engine.getWorldFlag(HEARTH_TEAR_RETURNED_FLAG)).toBe(true);
    expect(town.logs.some((l) => l.includes('THE GREAT THAW'))).toBe(true);
    expect(getCurrentObjective(view(town) as never)?.id).toBe('cotw_objective_act2');
  });
});
