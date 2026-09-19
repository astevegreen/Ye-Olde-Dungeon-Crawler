import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { MonsterRegistry } from '../../bestiary/monsterDefinitions';
import { TrapRegistry } from '../../traps/trapRegistry';
import { WaitAction } from '../../actions/wait';
import { processDefaultMonsterStore, setActiveMonsterStore } from '../monsterRegistryStore';
import { processDefaultTrapStore, setActiveTrapStore } from '../trapRegistryStore';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
import type { TrapDefinition, TrapType } from '../../types/manifest';

/**
 * Per-engine content registries (ARCHITECTURE.md §3, P-22 stage 1).
 *
 * Two engines built from different manifests used to share one set of monster lookups, so
 * the second registration leaked into the first. Each engine now owns its store.
 */
const def = (id: string): MonsterDefinition =>
  ({
    id,
    name: id,
    stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 },
    speed: 100,
    xpValue: 1,
    aiType: 'melee',
    fleeHealthPercent: 0,
    lootTable: [],
  }) as MonsterDefinition;

const trapDef = (type: string): TrapDefinition =>
  ({
    type: type as TrapType,
    name: type,
    damage: 6,
    disarmDifficulty: 10,
    message: `${type} triggered!`,
  }) as TrapDefinition;

function engineWith(monsters: MonsterDefinition[], traps: TrapDefinition[] = []): GameEngine {
  return new GameEngine({
    map: new GameMap(10, 10, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 } }),
    manifest: { id: 'test', name: 'Test', monsters, traps } as never,
  });
}

describe('Per-engine content registries', () => {
  beforeEach(() => {
    processDefaultMonsterStore().clear();
    setActiveMonsterStore(null);
    processDefaultTrapStore().clear();
    setActiveTrapStore(null);
  });

  it('keeps two engines built from different manifests separate', () => {
    const cotwLike = engineWith([def('kobold'), def('ogre')]);
    const warcraftLike = engineWith([def('grunt')]);

    expect(cotwLike.registries.monsters.has('kobold')).toBe(true);
    expect(cotwLike.registries.monsters.has('grunt')).toBe(false);
    expect(warcraftLike.registries.monsters.has('grunt')).toBe(true);
    expect(warcraftLike.registries.monsters.has('kobold')).toBe(false);
  });

  it('does not let a later engine overwrite an earlier engine lookups', () => {
    const first = engineWith([def('kobold')]);
    engineWith([def('grunt')]);

    // Before P-22 this returned the second manifest's set.
    expect(first.registries.monsters.getAll().map((d) => d.id)).toEqual(['kobold']);
  });

  it('still sees fixtures registered before the engine existed', () => {
    MonsterRegistry.register(def('pre-registered'));

    const engine = engineWith([def('kobold')]);

    expect(engine.registries.monsters.has('pre-registered')).toBe(true);
    expect(MonsterRegistry.get('pre-registered')).toBeDefined();
  });

  it('routes the static facade to the most recently constructed engine', () => {
    engineWith([def('kobold')]);
    engineWith([def('grunt')]);

    expect(MonsterRegistry.has('grunt')).toBe(true);
  });

  it('switches static facade lookups to engine A when acting on engine A after constructing engine B', () => {
    const engineA = engineWith([def('kobold')]);
    const engineB = engineWith([def('grunt')]);

    // Right after engine B is constructed, the static facade points to B
    expect(MonsterRegistry.has('grunt')).toBe(true);
    expect(MonsterRegistry.has('kobold')).toBe(false);

    // Now execute an action on engine A
    engineA.handlePlayerAction(new WaitAction(engineA.player));

    // The static facade must now resolve against engine A's data!
    expect(MonsterRegistry.has('kobold')).toBe(true);
    expect(MonsterRegistry.has('grunt')).toBe(false);

    // Acting on engine B switches back to B
    engineB.handlePlayerAction(new WaitAction(engineB.player));
    expect(MonsterRegistry.has('grunt')).toBe(true);
    expect(MonsterRegistry.has('kobold')).toBe(false);
  });

  it('keeps two engines built from different trap manifests separate', () => {
    const engineA = engineWith([], [trapDef('dart_trap')]);
    const engineB = engineWith([], [trapDef('fire_rune')]);

    expect(engineA.registries.traps.has('dart_trap')).toBe(true);
    expect(engineA.registries.traps.has('fire_rune')).toBe(false);
    expect(engineB.registries.traps.has('fire_rune')).toBe(true);
    expect(engineB.registries.traps.has('dart_trap')).toBe(false);

    // Static facade points to B
    expect(TrapRegistry.has('fire_rune')).toBe(true);
    expect(TrapRegistry.has('dart_trap')).toBe(false);

    // Acting on A switches TrapRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(TrapRegistry.has('dart_trap')).toBe(true);
    expect(TrapRegistry.has('fire_rune')).toBe(false);
  });
});
