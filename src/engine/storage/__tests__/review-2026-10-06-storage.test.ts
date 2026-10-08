import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { CompanionRegistry } from '../../entities/companion';
import { Item } from '../../items/item';
import { Container } from '../../items/container';
import { CoinItem } from '../../economy/currency';
import { TownMapGenerator } from '../../town/townMap';
import { activeItemIndex } from '../../items/itemIndex';
import { activeMonsterStore } from '../../registries/monsterRegistryStore';
import { activateRegistries } from '../../registries';
import { Visibility } from '../../fov/types';
import { TrapInstance } from '../../dungeon/traps';
import { AutosaveManager } from '../autosaveManager';
import { MemoryStorage } from '../profile-manager';
import { CURRENT_SCHEMA_VERSION } from '../migrator';
import { serializeGame, deserializeGame, serializeMapObject, deserializeMapObject } from '../serializer';
import { EMBOLDENED_STATUS } from '../../../content/cotw/darkness';
import { COTW_TOWN } from '../../../content/cotw/town';

/**
 * Whole-codebase review, 2026-10-06, area 1 (storage): regression guards for the findings
 * fixed since. R-stor-1: a monster or companion is saved from its base stats, so a status
 * modifier doesn't compound on reload. R-stor-2: a dismissed companion's pack is in the item
 * index after a load. R-stor-3: the run's record (`GameStateManager`) is saved. R-stor-4:
 * each generated town has its own shop stock. R-stor-5: the floor manager keeps its floor
 * records across a load. R-stor-6: the autosave load refuses a newer or malformed schema
 * version. R-stor-7: a failed load leaves the live game's registries as they were.
 * R-stor-10 and R-dbg-6: the detection countdowns and the scheduler tick are saved.
 * R-stor-11: a monster's faction is saved. R-stor-17: a foreign save's sizes and its count of
 * stored floors are checked before it is built. R-stor-15 (T4): a saved trap keeps its
 * definition. R-stor-14: exploration is saved as run length only, and an older save's list
 * still loads. Content is imported as a fixture only (ARCHITECTURE.md §3: colocated engine
 * tests may).
 */

const roundTrip = (engine: GameEngine) => deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine)))).engine;

describe('R-stor-1 · a monster is saved with its base attack, so a status modifier never compounds on reload', () => {
  it('an Emboldened monster (base 20, ×1.25) still has base 20 after a save/load', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const rat = new Monster({ id: 'm1', name: 'Rat', position: { x: 2, y: 2 }, stats: { hp: 10, maxHp: 10, attack: 20, defense: 2 } });
    rat.statusManager.applyStatus({ type: EMBOLDENED_STATUS, duration: 9999 });
    map.addEntity(rat);
    expect(rat.attack).toBe(25); // live: 20 × 1.25

    const back = deserializeMapObject(serializeMapObject(map)).getEntityById('m1') as Monster;

    expect(back.baseAttackValue).toBe(20);
    expect(back.attack).toBe(25);
  });
});

describe('R-stor-2 · a dismissed companion’s pack is re-registered in the item index on load', () => {
  afterAll(() => {
    activateRegistries(null);
    CompanionRegistry.clear();
  });

  it('an item in a dismissed companion’s pack resolves by id after load and re-summon', () => {
    const ID = 'review_test_companion';
    CompanionRegistry.register({
      id: ID,
      name: 'Test Companion',
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
      speed: 100,
      packWeightCapacity: 10000,
      packBulkCapacity: 8000,
    } as never);
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } }) });
    engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true);
    const companion = engine.summonCompanion(ID)!;
    companion.inventory.primaryPack.addItem(new Item({ id: 'loot1', name: 'Gem', category: 'misc', weight: 10, bulk: 10 }));
    engine.dismissCompanion();

    const loaded = roundTrip(engine);
    const back = loaded.summonCompanion(ID)!;

    expect(back.inventory.primaryPack.getItems().map((i) => i.id)).toEqual(['loot1']); // listed
    expect(loaded.registries.itemIndex.has('loot1')).toBe(true); // and resolvable by id
  });
});

describe('R-stor-3 · GameStateManager is saved: deepestFloor and the run status survive a load', () => {
  it('a hero who reached floor 3 and climbed back to 1 still has deepestFloor 3 after a load', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h2', name: 'H2', position: { x: 5, y: 5 } }), floor: 1 });
    engine.changeFloor(2);
    engine.changeFloor(3);
    engine.changeFloor(1);
    expect(engine.gameState.deepestFloor).toBe(3); // live

    const loaded = roundTrip(engine);

    expect(loaded.gameState.deepestFloor).toBe(3);
  });

  it('a won run stays won after a load, so its ending is not offered again', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h4', name: 'H4', position: { x: 5, y: 5 } }) });
    engine.gameState.runStatus = 'victorious';

    const loaded = roundTrip(engine);

    expect(loaded.gameState.runStatus).toBe('victorious');
    expect(loaded.gameState.checkVictoryEligible(loaded)).toBeUndefined();
  });

  it('an older save without the record loads with the floor it was saved on', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h5', name: 'H5', position: { x: 5, y: 5 } }), floor: 4 });
    const data = JSON.parse(JSON.stringify(serializeGame(engine)));
    delete data.gameState;

    const loaded = deserializeGame(data).engine;

    expect(loaded.gameState.deepestFloor).toBe(4);
    expect(loaded.gameState.runStatus).toBe('active');
  });
});

describe('R-stor-4 · authored shop stock is built anew for each town, never shared between them', () => {
  it('two generated towns hold different purse objects, so one hero’s coins never show in another’s shop', () => {
    const townA = new TownMapGenerator(50, 30, COTW_TOWN, []).generate();
    const townB = new TownMapGenerator(50, 30, COTW_TOWN, []).generate();
    const purseA = townA.merchants.get('merchant-olaf')!.stock.find((i) => i.id === 'olaf-purse-1') as Container;
    const purseB = townB.merchants.get('merchant-olaf')!.stock.find((i) => i.id === 'olaf-purse-1') as Container;
    purseA.addItem(new CoinItem({ id: 'hero-a-gold', denomination: 'gold', count: 50 }));

    expect(purseB).not.toBe(purseA);
    expect(purseB.getItems()).toHaveLength(0);
  });
});

describe('R-stor-5 · FloorManager keeps its floor records across a load, so the first revisit catches up', () => {
  it('stored floors are known to the floor manager after a load', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h3', name: 'H3', position: { x: 5, y: 5 } }), floor: 1 });
    engine.changeFloor(2);
    engine.turnCount = 40; // floor 2 is left at turn 40
    engine.changeFloor(3);
    expect(engine.floorManager.hasFloor(2)).toBe(true); // live

    const loaded = roundTrip(engine);

    expect([...loaded.storedFloors.keys()]).toContain(2); // the map is there
    expect(loaded.floorManager.hasFloor(2)).toBe(true); // and the floor manager knows it
    expect(loaded.floorManager.getFloorRecord(2)?.lastVisitedTick).toBe(40);
    expect(loaded.floorManager.hasFloor(3)).toBe(false); // the floor loaded onto is departed later
  });
});

describe('R-stor-6 · loadAutosaveResult applies the version gate to a newer schema', () => {
  it('an autosave with schemaVersion 99 is refused as newer-than-engine', () => {
    const storage = new MemoryStorage();
    const autosaves = new AutosaveManager(storage);
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 5, y: 5 } }) });
    const data = serializeGame(engine);
    storage.setItem(autosaves.autosaveKey, JSON.stringify({ schemaVersion: 99, contentManifestId: 'x', timestamp: 1, profile: data.profile, data }));

    const outcome = autosaves.loadAutosaveResult();

    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? undefined : outcome.reason).toBe('newer-than-engine');
  });

  it.each([['a string', 'abc'], ['a missing', undefined]])('an autosave with %s version is refused', (_label, version) => {
    const storage = new MemoryStorage();
    const autosaves = new AutosaveManager(storage);
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 5, y: 5 } }) });
    const data = serializeGame(engine);
    storage.setItem(autosaves.autosaveKey, JSON.stringify({ schemaVersion: version, contentManifestId: 'x', timestamp: 1, profile: data.profile, data }));

    expect(autosaves.loadAutosaveResult().ok).toBe(false);
  });
});

describe('R-stor-7 · a failed load leaves the live game’s registries as they were', () => {
  const liveWithSword = () => {
    const player = new Player({ id: 'hero-7', name: 'Hero', position: { x: 5, y: 5 } });
    const live = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
    const sword = new Item({ id: 'sword-1', name: 'Sword', category: 'weapon', weight: 10, bulk: 10 });
    player.inventory.primaryPack.addItem(sword);
    // A save of the same hero: its items carry the live game's ids.
    const save = JSON.parse(JSON.stringify(serializeGame(live)));
    return { live, sword, save };
  };

  it('a save that throws after its pack is built leaves sword-1 the live sword', () => {
    const { live, sword, save } = liveWithSword();
    save.player.grimoirePages = [{}]; // throws building the Player, after the map and pack
    expect(live.registries.itemIndex.get('sword-1')).toBe(sword);

    expect(() => deserializeGame(save)).toThrow();

    expect(live.registries.itemIndex.get('sword-1')).toBe(sword);
    expect(live.registries.containers.get(live.player.inventory.primaryPack.id)).toBe(live.player.inventory.primaryPack);
    expect(activeItemIndex()).toBe(live.registries.itemIndex);
  });

  it('a save that throws after its engine is built leaves the live game’s registries active', () => {
    const { live, sword, save } = liveWithSword();
    save.messages = 5; // not iterable: throws after `new GameEngine` activated its own registries

    expect(() => deserializeGame(save)).toThrow();

    expect(activeItemIndex()).toBe(live.registries.itemIndex);
    expect(activeMonsterStore()).toBe(live.registries.monsters);
    expect(live.registries.itemIndex.get('sword-1')).toBe(sword);
  });

  it('a load that succeeds leaves the loaded engine’s registries active, holding its own sword', () => {
    const { live, sword, save } = liveWithSword();

    const loaded = deserializeGame(save).engine;

    expect(activeItemIndex()).toBe(loaded.registries.itemIndex);
    expect(loaded.registries.itemIndex.get('sword-1')).toBe(loaded.player.inventory.primaryPack.getItems().find((i) => i.id === 'sword-1'));
    expect(live.registries.itemIndex.get('sword-1')).toBe(sword);
  });
});

describe('R-stor-10 · the Detect Monsters / Detect Objects countdowns are saved', () => {
  it('detectMonstersTurns survives a save/load', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 5, y: 5 } }) });
    engine.detectMonstersTurns = 25;
    engine.detectObjectsTurns = 7;

    const loaded = roundTrip(engine);

    expect(loaded.detectMonstersTurns).toBe(25);
    expect(loaded.detectObjectsTurns).toBe(7);
  });

  it('R-dbg-6 · the scheduler tick survives a save/load, so tick-phased drift keeps its phase', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 5, y: 5 } }) });
    engine.scheduler.restoreTicks(1237);

    const loaded = roundTrip(engine);

    expect(loaded.scheduler.ticks).toBe(1237);
  });
});

describe('R-stor-11 · a monster’s faction is saved, so a neutral or an ally reloads as it was', () => {
  const monster = (id: string, faction?: 'neutral' | 'player') =>
    new Monster({ id, name: id, position: { x: 2, y: id.length }, stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 }, faction });

  it.each([['neutral'], ['player']] as const)('a %s monster keeps its faction across a save/load', (faction) => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.addEntity(monster('ally', faction));

    const back = deserializeMapObject(JSON.parse(JSON.stringify(serializeMapObject(map)))).getEntityById('ally') as Monster;

    expect(back.faction).toBe(faction);
  });

  it('a hostile monster writes no faction and loads hostile', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.addEntity(monster('rat'));

    const saved = serializeMapObject(map);
    const back = deserializeMapObject(saved).getEntityById('rat') as Monster;

    expect(saved.monsters!.find((m) => m.id === 'rat')!.faction).toBeUndefined();
    expect(back.faction).toBe('hostile');
  });
});

describe('R-stor-17 · a foreign save is not trusted for sizes', () => {
  const saveOf = () => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h17', name: 'H', position: { x: 5, y: 5 } }) });
    return JSON.parse(JSON.stringify(serializeGame(engine)));
  };
  const refusedQuickly = (save: unknown) => {
    const started = performance.now();
    expect(() => deserializeGame(save)).toThrow(/structurally invalid/);
    expect(performance.now() - started).toBeLessThan(1000);
  };

  it.each([
    [1000, 1000],
    [100000, 100000],
    [513, 10],
    [10.5, 10],
  ])('a %s × %s map is refused, quickly', (width, height) => {
    const save = saveOf();
    save.map.width = width;
    save.map.height = height;
    refusedQuickly(save);
  });

  it('a stored floor of 100000 × 100000 is refused too', () => {
    const save = saveOf();
    save.storedMaps = { 2: { ...save.map, width: 100000, height: 100000 } };
    refusedQuickly(save);
  });

  it.each([
    ['one run of 999999999 cells', '999999999:0;'],
    ['runs one cell past the last', '100:0;1:0;'],
  ])('tile data with %s on a 10 × 10 map is refused, quickly', (_label, tilesRle) => {
    const save = saveOf();
    save.map.tilesRle = tilesRle;
    refusedQuickly(save);
  });

  it('the typed load reports an oversized map as a damaged save', () => {
    const storage = new MemoryStorage();
    const autosaves = new AutosaveManager(storage);
    const data = saveOf();
    data.map.width = 100000;
    data.map.height = 100000;
    storage.setItem(autosaves.autosaveKey, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, contentManifestId: 'x', timestamp: 1, profile: data.profile, data }));

    const outcome = autosaves.loadAutosaveResult();

    expect(outcome.ok ? undefined : outcome.reason).toBe('corrupt');
  });

  it('FOV data longer than the map is read only as far as the map, quickly', () => {
    const save = saveOf();
    save.storedFovRle = { 1: '999999999E' };
    save.currentFloor = 1;

    const started = performance.now();
    const loaded = deserializeGame(save).engine;

    expect(performance.now() - started).toBeLessThan(1000);
    expect(loaded.fov.isExplored(9, 9)).toBe(true);
  });

  it('a saved game of an ordinary size still loads', () => {
    const loaded = deserializeGame(saveOf()).engine;
    expect([loaded.map.width, loaded.map.height]).toEqual([10, 10]);
  });
});

describe('R-stor-17 · a foreign save is not trusted for how many stored floors it holds', () => {
  const saveWithStoredFloors = (count: number) => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h17f', name: 'H', position: { x: 5, y: 5 } }) });
    const save = JSON.parse(JSON.stringify(serializeGame(engine)));
    save.storedMaps = {};
    // Floors other than the current one (1), as a save stores them.
    for (let i = 0; i < count; i++) save.storedMaps[2 + i] = save.map;
    return save;
  };

  it('a save holding 2000 stored floors is refused before any is built', () => {
    expect(() => deserializeGame(saveWithStoredFloors(2000))).toThrow(/structurally invalid/);
  });

  it('the typed load reports it as a damaged save', () => {
    const storage = new MemoryStorage();
    const autosaves = new AutosaveManager(storage);
    const data = saveWithStoredFloors(257);
    storage.setItem(autosaves.autosaveKey, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, contentManifestId: 'x', timestamp: 1, profile: data.profile, data }));

    const outcome = autosaves.loadAutosaveResult();

    expect(outcome.ok ? undefined : outcome.reason).toBe('corrupt');
  });

  it('a save holding 256 stored floors still loads', () => {
    expect(deserializeGame(saveWithStoredFloors(256)).engine.storedFloors.size).toBe(257);
  });
});

describe('T4 (R-stor-15) · a saved trap keeps the definition it was placed from', () => {
  it('a trap from a second definition of its type comes back as that definition', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.addTrap(new TrapInstance({ id: 't-deep', definitionId: 'deep_pit', type: 'pit', x: 3, y: 3 }));
    map.addTrap(new TrapInstance({ id: 't-pit', type: 'pit', x: 4, y: 3 }));

    const back = deserializeMapObject(JSON.parse(JSON.stringify(serializeMapObject(map))));

    expect(back.getTrapAt(3, 3)?.definitionId).toBe('deep_pit');
    expect(back.getTrapAt(4, 3)?.definitionId).toBe('pit');
  });

  it('an older save, with no definition on its traps, loads each as its type', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.addTrap(new TrapInstance({ id: 't-arrow', type: 'arrow', x: 5, y: 5 }));
    const saved = JSON.parse(JSON.stringify(serializeMapObject(map)));
    for (const trap of saved.traps) delete trap.definitionId;

    expect(deserializeMapObject(saved).getTrapAt(5, 5)?.definitionId).toBe('arrow');
  });
});

describe('R-stor-14 · a save writes its exploration once, as run length, and still reads a pre-RLE list', () => {
  // A corner well outside the hero's sight radius: only the save can say it was explored.
  const exploredFar = () => {
    const engine = new GameEngine({ map: new GameMap(30, 30, TILES.FLOOR), player: new Player({ id: 'h14', name: 'H', position: { x: 2, y: 2 } }) });
    engine.fov.setVisibility(29, 29, Visibility.Explored);
    return engine;
  };

  it('a save carries its explored cells as run length only, and they come back', () => {
    const engine = exploredFar();

    expect(serializeGame(engine)).not.toHaveProperty('fovExplored');
    expect(roundTrip(engine).fov.isExplored(29, 29)).toBe(true);
  });

  it('an old save with only the explored-cell list still loads its exploration', () => {
    const save = JSON.parse(JSON.stringify(serializeGame(exploredFar())));
    delete save.storedFovRle;
    delete save.fovRle;
    save.fovExplored = [[29, 29]];

    expect(deserializeGame(save).engine.fov.isExplored(29, 29)).toBe(true);
  });
});

// Last: a deserialized engine leaves its own registries active, so a companion that
// R-stor-2 registers before building its engine would land in the wrong store.
describe('R-stor-1 · a companion is saved from base stats too', () => {
  it('an Emboldened companion keeps base 20 across a save/load', () => {
    const ID = 'review_test_companion_stats';
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'hero-s', name: 'Hero', position: { x: 10, y: 10 } }) });
    CompanionRegistry.register({ id: ID, name: 'Stat Companion', stats: { hp: 20, maxHp: 20, attack: 20, defense: 1 }, speed: 100, packWeightCapacity: 100, packBulkCapacity: 100 } as never);
    engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true);
    engine.summonCompanion(ID)!.statusManager.applyStatus({ type: EMBOLDENED_STATUS, duration: 9999 });

    const back = roundTrip(engine).companion!;

    expect(back.baseAttackValue).toBe(20);
    expect(back.attack).toBe(25);
  });
});
