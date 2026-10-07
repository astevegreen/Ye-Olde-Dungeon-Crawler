import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonsterRegistry, getMonsterDefinition, type MonsterDefinition } from '../bestiary/monsterDefinitions';
import { Monster } from '../entities/monster';
import { Companion } from '../entities/companion';
import { AIRegistry } from '../ai/aiRegistry';
import { getSpell } from '../magic/spellRegistry';
import { EffectPrimitiveRegistry } from '../magic/effectRegistry';
import { StatusHandlerRegistry } from '../status/statusHandlers';
import { activeTrapStore } from '../registries/trapRegistryStore';
import { DungeonGeneratorRegistry } from '../dungeon/generator';
import { DungeonGenerator } from '../dungeon/dungeon-generator';
import { SpellPipeline } from '../magic/spellPipeline';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { flightRecorder } from '../debug/flightRecorder';
import { COTW_MONSTERS } from '../../content/cotw/monsters';

const UNKNOWN_ID = 'no_such_definition';
const koboldDef = COTW_MONSTERS.find((d) => d.id === 'kobold')!;

const isFallbackCreature = (e: { name: string }) => e.name === 'Unknown Creature';

describe('Definition lookups fail loudly on unknown IDs', () => {
  beforeEach(() => MonsterRegistry.clear());
  afterEach(() => MonsterRegistry.clear());

  it('MonsterRegistry.get / has / getMonsterDefinition report an unknown ID as absent', () => {
    expect(MonsterRegistry.get(UNKNOWN_ID)).toBeUndefined();
    expect(MonsterRegistry.has(UNKNOWN_ID)).toBe(false);
    expect(getMonsterDefinition(UNKNOWN_ID)).toBeUndefined();
  });

  it('Monster.createFromDefinition throws on an unknown ID instead of substituting an arbitrary creature', () => {
    expect(() => Monster.createFromDefinition(UNKNOWN_ID, 'm-1', { x: 1, y: 1 })).toThrow(UNKNOWN_ID);
  });

  it('Monster.createFromDefinition builds exactly the registered definition', () => {
    MonsterRegistry.register(koboldDef);
    const monster = Monster.createFromDefinition(koboldDef.id, 'm-2', { x: 1, y: 1 });
    expect(monster.definitionId).toBe(koboldDef.id);
    expect(monster.name).toBe(koboldDef.name);
    expect(monster.maxHp).toBe(koboldDef.stats.maxHp);
  });

  it('every other definition registry reports an unknown ID as absent', () => {
    expect(AIRegistry.get(UNKNOWN_ID)).toBeUndefined();
    expect(getSpell(UNKNOWN_ID)).toBeUndefined();
    expect(EffectPrimitiveRegistry.get(UNKNOWN_ID)).toBeUndefined();
    expect(StatusHandlerRegistry.get(UNKNOWN_ID)).toBeUndefined();
    expect(activeTrapStore().get(UNKNOWN_ID)).toBeUndefined();
    expect(DungeonGeneratorRegistry.get(UNKNOWN_ID)).toBeUndefined();
    expect(Companion.fromDefinition(UNKNOWN_ID, 'c-1', { x: 0, y: 0 })).toBeNull();
  });
});

describe('createFromDefinition call sites handle unknown definitions explicitly', () => {
  beforeEach(() => MonsterRegistry.clear());
  afterEach(() => MonsterRegistry.clear());

  it('summon effect: an unknown creature ID spawns nothing and logs the failure', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const engine = new GameEngine({ map, player });
    const entitiesBefore = engine.map.getAllEntities().length;

    SpellPipeline.executeSummonEffect(engine, player, { type: 'summon', monsterId: UNKNOWN_ID });

    expect(engine.map.getAllEntities().length).toBe(entitiesBefore);
    expect(engine.map.getAllEntities().some(isFallbackCreature)).toBe(false);
    expect(engine.messages.some((m) => m.includes(`Summoning failed — unknown creature definition: ${UNKNOWN_ID}`))).toBe(true);
  });

  it('DungeonGenerator: unregistered hard-coded spawn IDs are skipped with a flight-recorder warning, not faked', () => {
    const dungeon = new DungeonGenerator({ width: 40, height: 30, maxRooms: 8, seed: 5555, spawnMonsters: true }).generate();

    expect(dungeon.monsters).toHaveLength(0);
    expect(dungeon.map.getAllEntities().some(isFallbackCreature)).toBe(false);
    const warnings = flightRecorder
      .getEvents()
      .filter((e) => e.type === 'warning' && (e.details as any)?.source === 'DungeonGenerator');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('DungeonGenerator: registered definitions still spawn as real monsters', () => {
    MonsterRegistry.registerAll(COTW_MONSTERS);
    const dungeon = new DungeonGenerator({ width: 40, height: 30, maxRooms: 8, seed: 5555, spawnMonsters: true }).generate();

    expect(dungeon.monsters.length).toBeGreaterThan(0);
    for (const monster of dungeon.monsters) {
      expect(MonsterRegistry.has(monster.definitionId)).toBe(true);
      expect(isFallbackCreature(monster)).toBe(false);
    }
  });

  it('DungeonGenerator fallback layout spawns a real candidate monster, never an unregistered placeholder', () => {
    MonsterRegistry.register(koboldDef);
    const generator = new DungeonGenerator({ width: 40, height: 30, seed: 1, monsterCandidates: [koboldDef] });
    const fallback = (generator as any).createFallbackDungeon();

    expect(fallback.monsters).toHaveLength(1);
    expect(fallback.monsters[0].definitionId).toBe(koboldDef.id);
    expect(fallback.map.getAllEntities().some(isFallbackCreature)).toBe(false);
  });

  it('DungeonGenerator fallback layout with no candidates spawns no monster', () => {
    const generator = new DungeonGenerator({ width: 40, height: 30, seed: 1 });
    const fallback = (generator as any).createFallbackDungeon();

    expect(fallback.monsters).toHaveLength(0);
    expect(fallback.map.getAllEntities().some(isFallbackCreature)).toBe(false);
  });
});

describe('a summon with a duration is sent back when its lease runs out', () => {
  const WISP = { id: 'test_wisp', name: 'Wisp', stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 }, speed: 100, aiType: 'melee', xpValue: 1 } as MonsterDefinition;
  beforeEach(() => MonsterRegistry.clear());
  afterEach(() => MonsterRegistry.clear());

  it('the creature carries a summoned status and leaves the map and the turn order when it expires', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const engine = new GameEngine({ map, player });
    engine.registries.monsters.register(WISP);

    SpellPipeline.executeSummonEffect(engine, player, { type: 'summon', monsterId: 'test_wisp', duration: 2, friendly: true });
    const wisp = engine.map.getAllEntities().find((e) => e.name === 'Wisp') as Monster;
    expect(wisp.statusManager.getStatus('summoned')?.duration).toBe(2);

    wisp.takeTurn(engine);
    expect(engine.map.getAllEntities()).toContain(wisp);
    const last = wisp.takeTurn(engine);
    expect(last.cost).toBe(0);
    expect(engine.map.getAllEntities()).not.toContain(wisp);
    expect(engine.messages.some((m) => m === 'Wisp fades back into the aether.')).toBe(true);
  });

  it('a summon without a duration stays', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
    engine.registries.monsters.register(WISP);
    SpellPipeline.executeSummonEffect(engine, engine.player, { type: 'summon', monsterId: 'test_wisp' });
    const wisp = engine.map.getAllEntities().find((e) => e.name === 'Wisp') as Monster;
    expect(wisp.statusManager.hasStatus('summoned')).toBe(false);
  });
});
