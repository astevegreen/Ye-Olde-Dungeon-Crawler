import type { ActionResult, Position, VisualEffectDescriptor } from './types';
import { BASE_ACTION_COST } from './types';
import { GameMap } from './grid/map';
import type { Entity } from './entities/entity';
import { Player } from './entities/player';
import { Monster } from './entities/monster';
import { NPC } from './entities/npc';
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
import { CompendiumManager } from './compendium/compendiumManager';
import { AffinityMatrix, DEFAULT_AFFINITY_MATRIX } from './magic/elements';
import { TownReturnManager } from './townReturn/townReturnManager';
import { FloorManager } from './world/floorManager';
import { PlaneManager } from './world/planeManager';
import type { SurfaceGrid } from './surfaces/surfaceGrid';
import type { SubstanceGrid } from './environment/substanceGrid';
import { registerSpells } from './magic/spellRegistry';
import { SpellPipeline } from './magic/spellPipeline';
import { findSafeSpawnPosition } from './spatial/collisionSolver';
import { ActionPipeline } from './actions/actionPipeline';
import { MonsterRegistry } from './bestiary/monsterDefinitions';
import { TrapRegistry } from './traps/trapRegistry';
import { StatusHandlerRegistry } from './status/statusHandlers';
import type { StatusHandler } from './status/statusHandlers';
import { AiBehaviorRegistry } from './ai/aiBehaviorRegistry';
import { ActionRegistry } from './actions/actionRegistry';
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
import { PactManager } from './pacts/pactManager';
import { validateManifest, type GameContentManifest } from './types/manifest';
import { EngineCommandBus, type GameCommandBus } from './commands/commandBus';
import { IdentificationManager } from './items/identification';

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
  townReturnManager?: TownReturnManager;
  floorManager?: FloorManager;
  planeManager?: PlaneManager;
  worldState?: WorldState;
}

export class GameEngine {
  public readonly prng: PRNG;
  public rng: () => number;
  public map: GameMap;
  public readonly player: Player;
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
  public readonly townReturnManager: TownReturnManager;
  public readonly floorManager: FloorManager;
  public readonly planeManager: PlaneManager;
  public readonly identification: IdentificationManager;
  public worldState: WorldState;
  public onNpcInteract?: (npc: NPC) => void;
  public onFloorChanged?: (floor: number) => void;
  public onWinchInteract?: (winch: any) => void;
  public onTownReturnInteract?: (
    fixture: {
      type: 'runic_conduit' | 'valkyrie_sprint' | 'dwarven_winch' | 'town_portal';
      position: Position;
      fixtureData?: any;
    },
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;
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
    SpellPipeline.ensureBuiltinEffects();
    if (this.manifest.spells && this.manifest.spells.length > 0) {
      registerSpells(this.manifest.spells);
    }
    if (this.manifest.monsters && this.manifest.monsters.length > 0) {
      MonsterRegistry.registerAll(this.manifest.monsters);
    }
    if (this.manifest.traps && this.manifest.traps.length > 0) {
      TrapRegistry.registerAll(this.manifest.traps);
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
      ActionRegistry.registerAll(this.manifest.actionCommands);
    }
    this.affinityMatrix = this.manifest.affinityMatrix
      ? new AffinityMatrix(this.manifest.affinityMatrix)
      : DEFAULT_AFFINITY_MATRIX;
    this.compendium = config.compendium ?? new CompendiumManager();
    this.wanderingSpawner = new WanderingMonsterSpawner();
    this.townReturnManager = config.townReturnManager ?? new TownReturnManager();
    this.floorManager = config.floorManager ?? new FloorManager();
    this.planeManager = config.planeManager ?? new PlaneManager();
    this.gameState = config.gameState ?? new GameStateManager();
    this.gameState.updateFloor(this.currentFloor);
    this.actionPipeline = new ActionPipeline();
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

    this.updateFov();
  }

  public updateFov(): void {
    const pactFovMod = this.pacts?.getAggregatedMutators().fovRadiusModifier ?? 0;
    const baseRadius = Math.max(2, this.fovRadius + pactFovMod);
    const effectiveRadius = this.player.statusManager.hasStatus('blindness') ? 1 : baseRadius;
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
    if (victoryNpcId && npc.id === victoryNpcId && this.gameState.checkVictoryEligible(this)) {
      this.gameState.triggerVictory(this);
      return;
    }
    this.log(`Spoke with ${npc.name}: "${npc.greeting}"`);
    if (this.onNpcInteract) {
      this.onNpcInteract(npc);
    }
  }

  public changeFloor(targetFloor: number, customSpawn?: Position): void {
    if (targetFloor === this.currentFloor) return;
    const prevFloor = this.currentFloor;

    // 1. Store current floor map and FOV and record departure
    this.storedFloors.set(this.currentFloor, this.map);
    this.storedFov.set(this.currentFloor, this.fov);
    this.floorManager.recordDeparture(this.currentFloor, this.map, this.fov, this.turnCount);

    // 2. Remove player from current map and reset scheduler
    this.map.removeEntity(this.player);
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
        const floorResult = DungeonArc.generateFloor(targetFloor, undefined, dynamicQuest, this.manifest, density);
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
    this.currentFloor = targetFloor;
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
      if (this.townReturnManager?.townPortal?.active) {
        this.townReturnManager.townPortal.ensureSpawnedInTown(this.map);
      }
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
   * Processes a player action. If the action succeeds and consumes energy,
   * turns are advanced and AI entities process their queued actions until
   * the player is once again ready to act.
   */
  public handlePlayerAction(action: Action): ActionResult {
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
      const tickRes = this.player.statusManager.tick(this.player, this);
      if (tickRes.killed) {
        DeathResolver.resolveDeath(this, undefined, this.player);
      }

      this.surfaces.tick(this);
      this.substances.tickSubstances(this.map, this);
      this.planeManager.tickDrift(this.map, this.scheduler.ticks, this);
      this.wanderingSpawner.checkAndSpawn(this, this.rng);
      this.townReturnManager.onPlayerTurn(this);

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

    return result;
  }

  /**
   * Advances simulation ticks and processes AI monster actions until
   * the player has sufficient energy to take their next action (or until game over).
   */
  public advanceWorldUntilPlayerTurn(maxIterations = 5000): void {
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
   * Monster AI behavior delegation.
   */
  private processMonsterAction(entity: Entity): void {
    if (!entity.isAlive()) {
      return;
    }

    if (entity instanceof Monster) {
      const res = entity.takeTurn(this);
      if (res?.effects && res.effects.length > 0) {
        this.recordVisualEffects(res.effects);
      }
    } else {
      // Non-monster safety: consume energy to prevent scheduler deadlocks
      entity.consumeEnergy(BASE_ACTION_COST);
    }
  }
}
