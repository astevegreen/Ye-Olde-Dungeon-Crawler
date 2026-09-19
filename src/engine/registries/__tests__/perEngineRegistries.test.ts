import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { MonsterRegistry } from '../../bestiary/monsterDefinitions';
import { TrapRegistry } from '../../traps/trapRegistry';
import { ActionRegistry, type GameAction } from '../../actions/actionRegistry';
import { SpellRegistry, getSpell, SPELL_REGISTRY } from '../../magic/spellRegistry';
import { CompanionRegistry, type CompanionDefinition } from '../../entities/companion';
import { WaitAction } from '../../actions/wait';
import { processDefaultMonsterStore, setActiveMonsterStore } from '../monsterRegistryStore';
import { processDefaultTrapStore, setActiveTrapStore } from '../trapRegistryStore';
import { setActiveActionStore } from '../actionRegistryStore';
import { processDefaultSpellStore, setActiveSpellStore } from '../spellRegistryStore';
import { processDefaultCompanionStore, setActiveCompanionStore } from '../companionRegistryStore';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
import type { TrapDefinition, TrapType } from '../../types/manifest';
import type { SpellDefinition } from '../../magic/types';

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

const actionDef = (id: string): GameAction => ({
  id,
  name: id,
  validate: () => ({ valid: true }),
  calculateEnergyCost: () => 100,
  execute: () => ({ success: true, cost: 100, message: `${id} executed` }),
});

const spellDef = (id: string): SpellDefinition =>
  ({
    id,
    name: id,
    level: 1,
    school: 'sorcery',
    manaCost: 5,
    range: 5,
    targetType: 'directional',
    effects: [],
  }) as unknown as SpellDefinition;

const companionDef = (id: string): CompanionDefinition =>
  ({
    id,
    name: id,
    stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
    speed: 100,
    packWeightCapacity: 20,
    packBulkCapacity: 10,
  }) as CompanionDefinition;

function engineWith(
  monsters: MonsterDefinition[],
  traps: TrapDefinition[] = [],
  actionCommands: GameAction[] = [],
  spells: SpellDefinition[] = [],
  companions: CompanionDefinition[] = []
): GameEngine {
  return new GameEngine({
    map: new GameMap(10, 10, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 } }),
    manifest: { id: 'test', name: 'Test', monsters, traps, actionCommands, spells, companions } as never,
  });
}

describe('Per-engine content registries', () => {
  beforeEach(() => {
    processDefaultMonsterStore().clear();
    setActiveMonsterStore(null);
    processDefaultTrapStore().clear();
    setActiveTrapStore(null);
    ActionRegistry.resetToDefaults();
    setActiveActionStore(null);
    processDefaultSpellStore().clear();
    setActiveSpellStore(null);
    processDefaultCompanionStore().clear();
    setActiveCompanionStore(null);
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

  it('keeps two engines built from different action command manifests separate', () => {
    const engineA = engineWith([], [], [actionDef('whirlwind')]);
    const engineB = engineWith([], [], [actionDef('shadowstep')]);

    // Both inherit default actions
    expect(engineA.registries.actionCommands.has('move')).toBe(true);
    expect(engineB.registries.actionCommands.has('move')).toBe(true);

    // Isolated custom actions
    expect(engineA.registries.actionCommands.has('whirlwind')).toBe(true);
    expect(engineA.registries.actionCommands.has('shadowstep')).toBe(false);
    expect(engineB.registries.actionCommands.has('shadowstep')).toBe(true);
    expect(engineB.registries.actionCommands.has('whirlwind')).toBe(false);

    // Static facade points to B
    expect(ActionRegistry.has('shadowstep')).toBe(true);
    expect(ActionRegistry.has('whirlwind')).toBe(false);

    // Acting on A switches ActionRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(ActionRegistry.has('whirlwind')).toBe(true);
    expect(ActionRegistry.has('shadowstep')).toBe(false);
  });

  it('keeps two engines built from different spell manifests separate', () => {
    const engineA = engineWith([], [], [], [spellDef('frostbolt')]);
    const engineB = engineWith([], [], [], [spellDef('pyroblast')]);

    expect(engineA.registries.spells.has('frostbolt')).toBe(true);
    expect(engineA.registries.spells.has('pyroblast')).toBe(false);
    expect(engineB.registries.spells.has('pyroblast')).toBe(true);
    expect(engineB.registries.spells.has('frostbolt')).toBe(false);

    // Static facade & proxy point to B
    expect(SpellRegistry.has('pyroblast')).toBe(true);
    expect(SpellRegistry.has('frostbolt')).toBe(false);
    expect(getSpell('pyroblast')).toBeDefined();
    expect(getSpell('frostbolt')).toBeUndefined();
    expect(SPELL_REGISTRY['pyroblast']).toBeDefined();
    expect(SPELL_REGISTRY['frostbolt']).toBeUndefined();

    // Acting on A switches SpellRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(SpellRegistry.has('frostbolt')).toBe(true);
    expect(SpellRegistry.has('pyroblast')).toBe(false);
    expect(getSpell('frostbolt')).toBeDefined();
    expect(getSpell('pyroblast')).toBeUndefined();
    expect(SPELL_REGISTRY['frostbolt']).toBeDefined();
    expect(SPELL_REGISTRY['pyroblast']).toBeUndefined();
  });

  it('keeps two engines built from different companion manifests separate', () => {
    const engineA = engineWith([], [], [], [], [companionDef('wolf_hound')]);
    const engineB = engineWith([], [], [], [], [companionDef('snow_leopard')]);

    expect(engineA.registries.companions.has('wolf_hound')).toBe(true);
    expect(engineA.registries.companions.has('snow_leopard')).toBe(false);
    expect(engineB.registries.companions.has('snow_leopard')).toBe(true);
    expect(engineB.registries.companions.has('wolf_hound')).toBe(false);

    // Static facade points to B
    expect(CompanionRegistry.has('snow_leopard')).toBe(true);
    expect(CompanionRegistry.has('wolf_hound')).toBe(false);

    // Acting on A switches CompanionRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(CompanionRegistry.has('wolf_hound')).toBe(true);
    expect(CompanionRegistry.has('snow_leopard')).toBe(false);
  });
});
