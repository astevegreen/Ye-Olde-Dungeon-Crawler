import { describe, it, expect } from 'vitest';
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
import { activeMonsterStore } from '../../registries';
import { AutosaveManager } from '../autosaveManager';
import { MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame, serializeMapObject, deserializeMapObject } from '../serializer';
import { EMBOLDENED_STATUS } from '../../../content/cotw/darkness';
import { COTW_TOWN } from '../../../content/cotw/town';

/**
 * Whole-codebase review, 2026-10-06, area 1 (storage). Each test reproduces one finding
 * from `.prompts/codebase-review-2026-10-06/areas/01-storage.md` and is marked `it.fails`
 * so the suite stays green until the bug is fixed. Content is imported as a fixture only
 * (ARCHITECTURE.md §3: colocated engine tests may).
 */

const roundTrip = (engine: GameEngine) => deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine)))).engine;

describe('R-stor-1 · a monster is saved with its computed attack, so a status modifier compounds on reload', () => {
  it('an Emboldened monster (base 20, ×1.25) still has base 20 after a save/load', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const rat = new Monster({ id: 'm1', name: 'Rat', position: { x: 2, y: 2 }, stats: { hp: 10, maxHp: 10, attack: 20, defense: 2 } });
    rat.statusManager.applyStatus({ type: EMBOLDENED_STATUS, duration: 9999 });
    map.addEntity(rat);
    expect(rat.attack).toBe(25); // live: 20 × 1.25 (passes today)

    const back = deserializeMapObject(serializeMapObject(map)).getEntityById('m1') as Monster;

    expect(back.baseAttackValue).toBe(20);
    expect(back.attack).toBe(25);
  });
});

describe('R-stor-2 · a dismissed companion’s pack is not re-registered in the item index on load', () => {
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

    expect(back.inventory.primaryPack.getItems().map((i) => i.id)).toEqual(['loot1']); // listed (passes today)
    expect(loaded.registries.itemIndex.has('loot1')).toBe(true); // but not resolvable by id
  });
});

describe('R-stor-3 · GameStateManager is not saved: deepestFloor falls back to the load floor', () => {
  it('a hero who reached floor 3 and climbed back to 1 still has deepestFloor 3 after a load', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h2', name: 'H2', position: { x: 5, y: 5 } }), floor: 1 });
    engine.changeFloor(2);
    engine.changeFloor(3);
    engine.changeFloor(1);
    expect(engine.gameState.deepestFloor).toBe(3); // live (passes today)

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

describe('R-stor-4 · authored shop stock is a process-wide singleton shared between towns', () => {
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

describe('R-stor-5 · FloorManager has no floor records after a load, so the first revisit skips catch-up', () => {
  it('stored floors are known to the floor manager after a load', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h3', name: 'H3', position: { x: 5, y: 5 } }), floor: 1 });
    engine.changeFloor(2);
    engine.turnCount = 40; // floor 2 is left at turn 40
    engine.changeFloor(3);
    expect(engine.floorManager.hasFloor(2)).toBe(true); // live (passes today)

    const loaded = roundTrip(engine);

    expect([...loaded.storedFloors.keys()]).toContain(2); // the map is there (passes today)
    expect(loaded.floorManager.hasFloor(2)).toBe(true); // but the floor manager does not know it
    expect(loaded.floorManager.getFloorRecord(2)?.lastVisitedTick).toBe(40);
    expect(loaded.floorManager.hasFloor(3)).toBe(false); // the floor loaded onto is departed later
  });
});

describe('R-stor-6 · loadAutosaveResult skips the version gate for a newer schema', () => {
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
    expect(live.registries.itemIndex.get('sword-1')).toBe(sword); // (passes today)

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

describe('R-stor-10 · the Detect Monsters / Detect Objects countdowns are not saved', () => {
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

describe('R-stor-11 · a monster’s faction is not saved, so it reloads hostile', () => {
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
