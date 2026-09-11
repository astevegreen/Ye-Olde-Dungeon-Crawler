import { describe, it, expect } from 'vitest';
import {
  createWorldState,
  cloneWorldState,
  setFlag,
  getFlag,
  incrementCounter,
  getCounter,
  modifyFaction,
  getFaction,
} from '../state/worldState';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import type { Predicate } from '../predicates/types';
import type { ChoiceDefinition } from '../types/choice';
import { ExecuteChoiceAction } from '../actions/choiceAction';
import { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { InventoryManager } from '../inventory/inventory-manager';
import { CoinItem } from '../economy/currency';
import { Merchant } from '../economy/merchant';
import { TempleService } from '../economy/services';
import { MovementAction } from '../actions/movement';
import { Monster } from '../entities/monster';
import { DungeonArc } from '../quest/dungeonArc';
import { cotwManifest } from '../../content/cotw';
import { serializeGame, deserializeGame } from '../storage/serializer';

describe('World State Ledger (Pure Mutations & Queries)', () => {
  it('creates an empty world state with default containers', () => {
    const ws = createWorldState();
    expect(ws.flags).toEqual({});
    expect(ws.counters).toEqual({});
    expect(ws.factions).toEqual({});
  });

  it('correctly sets and queries boolean flags', () => {
    const ws = createWorldState();
    expect(getFlag(ws, 'boss_defeated')).toBe(false);

    setFlag(ws, 'boss_defeated', true);
    expect(getFlag(ws, 'boss_defeated')).toBe(true);

    setFlag(ws, 'boss_defeated', false);
    expect(getFlag(ws, 'boss_defeated')).toBe(false);
  });

  it('increments and decrements integer counters', () => {
    const ws = createWorldState();
    expect(getCounter(ws, 'chests_opened')).toBe(0);

    incrementCounter(ws, 'chests_opened', 1);
    expect(getCounter(ws, 'chests_opened')).toBe(1);

    incrementCounter(ws, 'chests_opened', 5);
    expect(getCounter(ws, 'chests_opened')).toBe(6);

    incrementCounter(ws, 'chests_opened', -2);
    expect(getCounter(ws, 'chests_opened')).toBe(4);
  });

  it('modifies and queries faction standings', () => {
    const ws = createWorldState();
    expect(getFaction(ws, 'temple_standing')).toBe(0);

    modifyFaction(ws, 'temple_standing', 15);
    expect(getFaction(ws, 'temple_standing')).toBe(15);

    modifyFaction(ws, 'temple_standing', -25);
    expect(getFaction(ws, 'temple_standing')).toBe(-10);
  });

  it('clones world state deeply without reference leakage', () => {
    const original = createWorldState({
      flags: { ancient_gate_opened: true },
      counters: { sacrifices: 3 },
      factions: { high_council: 50 },
    });

    const clone = cloneWorldState(original);
    expect(clone).toEqual(original);

    setFlag(clone, 'ancient_gate_opened', false);
    incrementCounter(clone, 'sacrifices', 10);
    modifyFaction(clone, 'high_council', -100);

    expect(getFlag(original, 'ancient_gate_opened')).toBe(true);
    expect(getCounter(original, 'sacrifices')).toBe(3);
    expect(getFaction(original, 'high_council')).toBe(50);
  });
});

describe('Conditional Predicate Evaluator', () => {
  it('returns true for undefined or missing predicates', () => {
    const ws = createWorldState();
    expect(evaluatePredicate(undefined, ws)).toBe(true);
  });

  it('evaluates hasFlag predicates accurately', () => {
    const ws = createWorldState();
    setFlag(ws, 'key_found', true);

    expect(evaluatePredicate({ type: 'hasFlag', flag: 'key_found' }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'hasFlag', flag: 'key_found', value: true }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'hasFlag', flag: 'key_found', value: false }, ws)).toBe(false);
    expect(evaluatePredicate({ type: 'hasFlag', flag: 'chest_opened' }, ws)).toBe(false);
  });

  it('evaluates minCounter and maxCounter predicates accurately', () => {
    const ws = createWorldState();
    incrementCounter(ws, 'relics', 3);

    expect(evaluatePredicate({ type: 'minCounter', counter: 'relics', value: 2 }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'minCounter', counter: 'relics', value: 3 }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'minCounter', counter: 'relics', value: 4 }, ws)).toBe(false);

    expect(evaluatePredicate({ type: 'maxCounter', counter: 'relics', value: 3 }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'maxCounter', counter: 'relics', value: 2 }, ws)).toBe(false);
  });

  it('evaluates minFaction and maxFaction predicates accurately', () => {
    const ws = createWorldState();
    modifyFaction(ws, 'temple_standing', 10);

    expect(evaluatePredicate({ type: 'minFaction', faction: 'temple_standing', value: 10 }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'minFaction', faction: 'temple_standing', value: 20 }, ws)).toBe(false);
    expect(evaluatePredicate({ type: 'maxFaction', faction: 'temple_standing', value: 15 }, ws)).toBe(true);
    expect(evaluatePredicate({ type: 'maxFaction', faction: 'temple_standing', value: 5 }, ws)).toBe(false);
  });

  it('evaluates compound logical predicates (and, or, not)', () => {
    const ws = createWorldState();
    setFlag(ws, 'hero_of_town', true);
    incrementCounter(ws, 'gold_tribute', 100);
    modifyFaction(ws, 'thieves_guild', -20);

    const andPred: Predicate = {
      type: 'and',
      predicates: [
        { type: 'hasFlag', flag: 'hero_of_town' },
        { type: 'minCounter', counter: 'gold_tribute', value: 50 },
      ],
    };
    expect(evaluatePredicate(andPred, ws)).toBe(true);

    const orPred: Predicate = {
      type: 'or',
      predicates: [
        { type: 'minFaction', faction: 'thieves_guild', value: 0 },
        { type: 'hasFlag', flag: 'hero_of_town' },
      ],
    };
    expect(evaluatePredicate(orPred, ws)).toBe(true);

    const notPred: Predicate = {
      type: 'not',
      predicate: { type: 'minFaction', faction: 'thieves_guild', value: 0 },
    };
    expect(evaluatePredicate(notPred, ws)).toBe(true);
  });
});

describe('Choice Definition & ExecuteChoiceAction', () => {
  function createTestSetup() {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const primaryPack = new Container({
      id: 'pack-1',
      name: "Adventurer's Pack",
      category: 'container',
      weight: 1000,
      bulk: 500,
      quality: 'normal',
      identified: true,
      containerType: 'pack',
      maxWeightCapacity: 50000,
      maxBulkCapacity: 30000,
    });
    const inventory = new InventoryManager({ primaryPack });
    const player = new Player({
      id: 'player-1',
      name: 'Tester',
      gender: 'male',
      position: { x: 5, y: 5 },
      inventory,
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
      speed: 100,
    });
    const engine = new GameEngine({
      map,
      player,
      floor: 3,
      manifest: cotwManifest,
    });
    return { engine, player, map };
  }

  it('executes choice consequences cleanly with zero ticks cost', () => {
    const { engine, player } = createTestSetup();

    const choice: ChoiceDefinition = {
      id: 'test_shrine',
      title: 'Shrine of Testing',
      description: 'Choose your blessing or curse.',
      options: [
        {
          id: 'opt_bless',
          label: 'Accept Blessing',
          consequences: [
            { type: 'setFlag', flag: 'test_blessed', value: true },
            { type: 'modifyCounter', counter: 'blessings_received', delta: 1 },
            { type: 'modifyFaction', faction: 'temple_standing', delta: 10 },
            { type: 'applyBuff', statusType: 'haste', duration: 25 },
            { type: 'logMessage', message: 'You feel a surge of divine velocity!' },
          ],
        },
      ],
    };

    const action = new ExecuteChoiceAction(player, choice, 'opt_bless');
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(result.cost).toBe(0);
    expect(engine.getWorldFlag('test_blessed')).toBe(true);
    expect(engine.getWorldCounter('blessings_received')).toBe(1);
    expect(engine.getFactionStanding('temple_standing')).toBe(10);
    expect(player.statusManager.hasStatus('haste')).toBe(true);
    expect(engine.messages).toContain('You feel a surge of divine velocity!');
  });

  it('rejects option when predicate is unsatisfied and preserves world state', () => {
    const { engine, player } = createTestSetup();

    const choice: ChoiceDefinition = {
      id: 'locked_vault',
      title: 'Sealed Vault',
      description: 'Open the gate.',
      options: [
        {
          id: 'opt_open',
          label: 'Turn Ancient Key',
          disabledReason: 'Requires Ancient Key to turn the tumblers.',
          predicate: { type: 'hasFlag', flag: 'has_ancient_key' },
          consequences: [
            { type: 'setFlag', flag: 'vault_unlocked', value: true },
          ],
        },
      ],
    };

    const action = new ExecuteChoiceAction(player, choice, 'opt_open');
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(result.message).toContain('Requires Ancient Key');
    expect(engine.getWorldFlag('vault_unlocked')).toBe(false);
  });

  it('grants items and alerts monsters within radius upon consequence resolution', () => {
    const { engine, player, map } = createTestSetup();

    // Place a sleeping monster nearby
    const monster = new Monster({
      id: 'mon-1',
      name: 'Crypt Zombie',
      position: { x: 7, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
      speed: 80,
      definitionId: 'skeleton',
      aiState: 'sleeping',
    });
    map.addEntity(monster);

    const choice: ChoiceDefinition = {
      id: 'dark_altar',
      title: 'Dark Altar',
      description: 'Seize the relic.',
      options: [
        {
          id: 'opt_seize',
          label: 'Seize Relic',
          consequences: [
            { type: 'grantItem', itemId: 'iron_dagger', toInventory: true },
            { type: 'damagePlayer', amount: 5 },
            { type: 'alertMonsters', radius: 10 },
          ],
        },
      ],
    };

    const action = new ExecuteChoiceAction(player, choice, 'opt_seize');
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(player.hp).toBe(25); // 30 - 5
    expect(monster.aiState).toBe('hunting'); // stirred awake
    const packItems = player.inventory.primaryPack.getItems();
    expect(packItems.some((i) => i.name.toLowerCase().includes('dagger'))).toBe(true);
  });
});

describe('Merchant Predicate Stock Filtering', () => {
  it('filters out vendor items whose preconditions are not satisfied', () => {
    const specialSword = new Item({
      id: 'sword-champion',
      name: "Champion's Blade",
      category: 'weapon',
      weight: 2000,
      bulk: 500,
      quality: 'enchanted',
      identified: true,
      predicate: { type: 'minFaction', faction: 'temple_standing', value: 10 },
    });

    const standardDagger = new Item({
      id: 'dagger-common',
      name: 'Standard Dagger',
      category: 'weapon',
      weight: 1000,
      bulk: 200,
      quality: 'normal',
      identified: true,
    });

    const merchant = new Merchant(
      'armorer',
      'Torvald',
      'Armory',
      'armory',
      'Welcome!',
      [standardDagger, specialSword]
    );

    const wsNeutral = createWorldState();
    const stockNeutral = merchant.getAvailableStock(wsNeutral);
    expect(stockNeutral.length).toBe(1);
    expect(stockNeutral[0].name).toBe('Standard Dagger');

    const wsChampion = createWorldState({
      factions: { temple_standing: 15 },
    });
    const stockChampion = merchant.getAvailableStock(wsChampion);
    expect(stockChampion.length).toBe(2);
  });
});

describe('Persistence & Serialization of WorldState', () => {
  it('persists and restores worldState through save/load cycle', () => {
    const map = new GameMap(25, 25, TILES.FLOOR);
    const primaryPack = new Container({
      id: 'pack-1',
      name: 'Backpack',
      category: 'container',
      weight: 500,
      bulk: 300,
      quality: 'normal',
      identified: true,
      containerType: 'pack',
      maxWeightCapacity: 50000,
      maxBulkCapacity: 30000,
    });
    const player = new Player({
      id: 'player-1',
      name: 'Sven',
      gender: 'male',
      position: { x: 5, y: 5 },
      inventory: new InventoryManager({ primaryPack }),
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
      speed: 100,
    });
    const engine = new GameEngine({
      map,
      player,
      floor: 1,
      manifest: cotwManifest,
      worldState: {
        flags: { tyr_purified: true, boss_portal_used: true },
        counters: { puzzles_solved: 4 },
        factions: { temple_standing: 20 },
      },
    });

    const saveData = serializeGame(engine);
    expect(saveData.worldState).toBeDefined();
    expect(saveData.worldState?.flags['tyr_purified']).toBe(true);
    expect(saveData.worldState?.counters['puzzles_solved']).toBe(4);
    expect(saveData.worldState?.factions['temple_standing']).toBe(20);

    const { engine: restored } = deserializeGame(saveData, cotwManifest);
    expect(restored.getWorldFlag('tyr_purified')).toBe(true);
    expect(restored.getWorldCounter('puzzles_solved')).toBe(4);
    expect(restored.getFactionStanding('temple_standing')).toBe(20);
  });

  it('falls back to default empty world state when deserializing legacy saves without worldState', () => {
    const map = new GameMap(25, 25, TILES.FLOOR);
    const primaryPack = new Container({
      id: 'pack-1',
      name: 'Backpack',
      category: 'container',
      weight: 500,
      bulk: 300,
      quality: 'normal',
      identified: true,
      containerType: 'pack',
      maxWeightCapacity: 50000,
      maxBulkCapacity: 30000,
    });
    const player = new Player({
      id: 'player-1',
      name: 'Sven',
      gender: 'male',
      position: { x: 5, y: 5 },
      inventory: new InventoryManager({ primaryPack }),
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
      speed: 100,
    });
    const engine = new GameEngine({
      map,
      player,
      floor: 1,
      manifest: cotwManifest,
    });

    const saveData = serializeGame(engine);
    delete (saveData as any).worldState; // Simulate legacy save

    const { engine: restored } = deserializeGame(saveData, cotwManifest);
    expect(restored.worldState).toBeDefined();
    expect(restored.getWorldFlag('any_flag')).toBe(false);
    expect(restored.getWorldCounter('any_counter')).toBe(0);
  });
});

describe('Floor 3 Ancient Altar of Tyr Encounter & Temple Healer Reaction', () => {
  it('stamps the Altar of Tyr on Floor 3 generation in CotW', () => {
    const floor3 = DungeonArc.generateFloor(3, 12345, cotwManifest.quest, cotwManifest);
    let foundAltar = false;
    for (let y = 0; y < floor3.map.height; y++) {
      for (let x = 0; x < floor3.map.width; x++) {
        const tile = floor3.map.getTile(x, y);
        if (tile?.type === 'altar_tyr') {
          foundAltar = true;
          break;
        }
      }
      if (foundAltar) break;
    }
    expect(foundAltar).toBe(true);
  });

  it('triggers onChoiceInteract when stepping onto the Altar of Tyr and executes Purify', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.setTile(5, 5, TILES.ALTAR_TYR);

    const primaryPack = new Container({
      id: 'pack-1',
      name: 'Backpack',
      category: 'container',
      weight: 500,
      bulk: 300,
      quality: 'normal',
      identified: true,
      containerType: 'pack',
      maxWeightCapacity: 50000,
      maxBulkCapacity: 30000,
    });
    const player = new Player({
      id: 'player-1',
      name: 'Sven',
      gender: 'male',
      position: { x: 4, y: 5 },
      inventory: new InventoryManager({ primaryPack }),
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
      speed: 100,
    });
    const engine = new GameEngine({
      map,
      player,
      floor: 3,
      manifest: cotwManifest,
    });

    let choiceOpened = false;
    let receivedChoiceId = '';
    engine.onChoiceInteract = (choice, onSelect) => {
      choiceOpened = true;
      receivedChoiceId = choice.id;
      // Player selects 'purify'
      onSelect('purify');
    };

    // Player moves East into (5, 5)
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(choiceOpened).toBe(true);
    expect(receivedChoiceId).toBe('altar_tyr');
    expect(engine.getWorldFlag('tyr_purified')).toBe(true);
    expect(engine.getFactionStanding('temple_standing')).toBe(10);
    expect(player.statusManager.hasStatus('haste')).toBe(true);

    // Healer reaction: TempleService offers 50% discount to pious champion
    player.inventory.primaryPack.addItem(new CoinItem({ id: 'coin-gold', denomination: 'gold', count: 50 })); // 5000 CP
    player.takeDamage(10); // HP now 20/30
    const healResult = TempleService.healAndRestore(player, undefined, undefined, engine);
    expect(healResult.success).toBe(true);
    expect(healResult.costInCp).toBe(1250); // 50% of 2500 CP
  });

  it('triggers Desecrate choice and causes temple priest to refuse services', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.setTile(5, 5, TILES.ALTAR_TYR);

    const primaryPack = new Container({
      id: 'pack-1',
      name: 'Backpack',
      category: 'container',
      weight: 500,
      bulk: 300,
      quality: 'normal',
      identified: true,
      containerType: 'pack',
      maxWeightCapacity: 50000,
      maxBulkCapacity: 30000,
    });
    const player = new Player({
      id: 'player-1',
      name: 'Sven',
      gender: 'male',
      position: { x: 4, y: 5 },
      inventory: new InventoryManager({ primaryPack }),
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
      speed: 100,
    });
    const engine = new GameEngine({
      map,
      player,
      floor: 3,
      manifest: cotwManifest,
    });

    engine.onChoiceInteract = (_choice, onSelect) => {
      // Player selects 'desecrate'
      onSelect('desecrate');
    };

    // Move onto altar
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(engine.getWorldFlag('tyr_desecrated')).toBe(true);
    expect(engine.getFactionStanding('temple_standing')).toBe(-10);

    // Temple priest refuses healing service
    const healResult = TempleService.healAndRestore(player, undefined, undefined, engine);
    expect(healResult.success).toBe(false);
    expect(healResult.message).toContain('Desecrator of sacred altars');

    // Temple priest refuses curse cleansing service
    const cleanseResult = TempleService.cleanseCurses(player, undefined, undefined, engine);
    expect(cleanseResult.success).toBe(false);
    expect(cleanseResult.message).toContain('Desecrator of sacred altars');
  });
});
