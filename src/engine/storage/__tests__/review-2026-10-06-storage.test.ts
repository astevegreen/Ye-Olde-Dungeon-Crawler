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

  it('an Emboldened companion keeps base 20 across a save/load', () => {
    const ID = 'review_test_companion_stats';
    CompanionRegistry.register({ id: ID, name: 'Stat Companion', stats: { hp: 20, maxHp: 20, attack: 20, defense: 1 }, speed: 100, packWeightCapacity: 100, packBulkCapacity: 100 } as never);
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'hero-s', name: 'Hero', position: { x: 10, y: 10 } }) });
    engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true);
    engine.summonCompanion(ID)!.statusManager.applyStatus({ type: EMBOLDENED_STATUS, duration: 9999 });

    const back = roundTrip(engine).companion!;

    expect(back.baseAttackValue).toBe(20);
    expect(back.attack).toBe(25);
  });
});

describe('R-stor-2 · a dismissed companion’s pack is not re-registered in the item index on load', () => {
  it.fails('an item in a dismissed companion’s pack resolves by id after load and re-summon', () => {
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
  it.fails('a hero who reached floor 3 and climbed back to 1 still has deepestFloor 3 after a load', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h2', name: 'H2', position: { x: 5, y: 5 } }), floor: 1 });
    engine.changeFloor(2);
    engine.changeFloor(3);
    engine.changeFloor(1);
    expect(engine.gameState.deepestFloor).toBe(3); // live (passes today)

    const loaded = roundTrip(engine);

    expect(loaded.gameState.deepestFloor).toBe(3);
  });
});

describe('R-stor-4 · authored shop stock is a process-wide singleton shared between towns', () => {
  it.fails('two generated towns hold different purse objects, so one hero’s coins never show in another’s shop', () => {
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
  it.fails('stored floors are known to the floor manager after a load', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'h3', name: 'H3', position: { x: 5, y: 5 } }), floor: 1 });
    engine.changeFloor(2);
    engine.changeFloor(3);
    expect(engine.floorManager.hasFloor(2)).toBe(true); // live (passes today)

    const loaded = roundTrip(engine);

    expect([...loaded.storedFloors.keys()]).toContain(2); // the map is there (passes today)
    expect(loaded.floorManager.hasFloor(2)).toBe(true); // but the floor manager does not know it
  });
});

describe('R-stor-6 · loadAutosaveResult skips the version gate for a newer schema', () => {
  it.fails('an autosave with schemaVersion 99 is refused as newer-than-engine', () => {
    const storage = new MemoryStorage();
    const autosaves = new AutosaveManager(storage);
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 5, y: 5 } }) });
    const data = serializeGame(engine);
    storage.setItem(autosaves.autosaveKey, JSON.stringify({ schemaVersion: 99, contentManifestId: 'x', timestamp: 1, profile: data.profile, data }));

    const outcome = autosaves.loadAutosaveResult();

    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? undefined : outcome.reason).toBe('newer-than-engine');
  });
});

describe('R-stor-10 · the Detect Monsters / Detect Objects countdowns are not saved', () => {
  it.fails('detectMonstersTurns survives a save/load', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 5, y: 5 } }) });
    engine.detectMonstersTurns = 25;

    const loaded = roundTrip(engine);

    expect(loaded.detectMonstersTurns).toBe(25);
  });
});
