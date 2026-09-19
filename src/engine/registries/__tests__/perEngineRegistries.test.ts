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
import { AIRegistry, type AIStrategy } from '../../ai/aiRegistry';
import { AiBehaviorRegistry, type AiBehaviorStrategy } from '../../ai/aiBehaviorRegistry';
import { StatusHandlerRegistry, type StatusHandler } from '../../status/statusHandlers';
import { TileRegistry, getTileDefinition, hasTileDefinition } from '../../grid/tile';
import { Item } from '../../items/item';
import { itemIndex, getItemById } from '../../items/itemIndex';
import { WaitAction } from '../../actions/wait';
import { processDefaultMonsterStore, setActiveMonsterStore } from '../monsterRegistryStore';
import { processDefaultTrapStore, setActiveTrapStore } from '../trapRegistryStore';
import { setActiveActionStore } from '../actionRegistryStore';
import { processDefaultSpellStore, setActiveSpellStore } from '../spellRegistryStore';
import { processDefaultCompanionStore, setActiveCompanionStore } from '../companionRegistryStore';
import { setActiveAIStrategyStore } from '../aiStrategyRegistryStore';
import { setActiveAIBehaviorStore } from '../aiBehaviorRegistryStore';
import { setActiveStatusHandlerStore } from '../statusHandlerRegistryStore';
import { setActiveTileStore } from '../tileRegistryStore';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
import type { TrapDefinition, TrapType } from '../../types/manifest';
import type { SpellDefinition } from '../../magic/types';
import type { TileDefinition } from '../../types';

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

const aiStrategyDef = (id: string): AIStrategy => ({
  id,
  name: id,
  decideAction: (actor) => new WaitAction(actor),
});

const aiBehaviorDef = (id: string): AiBehaviorStrategy => ({
  id,
  name: id,
  decideAction: (monster) => new WaitAction(monster),
});

const statusDef = (message: string): StatusHandler => ({
  onExpire: () => message,
});

const tileDef = (type: string): TileDefinition => ({
  type,
  name: type,
  passable: true,
  walkable: true,
  transparent: true,
  glyph: '%',
  description: `${type} tile`,
});

function engineWith(
  monsters: MonsterDefinition[],
  traps: TrapDefinition[] = [],
  actionCommands: GameAction[] = [],
  spells: SpellDefinition[] = [],
  companions: CompanionDefinition[] = [],
  aiStrategies: AIStrategy[] = [],
  aiBehaviors: Record<string, AiBehaviorStrategy> = {},
  statusHandlers: Record<string, StatusHandler> = {},
  tiles: TileDefinition[] = []
): GameEngine {
  return new GameEngine({
    map: new GameMap(10, 10, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 } }),
    manifest: {
      id: 'test',
      name: 'Test',
      monsters,
      traps,
      actionCommands,
      spells,
      companions,
      aiStrategies,
      aiBehaviors,
      statusHandlers,
      tiles,
    } as never,
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
    AIRegistry.resetToDefaults();
    setActiveAIStrategyStore(null);
    AiBehaviorRegistry.resetToDefaults();
    setActiveAIBehaviorStore(null);
    StatusHandlerRegistry.resetToDefaults();
    setActiveStatusHandlerStore(null);
    TileRegistry.resetToDefaults();
    setActiveTileStore(null);
    itemIndex.clear();
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

  it('keeps two engines built from different AI strategy manifests separate', () => {
    const engineA = engineWith([], [], [], [], [], [aiStrategyDef('flank_attack')]);
    const engineB = engineWith([], [], [], [], [], [aiStrategyDef('ambush_strike')]);

    // Both inherit default strategies
    expect(engineA.registries.aiStrategies.has('aggressive_melee')).toBe(true);
    expect(engineB.registries.aiStrategies.has('aggressive_melee')).toBe(true);

    // Isolated custom strategies
    expect(engineA.registries.aiStrategies.has('flank_attack')).toBe(true);
    expect(engineA.registries.aiStrategies.has('ambush_strike')).toBe(false);
    expect(engineB.registries.aiStrategies.has('ambush_strike')).toBe(true);
    expect(engineB.registries.aiStrategies.has('flank_attack')).toBe(false);

    // Static facade points to B
    expect(AIRegistry.has('ambush_strike')).toBe(true);
    expect(AIRegistry.has('flank_attack')).toBe(false);

    // Acting on A switches AIRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(AIRegistry.has('flank_attack')).toBe(true);
    expect(AIRegistry.has('ambush_strike')).toBe(false);
  });

  it('keeps two engines built from different AI behavior manifests separate', () => {
    const engineA = engineWith([], [], [], [], [], [], { tactical_retreat: aiBehaviorDef('tactical_retreat') });
    const engineB = engineWith([], [], [], [], [], [], { berserk_charge: aiBehaviorDef('berserk_charge') });

    // Both inherit default behaviors (e.g. melee)
    expect(engineA.registries.aiBehaviors.has('melee')).toBe(true);
    expect(engineB.registries.aiBehaviors.has('melee')).toBe(true);

    // Isolated custom behaviors
    expect(engineA.registries.aiBehaviors.has('tactical_retreat')).toBe(true);
    expect(engineA.registries.aiBehaviors.has('berserk_charge')).toBe(false);
    expect(engineB.registries.aiBehaviors.has('berserk_charge')).toBe(true);
    expect(engineB.registries.aiBehaviors.has('tactical_retreat')).toBe(false);

    // Static facade points to B
    expect(AiBehaviorRegistry.has('berserk_charge')).toBe(true);
    expect(AiBehaviorRegistry.has('tactical_retreat')).toBe(false);

    // Acting on A switches AiBehaviorRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(AiBehaviorRegistry.has('tactical_retreat')).toBe(true);
    expect(AiBehaviorRegistry.has('berserk_charge')).toBe(false);
  });

  it('keeps two engines built from different status handler manifests separate', () => {
    const engineA = engineWith([], [], [], [], [], [], {}, { frozen: statusDef('thawed') });
    const engineB = engineWith([], [], [], [], [], [], {}, { cursed: statusDef('cleansed') });

    // Both inherit builtin statuses (e.g. poison, blindness)
    expect(engineA.registries.statusHandlers.has('poison')).toBe(true);
    expect(engineB.registries.statusHandlers.has('poison')).toBe(true);

    // Isolated custom status handlers
    expect(engineA.registries.statusHandlers.has('frozen')).toBe(true);
    expect(engineA.registries.statusHandlers.has('cursed')).toBe(false);
    expect(engineB.registries.statusHandlers.has('cursed')).toBe(true);
    expect(engineB.registries.statusHandlers.has('frozen')).toBe(false);

    // Static facade points to B
    expect(StatusHandlerRegistry.has('cursed')).toBe(true);
    expect(StatusHandlerRegistry.has('frozen')).toBe(false);

    // Acting on A switches StatusHandlerRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(StatusHandlerRegistry.has('frozen')).toBe(true);
    expect(StatusHandlerRegistry.has('cursed')).toBe(false);
  });

  it('keeps two engines built from different tile manifests separate', () => {
    const engineA = engineWith([], [], [], [], [], [], {}, {}, [tileDef('elven_grass')]);
    const engineB = engineWith([], [], [], [], [], [], {}, {}, [tileDef('blighted_soil')]);

    // Both inherit canonical tiles (e.g. floor, wall)
    expect(engineA.registries.tiles.has('floor')).toBe(true);
    expect(engineB.registries.tiles.has('floor')).toBe(true);

    // Isolated custom tiles
    expect(engineA.registries.tiles.has('elven_grass')).toBe(true);
    expect(engineA.registries.tiles.has('blighted_soil')).toBe(false);
    expect(engineB.registries.tiles.has('blighted_soil')).toBe(true);
    expect(engineB.registries.tiles.has('elven_grass')).toBe(false);

    // Static facade points to B
    expect(TileRegistry.has('blighted_soil')).toBe(true);
    expect(TileRegistry.has('elven_grass')).toBe(false);
    expect(hasTileDefinition('blighted_soil')).toBe(true);
    expect(hasTileDefinition('elven_grass')).toBe(false);
    expect(getTileDefinition('blighted_soil').name).toBe('blighted_soil');

    // Acting on A switches TileRegistry to A
    engineA.handlePlayerAction(new WaitAction(engineA.player));
    expect(TileRegistry.has('elven_grass')).toBe(true);
    expect(TileRegistry.has('blighted_soil')).toBe(false);
    expect(hasTileDefinition('elven_grass')).toBe(true);
    expect(hasTileDefinition('blighted_soil')).toBe(false);
    expect(getTileDefinition('elven_grass').name).toBe('elven_grass');
  });

  it('keeps two engines strictly isolated across all registries and runtime item state over 200 interleaved turns', () => {
    const engineA = engineWith(
      [def('grunt')],
      [trapDef('dart_trap')],
      [actionDef('whirlwind')],
      [spellDef('frostbolt')],
      [companionDef('wolf_hound')],
      [aiStrategyDef('tactical_cover')],
      { tactical_retreat: aiBehaviorDef('tactical_retreat') },
      { frozen: statusDef('thawed') },
      [tileDef('elven_grass')]
    );

    const engineB = engineWith(
      [def('kobold')],
      [trapDef('fire_rune')],
      [actionDef('shadowstep')],
      [spellDef('pyroblast')],
      [companionDef('snow_leopard')],
      [aiStrategyDef('berserk_charge')],
      { berserk_rush: aiBehaviorDef('berserk_rush') },
      { cursed: statusDef('cleansed') },
      [tileDef('blighted_soil')]
    );

    // Activate Engine A and give it distinct items
    engineA.activate();
    const itemA = new Item({ id: 'item_a', name: 'Item A', category: 'misc', weight: 1, bulk: 1 });
    engineA.player.inventory.primaryPack.addItem(itemA);
    const groundA = new Item({ id: 'ground_a', name: 'Ground A', category: 'misc', weight: 1, bulk: 1 });
    engineA.map.addItemAt(3, 3, groundA);

    // Activate Engine B and give it distinct items
    engineB.activate();
    const itemB = new Item({ id: 'item_b', name: 'Item B', category: 'misc', weight: 1, bulk: 1 });
    engineB.player.inventory.primaryPack.addItem(itemB);
    const groundB = new Item({ id: 'ground_b', name: 'Ground B', category: 'misc', weight: 1, bulk: 1 });
    engineB.map.addItemAt(5, 5, groundB);

    for (let turn = 0; turn < 200; turn++) {
      // 1. Act on Engine A
      engineA.handlePlayerAction(new WaitAction(engineA.player));

      // Direct registry lookups on Engine A
      expect(engineA.registries.monsters.has('grunt')).toBe(true);
      expect(engineA.registries.monsters.has('kobold')).toBe(false);
      expect(engineA.registries.traps.has('dart_trap')).toBe(true);
      expect(engineA.registries.traps.has('fire_rune')).toBe(false);
      expect(engineA.registries.actionCommands.has('whirlwind')).toBe(true);
      expect(engineA.registries.actionCommands.has('shadowstep')).toBe(false);
      expect(engineA.registries.spells.has('frostbolt')).toBe(true);
      expect(engineA.registries.spells.has('pyroblast')).toBe(false);
      expect(engineA.registries.companions.has('wolf_hound')).toBe(true);
      expect(engineA.registries.companions.has('snow_leopard')).toBe(false);
      expect(engineA.registries.aiStrategies.has('tactical_cover')).toBe(true);
      expect(engineA.registries.aiStrategies.has('berserk_charge')).toBe(false);
      expect(engineA.registries.aiBehaviors.has('tactical_retreat')).toBe(true);
      expect(engineA.registries.aiBehaviors.has('berserk_rush')).toBe(false);
      expect(engineA.registries.statusHandlers.has('frozen')).toBe(true);
      expect(engineA.registries.statusHandlers.has('cursed')).toBe(false);
      expect(engineA.registries.tiles.has('elven_grass')).toBe(true);
      expect(engineA.registries.tiles.has('blighted_soil')).toBe(false);
      expect(engineA.registries.itemIndex.has('item_a')).toBe(true);
      expect(engineA.registries.itemIndex.has('ground_a')).toBe(true);
      expect(engineA.registries.itemIndex.has('item_b')).toBe(false);
      expect(engineA.registries.itemIndex.has('ground_b')).toBe(false);

      // Facades resolve against active Engine A
      expect(MonsterRegistry.has('grunt')).toBe(true);
      expect(MonsterRegistry.has('kobold')).toBe(false);
      expect(TrapRegistry.has('dart_trap')).toBe(true);
      expect(TrapRegistry.has('fire_rune')).toBe(false);
      expect(ActionRegistry.has('whirlwind')).toBe(true);
      expect(ActionRegistry.has('shadowstep')).toBe(false);
      expect(SpellRegistry.has('frostbolt')).toBe(true);
      expect(SpellRegistry.has('pyroblast')).toBe(false);
      expect(getSpell('frostbolt')).toBeDefined();
      expect(getSpell('pyroblast')).toBeUndefined();
      expect(CompanionRegistry.has('wolf_hound')).toBe(true);
      expect(CompanionRegistry.has('snow_leopard')).toBe(false);
      expect(AIRegistry.has('tactical_cover')).toBe(true);
      expect(AIRegistry.has('berserk_charge')).toBe(false);
      expect(AiBehaviorRegistry.has('tactical_retreat')).toBe(true);
      expect(AiBehaviorRegistry.has('berserk_rush')).toBe(false);
      expect(StatusHandlerRegistry.has('frozen')).toBe(true);
      expect(StatusHandlerRegistry.has('cursed')).toBe(false);
      expect(TileRegistry.has('elven_grass')).toBe(true);
      expect(TileRegistry.has('blighted_soil')).toBe(false);
      expect(getItemById('item_a')).toBe(itemA);
      expect(getItemById('ground_a')).toBe(groundA);
      expect(getItemById('item_b')).toBeUndefined();
      expect(getItemById('ground_b')).toBeUndefined();
      expect(itemIndex.locationOf('item_a')).toEqual({
        kind: 'container',
        containerId: engineA.player.inventory.primaryPack.id,
      });
      expect(itemIndex.locationOf('ground_a')).toEqual({ kind: 'ground', x: 3, y: 3 });

      // 2. Act on Engine B
      engineB.handlePlayerAction(new WaitAction(engineB.player));

      // Direct registry lookups on Engine B
      expect(engineB.registries.monsters.has('kobold')).toBe(true);
      expect(engineB.registries.monsters.has('grunt')).toBe(false);
      expect(engineB.registries.traps.has('fire_rune')).toBe(true);
      expect(engineB.registries.traps.has('dart_trap')).toBe(false);
      expect(engineB.registries.actionCommands.has('shadowstep')).toBe(true);
      expect(engineB.registries.actionCommands.has('whirlwind')).toBe(false);
      expect(engineB.registries.spells.has('pyroblast')).toBe(true);
      expect(engineB.registries.spells.has('frostbolt')).toBe(false);
      expect(engineB.registries.companions.has('snow_leopard')).toBe(true);
      expect(engineB.registries.companions.has('wolf_hound')).toBe(false);
      expect(engineB.registries.aiStrategies.has('berserk_charge')).toBe(true);
      expect(engineB.registries.aiStrategies.has('tactical_cover')).toBe(false);
      expect(engineB.registries.aiBehaviors.has('berserk_rush')).toBe(true);
      expect(engineB.registries.aiBehaviors.has('tactical_retreat')).toBe(false);
      expect(engineB.registries.statusHandlers.has('cursed')).toBe(true);
      expect(engineB.registries.statusHandlers.has('frozen')).toBe(false);
      expect(engineB.registries.tiles.has('blighted_soil')).toBe(true);
      expect(engineB.registries.tiles.has('elven_grass')).toBe(false);
      expect(engineB.registries.itemIndex.has('item_b')).toBe(true);
      expect(engineB.registries.itemIndex.has('ground_b')).toBe(true);
      expect(engineB.registries.itemIndex.has('item_a')).toBe(false);
      expect(engineB.registries.itemIndex.has('ground_a')).toBe(false);

      // Facades resolve against active Engine B
      expect(MonsterRegistry.has('kobold')).toBe(true);
      expect(MonsterRegistry.has('grunt')).toBe(false);
      expect(TrapRegistry.has('fire_rune')).toBe(true);
      expect(TrapRegistry.has('dart_trap')).toBe(false);
      expect(ActionRegistry.has('shadowstep')).toBe(true);
      expect(ActionRegistry.has('whirlwind')).toBe(false);
      expect(SpellRegistry.has('pyroblast')).toBe(true);
      expect(SpellRegistry.has('frostbolt')).toBe(false);
      expect(getSpell('pyroblast')).toBeDefined();
      expect(getSpell('frostbolt')).toBeUndefined();
      expect(CompanionRegistry.has('snow_leopard')).toBe(true);
      expect(CompanionRegistry.has('wolf_hound')).toBe(false);
      expect(AIRegistry.has('berserk_charge')).toBe(true);
      expect(AIRegistry.has('tactical_cover')).toBe(false);
      expect(AiBehaviorRegistry.has('berserk_rush')).toBe(true);
      expect(AiBehaviorRegistry.has('tactical_retreat')).toBe(false);
      expect(StatusHandlerRegistry.has('cursed')).toBe(true);
      expect(StatusHandlerRegistry.has('frozen')).toBe(false);
      expect(TileRegistry.has('blighted_soil')).toBe(true);
      expect(TileRegistry.has('elven_grass')).toBe(false);
      expect(getItemById('item_b')).toBe(itemB);
      expect(getItemById('ground_b')).toBe(groundB);
      expect(getItemById('item_a')).toBeUndefined();
      expect(getItemById('ground_a')).toBeUndefined();
      expect(itemIndex.locationOf('item_b')).toEqual({
        kind: 'container',
        containerId: engineB.player.inventory.primaryPack.id,
      });
      expect(itemIndex.locationOf('ground_b')).toEqual({ kind: 'ground', x: 5, y: 5 });
    }
  });
});
