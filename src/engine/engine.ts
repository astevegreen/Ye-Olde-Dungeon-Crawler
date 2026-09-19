import type { ActionResult, Position, VisualEffectDescriptor } from './types';
import {
  MonsterRegistryStore,
  processDefaultMonsterStore,
  TrapRegistryStore,
  processDefaultTrapStore,
  ActionRegistryStore,
  processDefaultActionStore,
  SpellRegistryStore,
  processDefaultSpellStore,
  CompanionRegistryStore,
  processDefaultCompanionStore,
  activateRegistries,
  type EngineRegistries,
} from './registries';
import { BASE_ACTION_COST } from './types';
import type { GameEvent } from './events';
import { GameMap } from './grid/map';
import type { Entity } from './entities/entity';
import { Player } from './entities/player';
import { Monster, type AiState } from './entities/monster';
import { NPC } from './entities/npc';
import { Companion } from './entities/companion';
import { EnergyScheduler } from './scheduler';
import { FovManager } from './fov/fov-manager';
import type { Action } from './actions/action';
import { WaitAction } from './actions/wait';
import { DeathResolver } from './combat/deathResolver';
import { TownMapGenerator } from './town/townMap';
import type { Merchant } from './economy/merchant';
import { DungeonArc } from './quest/dungeonArc';
import { GameStateManager } from './quest/gameStateManager';
import { flightRecorder } from './debug/flightRecorder';
import { PRNG } from './dungeon/prng';
import { WanderingMonsterSpawner } from './dungeon/wandering-spawner';
import { createScaledMonster } from './dungeon/spawner';
import type { Item } from './items/item';
import { CompendiumManager } from './compendium/compendiumManager';
import { AffinityMatrix, DEFAULT_AFFINITY_MATRIX } from './magic/elements';
import { FloorManager } from './world/floorManager';
import { PlaneManager } from './world/planeManager';
import type { SurfaceGrid } from './surfaces/surfaceGrid';
import type { SubstanceGrid } from './environment/substanceGrid';
import { SpellPipeline } from './magic/spellPipeline';
import { findSafeSpawnPosition } from './spatial/collisionSolver';
import { ActionPipeline } from './actions/actionPipeline';
import { MonsterRegistry } from './bestiary/monsterDefinitions';
import { StatusHandlerRegistry } from './status/statusHandlers';
import type { StatusHandler } from './status/statusHandlers';
import { AiBehaviorRegistry } from './ai/aiBehaviorRegistry';
import { AIRegistry } from './ai/aiRegistry';
import {
  type WorldState,
  createWorldState,
  cloneWorldState,
  getFlag,
  setFlag,
  getCounter,
  incrementCounter,
  getFaction,
  modifyFaction,
} from './state/worldState';
import type { ChoiceDefinition } from './types/choice';
import { applyConsequences } from './actions/choiceAction';
import { PactManager } from './pacts/pactManager';
import { validateManifest, type GameContentManifest } from './types/manifest';
import { EngineCommandBus, type GameCommandBus } from './commands/commandBus';
import { IdentificationManager } from './items/identification';
import { attuneRuneOfReturn, findRuneOfReturn, createRuneOfReturnActionHooks, RuneOfReturnItem } from './magic/runeOfReturn';

const DEFAULT_EMPTY_MANIFEST: GameContentManifest = {
  id: 'generic',
  name: 'Generic Dungeon',
  monsters: [],
  items: [],
  spells: [],
  town: {
    name: 'Town',
    width: 50,
    height: 30,
    playerSpawn: { x: 25, y: 15 },
    stairsDown: { x: 25, y: 18 },
    buildings: [],
    npcs: [],
  },
  quest: {
    id: 'generic_quest',
    name: 'The Descent',
    maxFloor: 5,
    bossFloor: 5,
    bossMonsterId: 'boss',
    relicItemId: 'relic',
    victoryNpcId: 'elder',
    victoryFloor: 0,
    victoryDialogue: 'Victory!',
    victoryScoreBonus: 5000,
    bossFloorLayout: {
      width: 30,
      height: 30,
      playerSpawn: { x: 15, y: 25 },
      stairsUp: { x: 15, y: 27 },
      bossSpawn: { x: 15, y: 5 },
    },
    floorEncounters: {},
  },
  atlas: { themeId: 'default' },
  starterKit: { weaponItemId: 'dagger' },
};

export interface EngineConfig {
  map: GameMap;
  player: Player;
  seed?: number;
  prng?: PRNG;
  fovRadius?: number;
  floor?: number;
  merchants?: Map<string, Merchant>;
  storedFloors?: Map<number, GameMap>;
  storedFov?: Map<number, FovManager>;
  gameState?: GameStateManager;
  manifest?: GameContentManifest;
  compendium?: CompendiumManager;
  floorManager?: FloorManager;
  planeManager?: PlaneManager;
  worldState?: WorldState;
}

export interface SpawnMonsterOptions {
  position?: Position;
  aiState?: AiState;
}

export interface DiagnosticsAPI {
  spawnMonster(definitionId: string, options?: SpawnMonsterOptions): Monster | null;
  spawnItem(item: Item): { placedInPack: boolean; groundTile?: Position };
  toggleGodMode(): boolean;
  revealFloorMap(): void;
}

export class GameEngine {
  public readonly diagnostics: DiagnosticsAPI;
  public readonly prng: PRNG;
  /**
   * This engine's own content registries (ARCHITECTURE.md §3, P-22).
   */
  public readonly registries: EngineRegistries;
  public rng: () => number;
  public map: GameMap;
  public readonly player: Player;
  /** The player's summoned companion, if any (ARCHITECTURE.md P-14). At most one at a time. */
  public companion: Companion | null = null;
  /**
   * A companion that died in combat, kept (not discarded) so a trainer can revive
   * it — heal + reattach the same instance, pack contents intact (ARCHITECTURE.md
   * P-14 Phase 2, see `DeathResolver.resolveDeath`). Session-only: not persisted
   * across save/load — a save made while a companion awaits revival loses that
   * opportunity on reload, same as Phase 1 treats "no companion" as the baseline.
   */
  public deadCompanionRecord: Companion | null = null;
  public readonly scheduler: EnergyScheduler;
  public fov: FovManager;
  public readonly messages: string[];
  public turnCount: number;
  public fovRadius: number;
  public get surfaces(): SurfaceGrid {
    return this.map.surfaces;
  }
  public get substances(): SubstanceGrid {
    return this.map.substances;
  }
  public currentFloor: number;
  public readonly storedFloors: Map<number, GameMap> = new Map();
  public readonly storedFov: Map<number, FovManager> = new Map();
  public readonly merchants: Map<string, Merchant> = new Map();
  public readonly gameState: GameStateManager;
  public readonly manifest: GameContentManifest;
  public readonly affinityMatrix: AffinityMatrix;
  public readonly compendium: CompendiumManager;
  public readonly wanderingSpawner: WanderingMonsterSpawner;
  public readonly floorManager: FloorManager;
  public readonly planeManager: PlaneManager;
  public readonly identification: IdentificationManager;
  public worldState: WorldState;
  public onNpcInteract?: (npc: NPC) => void;
  public onFloorChanged?: (floor: number) => void;
  public onChoiceInteract?: (
    choice: ChoiceDefinition,
    onOptionSelected: (optionId: string) => void,
    onCancel?: () => void
  ) => void;
  public pendingVisualEffects: VisualEffectDescriptor[] = [];
  public onVisualEffect?: (effect: VisualEffectDescriptor) => void;
  public detectMonstersTurns = 0;
  public detectObjectsTurns = 0;
  public readonly discoveryEvents: Array<{
    type: 'floor_transition' | 'secret_door' | 'trap_disarmed' | 'boss_slain' | 'close_call' | 'pact_sealed' | 'quest_milestone' | 'general';
    text: string;
    floor: number;
    turn: number;
    timestamp: number;
    icon?: string;
  }> = [];
  public onDiscoveryEvent?: (event: {
    type: 'floor_transition' | 'secret_door' | 'trap_disarmed' | 'boss_slain' | 'close_call' | 'pact_sealed' | 'quest_milestone' | 'general';
    text: string;
    floor: number;
    turn: number;
    timestamp: number;
    icon?: string;
  }) => void;
  public onMessageLogged?: (message: string) => void;
  private _lastCloseCallTurn?: number;

  public emitDiscovery(event: {
    type: 'floor_transition' | 'secret_door' | 'trap_disarmed' | 'boss_slain' | 'close_call' | 'pact_sealed' | 'quest_milestone' | 'general';
    text: string;
    icon?: string;
  }): void {
    const fullEvent = {
      ...event,
      floor: this.currentFloor,
      turn: this.turnCount,
      timestamp: Date.now(),
    };
    this.discoveryEvents.push(fullEvent);
    if (this.discoveryEvents.length > 100) {
      this.discoveryEvents.shift();
    }
    if (this.onDiscoveryEvent) {
      this.onDiscoveryEvent(fullEvent);
    }
  }

  public onGameEvent?: (event: GameEvent) => void;
  public readonly recentGameEvents: GameEvent[] = [];
  public lastActionResult: ActionResult | null = null;
  public lastActionName: string | null = null;

  /**
   * Active event captures, innermost last. `ActionPipeline` opens one per action so the
   * events an action emits can ride back on its `ActionResult` (§4). A stack rather than a
   * single buffer because composite actions perform sub-actions inside the outer boundary.
   */
  private readonly eventCaptures: GameEvent[][] = [];

  /** Starts capturing emitted events; pass the returned buffer to `endEventCapture`. */
  public beginEventCapture(): GameEvent[] {
    const buffer: GameEvent[] = [];
    this.eventCaptures.push(buffer);
    return buffer;
  }

  /** Stops the capture started by `beginEventCapture` and returns what it collected. */
  public endEventCapture(buffer: GameEvent[]): GameEvent[] {
    const idx = this.eventCaptures.lastIndexOf(buffer);
    if (idx >= 0) this.eventCaptures.splice(idx, 1);
    return buffer;
  }

  public emitGameEvent(event: GameEvent): void {
    for (const capture of this.eventCaptures) {
      capture.push(event);
    }
    this.recentGameEvents.push(event);
    if (this.recentGameEvents.length > 20) {
      this.recentGameEvents.shift();
    }
    if (this.onGameEvent) {
      this.onGameEvent(event);
    }
  }

  public recordVisualEffects(effects: VisualEffectDescriptor[]): void {
    if (effects && effects.length > 0) {
      this.pendingVisualEffects.push(...effects);
      if (this.onVisualEffect) {
        for (const ef of effects) {
          this.onVisualEffect(ef);
        }
      }
    }
  }

  public consumePendingVisualEffects(): VisualEffectDescriptor[] {
    const ef = this.pendingVisualEffects;
    this.pendingVisualEffects = [];
    return ef;
  }
  public readonly actionPipeline: ActionPipeline;
  public readonly pacts: PactManager;
  public readonly commandBus: GameCommandBus;
  public isPaused: boolean = false;

  constructor(config: EngineConfig) {
    this.prng = config.prng ?? new PRNG(config.seed ?? 1337);
    this.rng = () => this.prng.next();
    this.manifest = config.manifest ?? DEFAULT_EMPTY_MANIFEST;
    validateManifest(this.manifest);
    this.map = config.map;
    this.player = config.player;
    this.identification = new IdentificationManager(this.manifest);
    this.commandBus = new EngineCommandBus(this);
    this.scheduler = new EnergyScheduler();
    this.fov = new FovManager(this.map.width, this.map.height);
    this.messages = [];
    this.turnCount = 0;
    this.fovRadius = config.fovRadius ?? 8;
    this.currentFloor = config.floor ?? 1;
    // This engine's registries. Seeded from the process default so fixtures registered
    // before construction (a common test shape) remain visible, then made active so the
    // static lookup paths resolve against this engine — today's behaviour for a
    // single-engine process, per-engine ownership for everything reached via
    // `engine.registries` (ARCHITECTURE.md §3, P-22).
    const monsterStore = new MonsterRegistryStore();
    monsterStore.seedFrom(processDefaultMonsterStore());
    const trapStore = new TrapRegistryStore();
    trapStore.seedFrom(processDefaultTrapStore());
    const actionStore = new ActionRegistryStore();
    actionStore.seedFrom(processDefaultActionStore());
    const spellStore = new SpellRegistryStore();
    spellStore.seedFrom(processDefaultSpellStore());
    const companionStore = new CompanionRegistryStore();
    companionStore.seedFrom(processDefaultCompanionStore());
    this.registries = {
      monsters: monsterStore,
      traps: trapStore,
      actionCommands: actionStore,
      spells: spellStore,
      companions: companionStore,
    };
    activateRegistries(this.registries);

    SpellPipeline.ensureBuiltinEffects();
    if (this.manifest.spells && this.manifest.spells.length > 0) {
      this.registries.spells.registerAll(this.manifest.spells);
    }
    if (this.manifest.monsters && this.manifest.monsters.length > 0) {
      this.registries.monsters.registerAll(this.manifest.monsters);
    }
    if (this.manifest.companions && this.manifest.companions.length > 0) {
      this.registries.companions.registerAll(this.manifest.companions);
    }
    if (this.manifest.traps && this.manifest.traps.length > 0) {
      this.registries.traps.registerAll(this.manifest.traps);
    }
    if (this.manifest.statusHandlers) {
      StatusHandlerRegistry.registerAll(this.manifest.statusHandlers);
    }
    // Override status handler narrative text from manifest.statusEffects definitions
    if (this.manifest.statusEffects && Array.isArray(this.manifest.statusEffects)) {
      for (const se of this.manifest.statusEffects) {
        if (!se.applyMessage && !se.tickMessage && !se.expireMessage) continue;
        const existing = StatusHandlerRegistry.get(se.id);
        if (!existing) continue;
        const capturedOnTick = existing.onTick;
        const overridden: StatusHandler = {
          ...existing,
          ...(se.applyMessage ? {
            onApply: (entity, _effect, _engine) => se.applyMessage!.replace('{name}', entity.name),
          } : {}),
          ...(se.tickMessage ? {
            onTick: (entity, effect, engine) => {
              if (capturedOnTick) {
                const res = capturedOnTick(entity, effect, engine);
                return { ...res, message: se.tickMessage!.replace('{name}', entity.name) };
              }
              return { damageTaken: 0, killed: false, message: se.tickMessage!.replace('{name}', entity.name) };
            },
          } : {}),
          ...(se.expireMessage ? {
            onExpire: (entity, _engine) => se.expireMessage!.replace('{name}', entity.name),
          } : {}),
        };
        StatusHandlerRegistry.register(se.id, overridden);
      }
    }
    if (this.manifest.aiBehaviors) {
      AiBehaviorRegistry.registerAll(this.manifest.aiBehaviors);
    }
    if (this.manifest.aiStrategies) {
      AIRegistry.registerAll(this.manifest.aiStrategies);
    }
    if (this.manifest.actionCommands) {
      this.registries.actionCommands.registerAll(this.manifest.actionCommands);
    }
    this.affinityMatrix = this.manifest.affinityMatrix
      ? new AffinityMatrix(this.manifest.affinityMatrix)
      : DEFAULT_AFFINITY_MATRIX;
    this.compendium = config.compendium ?? new CompendiumManager();
    this.wanderingSpawner = new WanderingMonsterSpawner();
    this.floorManager = config.floorManager ?? new FloorManager();
    this.planeManager = config.planeManager ?? new PlaneManager();
    this.gameState = config.gameState ?? new GameStateManager();
    this.gameState.updateFloor(this.currentFloor);
    this.actionPipeline = new ActionPipeline();
    this.actionPipeline.registerHooks(createRuneOfReturnActionHooks());
    if (this.manifest.actionHooks && this.manifest.actionHooks.length > 0) {
      this.actionPipeline.registerHooks(this.manifest.actionHooks);
    }
    if (this.manifest.progressionConfig && !this.player.progressionConfig) {
      this.player.progressionConfig = this.manifest.progressionConfig;
    }
    this.worldState = config.worldState
      ? cloneWorldState(config.worldState)
      : (this.manifest.initialWorldState ? cloneWorldState(this.manifest.initialWorldState) : createWorldState());

    this.pacts = new PactManager(this, this.manifest.pacts);
    this.player.pactMutatorsSupplier = () => this.pacts.getAggregatedMutators();

    if (config.merchants) {
      for (const [k, m] of config.merchants) {
        this.merchants.set(k, m);
      }
    }

    if (config.storedFloors) {
      for (const [k, m] of config.storedFloors) {
        this.storedFloors.set(k, m);
        this.floorManager.recordDeparture(k, m, config.storedFov?.get(k), m.lastVisitedTick ?? 0);
      }
    }
    this.storedFloors.set(this.currentFloor, this.map);

    if (config.storedFov) {
      for (const [k, v] of config.storedFov) {
        this.storedFov.set(k, v);
      }
    }
    this.storedFov.set(this.currentFloor, this.fov);

    // Register player
    this.map.addEntity(this.player);
    this.scheduler.addEntity(this.player);
    if (this.player.energy < BASE_ACTION_COST) {
      this.player.energy = BASE_ACTION_COST;
    }

    // Register all initial living map entities into scheduler
    for (const entity of this.map.getAllEntities()) {
      if (entity !== this.player && entity.isAlive()) {
        this.scheduler.addEntity(entity);
      }
    }

    // Initialize Triage & Diagnostic Public API
    this.diagnostics = {
      spawnMonster: (definitionId: string, options?: SpawnMonsterOptions): Monster | null => {
        if (!this.player) return null;

        let spawnTile: Position | undefined = options?.position;
        if (!spawnTile) {
          const neighbors: Position[] = [
            { x: this.player.x + 1, y: this.player.y },
            { x: this.player.x - 1, y: this.player.y },
            { x: this.player.x, y: this.player.y + 1 },
            { x: this.player.x, y: this.player.y - 1 },
            { x: this.player.x + 1, y: this.player.y + 1 },
            { x: this.player.x - 1, y: this.player.y - 1 },
          ];
          spawnTile = neighbors.find(
            (n) => this.map.isPassable(n.x, n.y) && !this.map.getEntityAt(n.x, n.y)
          );
        }

        if (!spawnTile) {
          return null;
        }

        const def = MonsterRegistry.get(definitionId);
        if (!def) {
          return null;
        }

        const monster = createScaledMonster(
          def,
          this.nextSimulationId(`mob-${definitionId}`),
          spawnTile,
          this.currentFloor,
          undefined,
          undefined,
          this.manifest.monsterScaling,
          this.player.difficulty
        );
        monster.aiState = options?.aiState ?? 'hunting';

        const added = this.addEntity(monster);
        return added ? monster : null;
      },

      spawnItem: (item: Item): { placedInPack: boolean; groundTile?: Position } => {
        if (!this.player) {
          return { placedInPack: false };
        }
        if (item instanceof RuneOfReturnItem) {
          this.absorbRuneOfReturn(item);
          return { placedInPack: true };
        }
        const added = this.player.addItem(item);
        if (added) {
          return { placedInPack: true };
        }
        this.map.addItemAt(this.player.x, this.player.y, item);
        return { placedInPack: false, groundTile: { x: this.player.x, y: this.player.y } };
      },

      toggleGodMode: (): boolean => {
        if (!this.player) return false;
        this.player.isInvulnerable = !this.player.isInvulnerable;
        return this.player.isInvulnerable;
      },

      revealFloorMap: (): void => {
        this.fov.revealAllTiles();
        this.log('A mystical vision reveals the entire floor layout.');
      },
    };

    this.updateFov();
  }

  public updateFov(): void {
    const pactFovMod = this.pacts?.getAggregatedMutators().fovRadiusModifier ?? 0;
    const baseRadius = Math.max(2, this.fovRadius + pactFovMod);
    // Generic perception-radius override (ARCHITECTURE.md P-26): any active status whose
    // handler declares `perceptionRadius` forces that radius; the most restrictive wins.
    // Generalizes what was previously a blindness-only hardcoded case.
    let perceptionOverride: number | null = null;
    for (const effect of this.player.statusManager.getAllActive()) {
      const handler = StatusHandlerRegistry.get(effect.type);
      if (handler?.perceptionRadius !== undefined) {
        perceptionOverride = perceptionOverride === null
          ? handler.perceptionRadius
          : Math.min(perceptionOverride, handler.perceptionRadius);
      }
    }
    const effectiveRadius = perceptionOverride ?? baseRadius;
    this.fov.update(this.map, this.player.x, this.player.y, effectiveRadius);

    // AI State Awakening & Compendium Discovery bounded to visible FOV radius:
    const minX = Math.max(0, this.player.x - effectiveRadius);
    const maxX = Math.min(this.map.width - 1, this.player.x + effectiveRadius);
    const minY = Math.max(0, this.player.y - effectiveRadius);
    const maxY = Math.min(this.map.height - 1, this.player.y + effectiveRadius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.fov.isVisible(x, y)) {
          const entities = this.map.getEntitiesAt(x, y);
          for (const entity of entities) {
            if (entity instanceof Monster && entity.isAlive()) {
              const disc = this.compendium.recordEncounter(entity.definitionId, entity.name, this.currentFloor);
              if (disc.advanced) {
                this.log(`*** Bestiary Updated: You encountered ${entity.name}! ***`);
              }

              if (entity.aiState === 'sleeping') {
                entity.aiState = 'hunting';
                this.log(`${entity.name} stirs awake and begins hunting you!`);
              }
            }
          }
        }
      }
    }
  }

  public hasFeature(flag: string): boolean {
    return Boolean(this.manifest.featureFlags?.[flag]);
  }

  /**
   * Registers an already-constructed companion onto the active map and scheduler
   * (ARCHITECTURE.md P-14). Generic attach point used by both `summonCompanion()`
   * and save/load restoration (`storage/serializer.ts`).
   */
  public attachCompanion(companion: Companion): void {
    this.companion = companion;
    if (!this.map.getEntityAt(companion.x, companion.y) || this.map.getEntityAt(companion.x, companion.y) === companion) {
      this.map.addEntity(companion);
    } else {
      // Do NOT pass the player as entityToIgnore here: the player legitimately
      // occupies their own tile, and the companion must land on a genuinely free
      // neighboring tile, not on top of them.
      const spawn = findSafeSpawnPosition(this.map, { x: this.player.x, y: this.player.y }, 5);
      companion.x = spawn.x;
      companion.y = spawn.y;
      this.map.addEntity(companion);
    }
    if (companion.isAlive()) {
      this.scheduler.addEntity(companion);
    }
  }

  /** World-state flag set once by `TrainerService.bondCompanion()` (ARCHITECTURE.md P-14 Phase 2). */
  public static readonly COMPANION_BONDED_FLAG = 'companion_bonded';

  /**
   * Summons a companion by definition ID near the player. Returns null if one is
   * already summoned, the definition is unknown, or the player has not yet bonded
   * with a companion (§9 P-14 Phase 2 acquisition gate — see `TrainerService`).
   */
  public summonCompanion(definitionId: string): Companion | null {
    if (this.companion) return null;
    if (!this.getWorldFlag(GameEngine.COMPANION_BONDED_FLAG)) {
      this.log('You have not yet bonded with a companion. Seek out a trainer in town.');
      return null;
    }
    const spawn = findSafeSpawnPosition(this.map, { x: this.player.x, y: this.player.y }, 5);
    const companion = Companion.fromDefinition(definitionId, this.nextSimulationId(`companion-${definitionId}`), spawn);
    if (!companion) return null;
    this.attachCompanion(companion);
    this.log(`${companion.name} answers your call!`);
    return companion;
  }

  /** Dismisses the active companion, if any, removing it from the current floor. */
  public dismissCompanion(): void {
    if (!this.companion) return;
    this.map.removeEntity(this.companion);
    this.scheduler.removeEntity(this.companion);
    this.log(`${this.companion.name} is dismissed.`);
    this.companion = null;
  }

  public getWorldFlag(flag: string): boolean {
    return getFlag(this.worldState, flag);
  }

  public setWorldFlag(flag: string, value: boolean): void {
    setFlag(this.worldState, flag, value);
  }

  public getWorldCounter(counter: string): number {
    return getCounter(this.worldState, counter);
  }

  public modifyWorldCounter(counter: string, delta: number = 1): number {
    return incrementCounter(this.worldState, counter, delta);
  }

  public getFactionStanding(faction: string): number {
    return getFaction(this.worldState, faction);
  }

  public modifyFactionStanding(faction: string, delta: number): number {
    return modifyFaction(this.worldState, faction, delta);
  }

  public get ticks(): number {
    return this.scheduler.ticks;
  }

  public addEntity(entity: Entity): boolean {
    const addedToMap = this.map.addEntity(entity);
    if (!addedToMap) {
      return false;
    }
    this.scheduler.addEntity(entity);
    return true;
  }

  public removeEntity(entity: Entity): boolean {
    const removedFromMap = this.map.removeEntity(entity);
    this.scheduler.removeEntity(entity);
    return removedFromMap;
  }

  public log(message: string): void {
    this.messages.push(message);
    if (this.messages.length > 150) {
      this.messages.shift();
    }
    if (this.onMessageLogged) {
      this.onMessageLogged(message);
    }
  }

  public interactWithNpc(npc: NPC): void {
    const victoryNpcId = this.manifest.quest?.victoryNpcId;
    const eligibleEndingId = victoryNpcId && npc.id === victoryNpcId ? this.gameState.checkVictoryEligible(this) : undefined;
    if (eligibleEndingId) {
      this.gameState.triggerVictory(this, undefined, eligibleEndingId === 'default' ? undefined : eligibleEndingId);
      return;
    }
    // Rune of Return attunement (ARCHITECTURE.md P-03 stage 3): a pack-declared NPC id
    // triggers a full refill. The mechanism is fixed; the trigger and its flavor are
    // entirely content-provided, so a pack with no NPC configured simply has no
    // in-town refill (the item/channel mechanic itself still works).
    const attunementNpcId = this.manifest.runeOfReturn?.attunementNpcId;
    if (attunementNpcId && npc.id === attunementNpcId) {
      this.log(`Spoke with ${npc.name}: "${npc.greeting}"`);
      const item = findRuneOfReturn(this.player);
      this.log(item ? attuneRuneOfReturn(item) : `${npc.name} has nothing to attune — you carry no Rune of Return.`);
      if (this.onNpcInteract) {
        this.onNpcInteract(npc);
      }
      return;
    }
    this.log(`Spoke with ${npc.name}: "${npc.greeting}"`);
    if (this.onNpcInteract) {
      this.onNpcInteract(npc);
    }
  }

  public changeFloor(targetFloor: number, customSpawn?: Position): void {
    activateRegistries(this.registries);
    if (targetFloor === this.currentFloor) return;
    const prevFloor = this.currentFloor;

    // 1. Store current floor map and FOV and record departure
    this.storedFloors.set(this.currentFloor, this.map);
    this.storedFov.set(this.currentFloor, this.fov);
    this.floorManager.recordDeparture(this.currentFloor, this.map, this.fov, this.turnCount);

    // 2. Remove player (and companion, which travels with them) from current map, reset scheduler
    this.map.removeEntity(this.player);
    if (this.companion) {
      this.map.removeEntity(this.companion);
    }
    this.scheduler.reset();

    // 3. Retrieve or generate target floor
    const isRevisit = Boolean(this.storedFloors.has(targetFloor));
    let nextMap = this.storedFloors.get(targetFloor);
    let targetSpawn: Position = { x: 10, y: 10 };

    if (!nextMap) {
      if (targetFloor === 0) {
        const townGen = new TownMapGenerator(undefined, undefined, this.manifest.town);
        const town = townGen.generate();
        nextMap = town.map;
        targetSpawn = { x: town.stairsDown.x, y: town.stairsDown.y + 1 };
        for (const [k, m] of town.merchants) {
          this.merchants.set(k, m);
        }
      } else {
        const effectiveMaxFloor =
          (this.manifest.quest?.allowsDifficultyScaling
            ? (this.player.maxFloor ?? this.manifest.quest.maxFloor)
            : (this.manifest.quest?.maxFloor ?? this.player.maxFloor)) ?? DungeonArc.MAX_FLOOR;
        const dynamicQuest = this.manifest.quest
          ? {
              ...this.manifest.quest,
              floorGenerators: this.manifest.quest.floorGenerators ?? this.manifest.floorGenerators,
              maxFloor: effectiveMaxFloor,
              bossFloor: effectiveMaxFloor,
            }
          : undefined;
        const density = this.pacts?.getAggregatedMutators().monsterDensityMultiplier ?? 1.0;
        const floorResult = DungeonArc.generateFloor(
          targetFloor,
          undefined,
          dynamicQuest,
          this.manifest,
          density,
          this.player.difficulty
        );
        nextMap = floorResult.map;
        targetSpawn = floorResult.playerSpawn;
      }
      this.storedFloors.set(targetFloor, nextMap);
    } else {
      // Target map already exists in cache
      if (targetFloor < prevFloor) {
        // Ascending to previous floor: locate stairs_down or fallback
        let found = false;
        for (let y = 0; y < nextMap.height; y++) {
          for (let x = 0; x < nextMap.width; x++) {
            if (nextMap.getTile(x, y)?.type === 'stairs_down') {
              targetSpawn = targetFloor === 0 ? { x, y: y + 1 } : { x, y };
              found = true;
              break;
            }
          }
          if (found) break;
        }
      } else {
        // Descending deeper: locate stairs_up or fallback
        let found = false;
        for (let y = 0; y < nextMap.height; y++) {
          for (let x = 0; x < nextMap.width; x++) {
            if (nextMap.getTile(x, y)?.type === 'stairs_up') {
              targetSpawn = { x, y };
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    if (customSpawn) {
      targetSpawn = { ...customSpawn };
    }

    // 4. Update active map and floor
    this.map = nextMap;
    const previousFloor = this.currentFloor;
    this.currentFloor = targetFloor;
    this.emitGameEvent({
      type: 'level_transition',
      turn: this.turnCount,
      actorId: this.player?.id,
      fromFloor: previousFloor,
      toFloor: targetFloor,
    });
    this.gameState.updateFloor(targetFloor);

    // Simulate catch-up on inactive revisited floors
    if (isRevisit && this.floorManager.hasFloor(targetFloor)) {
      this.floorManager.simulateCatchUp(targetFloor, this.turnCount, this);
    }

    // Retrieve or initialize FOV for target floor
    let nextFov = this.storedFov.get(targetFloor);
    if (!nextFov) {
      nextFov = new FovManager(this.map.width, this.map.height);
      this.storedFov.set(targetFloor, nextFov);
    }
    this.fov = nextFov;

    // 5. Position and register player at a guaranteed safe, unoccupied tile
    const safeSpawn = findSafeSpawnPosition(this.map, targetSpawn, 5, this.player);
    this.player.x = safeSpawn.x;
    this.player.y = safeSpawn.y;
    this.map.addEntity(this.player);
    this.scheduler.addEntity(this.player);

    // 5b. The companion travels with the player (ARCHITECTURE.md P-14)
    if (this.companion && this.companion.isAlive()) {
      // The player is already placed at safeSpawn by this point — do not ignore
      // them here, or the companion lands on the same tile and addEntity refuses it.
      const companionSpawn = findSafeSpawnPosition(this.map, safeSpawn, 5);
      this.companion.x = companionSpawn.x;
      this.companion.y = companionSpawn.y;
      this.map.addEntity(this.companion);
    } else if (this.companion) {
      // Companion died mid-transition (shouldn't normally happen); drop the reference.
      this.companion = null;
    }

    // Register only living entities on the new active map into scheduler
    for (const ent of this.map.getAllEntities()) {
      if (ent !== this.player && ent.isAlive()) {
        this.scheduler.addEntity(ent);
      }
    }

    this.updateFov();

    const effectiveMaxFloor =
      (this.manifest.quest?.allowsDifficultyScaling
        ? (this.player.maxFloor ?? this.manifest.quest.maxFloor)
        : (this.manifest.quest?.maxFloor ?? this.player.maxFloor)) ?? DungeonArc.MAX_FLOOR;
    if (targetFloor === 0) {
      this.log(`You climb up into the light of ${this.manifest.town?.name ?? 'the town'}, haven of adventurers.`);
    } else if (targetFloor >= effectiveMaxFloor) {
      this.log(this.manifest.quest?.bossLairTitle ?? `*** FLOOR ${targetFloor}: THE BOSS'S LAIR ***`);
      if (this.manifest.quest?.bossEntryMessage) {
        this.log(this.manifest.quest.bossEntryMessage);
      }
    } else {
      this.log(`You descend into the cold darkness of Floor ${targetFloor}...`);
    }

    if (this.onFloorChanged) {
      this.onFloorChanged(targetFloor);
    }

    const floorDesc = targetFloor === 0
      ? `Returned to ${this.manifest.town?.name ?? 'the town'}.`
      : targetFloor >= effectiveMaxFloor
      ? `Breached the final lair on Dungeon Level ${targetFloor}!`
      : targetFloor > prevFloor
      ? `Descended into Dungeon Level ${targetFloor}.`
      : `Ascended to Dungeon Level ${targetFloor}.`;
    this.emitDiscovery({
      type: 'floor_transition',
      text: floorDesc,
      icon: '🪜',
    });

    flightRecorder.recordState(
      'floor_transition',
      `Transitioned from Floor ${prevFloor} to Floor ${targetFloor}`,
      { prevFloor, targetFloor }
    );
  }

  public getVisitedFloors(): number[] {
    const floors = new Set<number>();
    for (const f of this.storedFloors.keys()) {
      floors.add(f);
    }
    floors.add(this.currentFloor);
    return Array.from(floors).sort((a, b) => a - b);
  }

  public getFloorMap(floor: number): GameMap | undefined {
    if (floor === this.currentFloor) return this.map;
    return this.storedFloors.get(floor);
  }

  public getFloorFov(floor: number): FovManager | undefined {
    if (floor === this.currentFloor) return this.fov;
    return this.storedFov.get(floor);
  }

  public isTileExplored(floor: number, x: number, y: number): boolean {
    const fov = this.getFloorFov(floor);
    return fov ? fov.isExplored(x, y) : false;
  }

  /**
   * Dispatches an action on behalf of the player through the action pipeline.
   */
  public dispatchAction(action: Action): ActionResult {
    return this.handlePlayerAction(action);
  }

  /**
   * Processes a player action. If the action succeeds and consumes energy,
   * turns are advanced and AI entities process their queued actions until
   * the player is once again ready to act. A monster-turn failure isolated during
   * the turn is surfaced on the returned result as `pipelineError`.
   */
  public handlePlayerAction(action: Action): ActionResult {
    activateRegistries(this.registries);
    const failuresBefore = this.actionPipeline.caughtExceptionCount;
    return this.surfaceIsolatedTurnFailures(this.executePlayerTurn(action), failuresBefore);
  }

  private executePlayerTurn(action: Action): ActionResult {
    if (!this.player.isAlive()) {
      return {
        success: false,
        cost: 0,
        message: 'You have perished.',
      };
    }

    // Check Player Paralysis / Stun: forces pass turn
    if (this.player.statusManager.hasStatus('paralysis') || this.player.statusManager.hasStatus('stunned')) {
      const effectName = this.player.statusManager.hasStatus('stunned') ? 'stunned' : 'paralyzed';
      this.log(`You are ${effectName} and unable to act!`);
      new WaitAction(this.player).perform(this);
      this.turnCount += 1;
      if (this.currentFloor >= 1) {
        this.map.floorTurnCount = (this.map.floorTurnCount ?? 0) + 1;
      }
      this.player.statusManager.tick(this.player, this);
      this.updateFov();
      this.advanceWorldUntilPlayerTurn();
      this.updateFov();
      return {
        success: false,
        cost: BASE_ACTION_COST,
        message: `You are ${effectName}!`,
      };
    }

    // Ensure player has energy to act; if not, advance scheduler
    if (!this.player.canAct()) {
      this.advanceWorldUntilPlayerTurn();
    }

    const result = this.actionPipeline.executeWithHooks(action, this);
    this.lastActionResult = result;
    this.lastActionName = (action as any).actionType ?? action.constructor.name;
    if (result.effects && result.effects.length > 0) {
      this.recordVisualEffects(result.effects);
    }

    flightRecorder.recordState(
      'action',
      `Player performed ${action.constructor.name} (${result.success ? 'Success' : 'Failed'})`,
      { action: action.constructor.name, success: result.success, cost: result.cost }
    );

    if (result.success && result.cost > 0) {
      this.turnCount += 1;
      if (this.currentFloor >= 1) {
        this.map.floorTurnCount = (this.map.floorTurnCount ?? 0) + 1;
      }
      // Per-turn environmental updates, each inside its own boundary (ARCHITECTURE.md §4).
      this.runEnvironmentalUpdate('player-status-tick', () => {
        const tickRes = this.player.statusManager.tick(this.player, this);
        if (tickRes.killed) {
          DeathResolver.resolveDeath(this, undefined, this.player);
        }
      });
      this.runEnvironmentalUpdate('surface-tick', () => this.surfaces.tick(this));
      this.runEnvironmentalUpdate('substance-tick', () => this.substances.tickSubstances(this.map, this));
      this.runEnvironmentalUpdate('plane-drift', () => this.planeManager.tickDrift(this.map, this.scheduler.ticks, this));
      this.runEnvironmentalUpdate('wandering-spawn', () => this.wanderingSpawner.checkAndSpawn(this, this.rng));
      this.runEnvironmentalUpdate('floor-respawn', () => this.floorManager.checkClearedFloorRespawn(this));
      this.runEnvironmentalUpdate('timed-events-tick', () => this.tickTimedEvents());

      if (this.detectMonstersTurns > 0) this.detectMonstersTurns -= 1;
      if (this.detectObjectsTurns > 0) this.detectObjectsTurns -= 1;

      this.updateFov();
      this.advanceWorldUntilPlayerTurn();
      this.updateFov();

      // Close call discovery (HP <= 20%)
      if (
        this.player.isAlive() &&
        this.player.hp > 0 &&
        this.player.hp <= Math.ceil(this.player.maxHp * 0.2) &&
        (!this._lastCloseCallTurn || this.turnCount - this._lastCloseCallTurn > 10)
      ) {
        this._lastCloseCallTurn = this.turnCount;
        this.emitDiscovery({
          type: 'close_call',
          text: `Surviving on a razor's edge with only ${this.player.hp}/${this.player.maxHp} HP!`,
          icon: '🩸',
        });
      }
    }

    // Check for Rune of Return acquisition
    if (!this.player.hasDiscoveredRune && findRuneOfReturn(this.player)) {
      this.player.hasDiscoveredRune = true;
      this.emitGameEvent({
        type: 'rune_of_return_discovered',
        turn: this.turnCount,
        actorId: this.player.id,
      });
    }

    return result;
  }

  /**
   * Absorbs the physical Rune of Return into the player's spirit as an innate power.
   * Transfers charges, marks hasDiscoveredRune, dissolves any physical copies from
   * inventory/ground, logs the spiritual binding, and fires rune_of_return_discovered.
   */
  public absorbRuneOfReturn(item?: Item): void {
    if (!this.player) return;
    if (item instanceof RuneOfReturnItem) {
      this.player.runeCharges = item.charges;
      this.player.runeMaxCharges = item.maxCharges;
    } else {
      this.player.runeCharges = this.player.runeCharges ?? 3;
      this.player.runeMaxCharges = this.player.runeMaxCharges ?? 3;
    }
    const wasDiscovered = this.player.hasDiscoveredRune;
    this.player.hasDiscoveredRune = true;

    // Dissolve any physical rune items in player inventory
    if (item && item.id) {
      this.player.inventory?.primaryPack?.removeItem(item.id);
    }
    const carriedRunes = this.player.inventory?.getAllCarriedItems?.().filter(
      (i) => i instanceof RuneOfReturnItem && i.id !== 'innate_rune_of_return'
    ) ?? [];
    for (const r of carriedRunes) {
      this.player.inventory?.primaryPack?.removeItem(r.id);
    }

    this.log('*** The Rune of Return dissolves into a pulse of ethereal light, binding its power directly to your spirit! ***');
    if (!wasDiscovered) {
      this.emitGameEvent({
        type: 'rune_of_return_discovered',
        turn: this.turnCount,
        actorId: this.player.id,
      });
    }
  }

  /**
   * Advances simulation ticks and processes AI monster actions until
   * the player has sufficient energy to take their next action (or until game over).
   */
  public advanceWorldUntilPlayerTurn(maxIterations = 5000): void {
    activateRegistries(this.registries);
    if (this.isPaused) {
      return;
    }

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations += 1;

      if (!this.player.isAlive()) {
        return;
      }

      // 1. Process monster that has accumulated sufficient energy to act (zero-allocation pass)
      let bestMonster: Entity | null = null;
      const entities = this.scheduler.getEntities();
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.isAlive() && e.canAct() && e.type !== 'player') {
          if (!bestMonster) {
            bestMonster = e;
          } else {
            const energyDiff = e.energy - bestMonster.energy;
            if (energyDiff > 0) {
              bestMonster = e;
            } else if (energyDiff === 0 && e.id < bestMonster.id) {
              bestMonster = e;
            }
          }
        }
      }

      if (bestMonster) {
        this.processMonsterAction(bestMonster);
        continue;
      }

      // 2. If no monsters are ready and the player has sufficient energy, it is the player's turn
      if (this.player.canAct()) {
        return;
      }

      // 3. Advance ticks until an actor reaches action energy
      const nextActor = this.scheduler.advanceToNextActor();
      if (!nextActor) {
        return;
      }

      if (nextActor.type !== 'player') {
        this.processMonsterAction(nextActor);
      }
    }
  }

  /**
   * Monster AI behavior delegation, inside a failure boundary (ARCHITECTURE.md §4): an
   * exception from a monster's status ticks, AI, or action is isolated and recorded rather
   * than escaping `handlePlayerAction()`.
   */
  private processMonsterAction(entity: Entity): void {
    if (!entity.isAlive()) {
      return;
    }

    if (entity instanceof Monster) {
      const energyBefore = entity.energy;
      try {
        const res = entity.takeTurn(this);
        if (res?.effects && res.effects.length > 0) {
          this.recordVisualEffects(res.effects);
        }
      } catch (err) {
        this.actionPipeline.recordIsolatedFailure(
          err,
          this,
          {
            entityId: entity.id,
            actionType: `${entity.constructor.name}.takeTurn`,
            phase: 'monster-turn',
            source: 'GameEngine.processMonsterAction',
          },
          `An unexpected error disrupted ${entity.name}'s turn.`
        );
        // A turn that threw before spending energy would be reselected at once, spinning the scheduler.
        if (entity.energy >= energyBefore) {
          entity.consumeEnergy(BASE_ACTION_COST);
        }
      }
    } else {
      // Non-monster safety: consume energy to prevent scheduler deadlocks
      entity.consumeEnergy(BASE_ACTION_COST);
    }
  }

  /**
   * Ticks every `manifest.timedEvents` entry (ARCHITECTURE.md §3). Runs every player
   * turn, whether or not any event has started, so the countdown genuinely keeps
   * running while the player takes other actions rather than only being checked when
   * something else happens to touch it.
   */
  private tickTimedEvents(): void {
    const events = this.manifest.timedEvents;
    if (!events || events.length === 0) return;

    for (const def of events) {
      if (this.getWorldFlag(def.resolvedFlag)) continue;
      if (!this.getWorldFlag(def.startFlag)) continue;

      const startCounterKey = `timed_event_start:${def.id}`;
      let startTurn = this.getWorldCounter(startCounterKey);
      if (startTurn === 0 && !this.getWorldFlag(`timed_event_started:${def.id}`)) {
        // First tick observing startFlag true: this turn is turn zero of the countdown.
        startTurn = this.turnCount;
        this.modifyWorldCounter(startCounterKey, startTurn);
        this.setWorldFlag(`timed_event_started:${def.id}`, true);
      }

      if (this.turnCount - startTurn >= def.turnLimit) {
        applyConsequences(def.expireConsequences, this, this.player);
        this.setWorldFlag(def.resolvedFlag, true);
        if (def.expireMessage) {
          this.log(def.expireMessage);
        }
      }
    }
  }

  /**
   * Runs one per-turn environmental update inside its own failure boundary
   * (ARCHITECTURE.md §4). A failure is recorded through the same counters as pipeline and
   * monster-turn failures — so the turn's result is marked `pipelineError` — and the
   * remaining updates still run: a throwing surface tick must not silently skip
   * substances, spawns, or the floor-respawn check.
   */
  private runEnvironmentalUpdate(label: string, update: () => void): void {
    try {
      update();
    } catch (err) {
      this.actionPipeline.recordIsolatedFailure(
        err,
        this,
        {
          entityId: this.player?.id ?? 'world',
          actionType: label,
          phase: 'environmental-update',
          source: 'GameEngine.executePlayerTurn',
        },
        'Something in the world misbehaved; play continues.'
      );
    }
  }

  /** Marks a player turn's result as `pipelineError` if any monster turn failed during it. */
  private surfaceIsolatedTurnFailures(result: ActionResult, failuresBefore: number): ActionResult {
    if (result.pipelineError || this.actionPipeline.caughtExceptionCount === failuresBefore) {
      return result;
    }
    const surfaced: ActionResult = {
      ...result,
      pipelineError: true,
      message: "An unexpected error disrupted another creature's turn; play continues.",
    };
    this.lastActionResult = surfaced;
    return surfaced;
  }

  /**
   * Deterministic id for anything spawned during simulation. Derived from turn count and
   * the seeded PRNG (which persists in the save), so one seed replays to the same ids
   * (ARCHITECTURE.md §7.2). Never derive simulation ids from the clock.
   */
  public nextSimulationId(prefix: string): string {
    return `${prefix}-${this.turnCount}-${this.prng.nextInt(100000, 999999)}`;
  }

  /** Pauses or resumes world advancement; driven by the modal stack (ARCHITECTURE.md §6). */
  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }
}
