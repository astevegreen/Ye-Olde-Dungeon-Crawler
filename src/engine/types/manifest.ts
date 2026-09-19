import type { Position } from '../types';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { SpellDefinition } from '../magic/types';
import type { ItemCategory, ItemQuality, EquipmentSlot, ItemStatModifiers, Item, RangedWeaponConfig } from '../items/item';
import type { ContainerType } from '../items/container';
import type { PotionType } from '../items/consumables';
import type { CoinDenomination } from '../economy/types';
import type { NpcRole } from '../entities/npc';
import type { AffinityMatrixConfig } from '../magic/elements';
import type { EquipmentSlotDefinition, EquipmentSlotLayout } from '../inventory/paperdoll';
import type { ThemeTokens } from './theme';
import type { VaultBlueprint } from '../dungeon/vaultStamp';
import type { StatusHandler } from '../status/statusHandlers';
import type { ActionHook } from '../actions/actionPipeline';
import type { AiBehaviorStrategy } from '../ai/aiBehaviorRegistry';
import type { CombatConfig, ProgressionConfig, LevelUpBonus } from './config';
import type { WorldState } from '../state/worldState';
import type { Predicate } from '../predicates/types';
import type { ChoiceDefinition, ChoiceOption, ChoiceConsequence } from './choice';
import type { HookDescriptor } from '../hooks/hookDispatcher';
import type { RunPactDefinition } from '../pacts/pactManager';
import type { CompanionDefinition } from '../entities/companion';
import type { MonsterScalingConfig } from './monsterScaling';

export interface MerchantConfig {
  id: string;
  name: string;
  greeting: string;
  markupRatio?: number;
  markdownRatio?: number;
  initialInventory: Item[];
  predicate?: Predicate;
}

export type ConsumableEffectDescriptor =
  | { type: 'restore_hp'; amount: number | string }
  | { type: 'restore_mana'; amount: number | string }
  | { type: 'cure_status'; status: string }
  | { type: 'apply_status'; status: string; duration: number; potency?: number }
  | { type: 'gain_xp'; amount: number }
  | { type: 'gain_stat'; stat: string; amount: number }
  | { type: 'teleport'; range?: number; random?: boolean }
  | {
      /**
       * Tag-Filtered Radial Aura (ARCHITECTURE.md P-25): applies `status` to every
       * living entity within `radius` of the user matching any of `tags` (e.g. a
       * holy torch blinding undead within 4 tiles). Uses the same bounded
       * `findTaggedEntitiesInRadius` query the `radialAuraFilter` hook primitive
       * uses — see `combat/radialAuraFilter.ts`.
       */
      type: 'radial_status';
      radius: number;
      tags: string[];
      status: string;
      duration: number;
      potency?: number;
    };

export interface ItemDefinition {
  id: string;
  name: string;
  unidentifiedName?: string;
  category: ItemCategory;
  slot?: EquipmentSlot;
  minFloor?: number;
  tier?: number;
  weight: number;
  bulk: number;
  quality?: ItemQuality;
  stats?: Partial<ItemStatModifiers>;
  identified?: boolean;
  description?: string;
  value?: number;
  itemType?: string;
  containerConfig?: {
    containerType: ContainerType;
    maxWeightCapacity: number;
    maxBulkCapacity: number;
    maxSlots?: number;
    acceptedCategories?: readonly string[];
  };
  wandConfig?: {
    spellId: string;
    charges: number;
    maxCharges: number;
  };
  scrollConfig?: {
    spellId: string;
  };
  potionConfig?: {
    effects?: ConsumableEffectDescriptor[];
    potionType?: PotionType;
    potency?: number;
  };
  coinConfig?: {
    denomination: CoinDenomination;
    count: number;
  };
  twoHanded?: boolean;
  blocksSlot?: string;
  rangedConfig?: RangedWeaponConfig;
  predicate?: Predicate;
  hooks?: HookDescriptor[];
}

export const BUILTIN_ITEM_TYPES = ['standard', 'container', 'wand', 'scroll', 'potion', 'coin'] as const;

export interface ItemAliasPools {
  potions?: string[];
  scrolls?: string[];
  wands?: string[];
  rings?: string[];
  amulets?: string[];
  [category: string]: string[] | undefined;
}

export type TrapType = string;
export const BUILTIN_TRAP_TYPES = ['pit', 'arrow', 'teleport', 'alarm'] as const;

export interface TrapDefinition {
  type: TrapType;
  name: string;
  damage?: number;
  message?: string;
  disarmDifficulty?: number;
}

export interface SurfaceTypeDefinition {
  id: string;
  name: string;
  moveCostBonus?: number;
  damagePerTurn?: number;
  gasType?: string;
}

export interface StatusEffectDefinition {
  id: string;
  name: string;
  applyMessage?: string;
  tickMessage?: string;
  expireMessage?: string;
  damagePerTick?: number;
  potency?: number;
}

export interface TrackedMilestoneDefinition {
  flag: string;
  label: string;
  description?: string;
  icon?: string;
}

/**
 * A cumulative renown-granting milestone (Milestone Renown Ledger, ARCHITECTURE.md P-23).
 * Distinct from TrackedMilestoneDefinition: that is a flag-based display list for the
 * World Ledger sidebar, while this drives a scalar per-category renown score used for
 * title thresholds (`RenownTitleDefinition`) and vendor-unlock predicates (`minCounter`
 * against the `renown:<category>` world-state counter this produces).
 */
export interface RenownMilestoneDefinition {
  /** Stable ID. Engine call sites (e.g. UncurseAction, SearchAction) record milestones
   *  by ID; a milestone with no matching definition in the active manifest is a no-op,
   *  the same way an unregistered actionHook/statusHandler is. */
  id: string;
  /** Renown category, e.g. 'exploration' | 'combat'. Free-form to allow campaign-specific categories. */
  category: string;
  label: string;
  description?: string;
  icon?: string;
  renownValue: number;
  /** Default false: fires once per character (tracked via an internal world-state flag). */
  repeatable?: boolean;
  /** Optional world-state flag to also set when this milestone first fires, so it can
   *  double as a `trackedMilestones` entry in the World Ledger. */
  flag?: string;
}

/** A title unlocked once renown in `category` (or total renown, if omitted) reaches `threshold`. */
export interface RenownTitleDefinition {
  title: string;
  threshold: number;
  category?: string;
}

export interface FlankLayoutConfig {
  left?: string[];
  right?: string[];
  theme?: 'parchment' | 'slate' | 'retro-win31' | 'cyber' | string;
}

export interface TownBuildingDefinition {
  name: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  door: { x: number; y: number; isOpen?: boolean };
  buildingType?: 'temple' | 'bank' | 'shop' | 'smithy' | 'house' | 'generic';
}


export interface TownServicesDefinition {
  templeName?: string;
  priestTitle?: string;
  cleanseMessageTemplate?: string;
  noCursesMessage?: string;
  donationRequiredTemplate?: string;
  healMessageTemplate?: string;
  sageName?: string;
  sageTitle?: string;
  bankName?: string;
  bankerTitle?: string;
  compactionMessageTemplate?: string;
}

export interface TownNpcDefinition {
  id: string;
  name: string;
  role: NpcRole;
  position: Position;
  greeting: string;
  dialogText?: string;
  shopId?: string;
  merchantConfig?: MerchantConfig;
  isStationary?: boolean;
  predicate?: Predicate;
}

export interface TownLayoutDefinition {
  name: string;
  width: number;
  height: number;
  playerSpawn: Position;
  stairsDown: Position;
  buildings: TownBuildingDefinition[];
  npcs: TownNpcDefinition[];
  services?: TownServicesDefinition;
}

export interface FloorEncounterConfig {
  monsterIds: string[];
  minMonsters: number;
  maxMonsters: number;
}

export interface BossFloorLayoutDefinition {
  width: number;
  height: number;
  playerSpawn: Position;
  stairsUp: Position;
  bossSpawn: Position;
  pillars?: Position[];
  guards?: Array<{ definitionId: string; position: Position }>;
}

export interface QuestArcDefinition {
  id: string;
  name: string;
  maxFloor: number;
  bossFloor: number;
  allowsDifficultyScaling?: boolean;
  bossMonsterId: string;
  relicItemId: string;
  victoryNpcId: string;
  victoryFloor: number;
  victoryDialogue: string;
  victoryScoreBonus: number;
  relicDropMessage?: string;
  victoryEpitaph?: string;
  championProclamation?: string;
  bossLairTitle?: string;
  bossEntryMessage?: string;
  bossFloorLayout: BossFloorLayoutDefinition;
  floorEncounters: Record<number, FloorEncounterConfig>;
  floorGenerators?: Record<number, string>;
  defaultGenerator?: string;
  /**
   * Multiple named victory endings (ARCHITECTURE.md §3) — a gap surfaced by a
   * branching campaign finale (e.g. slaying vs. driving off the same boss). Each
   * `EndingDefinition` has its own eligibility condition and text, generalizing the
   * flat `victoryDialogue`/`victoryEpitaph`/`championProclamation`/
   * `victoryScoreBonus`/`relicItemId`/`victoryFloor` fields above, which remain the
   * sole, default ending when this is omitted — existing packs are unaffected.
   * `GameStateManager.checkVictoryEligible` checks each in insertion order and
   * returns the first whose condition holds.
   */
  endings?: Record<string, EndingDefinition>;
}

/** See `QuestArcDefinition.endings`. */
export interface EndingDefinition {
  id: string;
  /** Eligibility, evaluated the same way the base flat fields are: the player must
   *  be on `victoryFloor` (defaults to the quest's own `victoryFloor`) and satisfy
   *  at least one of `relicItemId` (carrying it), `requiredFlag` (world-state flag
   *  set), or `requiredMonsterKillId` (that monster's `GameEngine.compendium` kill
   *  count is at least 1 — cross-floor-safe and needs no extra flag-setting for the
   *  common "did the player kill X" condition). */
  relicItemId?: string;
  requiredFlag?: string;
  requiredMonsterKillId?: string;
  victoryFloor?: number;
  victoryDialogue: string;
  victoryEpitaph: string;
  championProclamation?: string;
  victoryScoreBonus?: number;
}

/**
 * Resolves a boss encounter as "driven off" rather than killed (ARCHITECTURE.md
 * §3) — a branching-finale gap: the existing `fleeHealthPercent` mechanic already
 * makes a monster flee at low HP, but nothing converts sustained fleeing into a
 * concluded encounter. Checked in `movement.ts` (full `GameEngine` access) each
 * player turn: while the named monster is alive, on the active floor, and
 * `aiState === 'fleeing'`, a turn counter accrues; once it reaches
 * `fleeTurnsRequired`, `sealedFlag` is set (once) and the monster is removed from
 * the map, so the fight cannot simply resume once it stops.
 */
export interface BossFleeResolution {
  monsterDefinitionId: string;
  fleeTurnsRequired: number;
  sealedFlag: string;
}

/**
 * Unlocks a `ChoiceDefinition` once a monster (by `definitionId`) has been slain a
 * given number of times (ARCHITECTURE.md §3) — a gap surfaced by a climactic choice
 * with no fixed map location to trigger from (no engine mechanism guarantees a
 * hand-placed special room on a procedurally generated non-final floor; only the
 * quest's own boss floor gets that treatment). Reads `GameEngine.compendium`
 * (kill counts are tracked there per `definitionId` already, cross-floor and
 * persisted), so it's checked in `movement.ts` — which has real `GameEngine`
 * access — rather than an action hook (whose `EngineContext` deliberately can't
 * reach the compendium or open a choice modal; ARCHITECTURE.md §3).
 */
export interface StoryChoiceTrigger {
  /** Stable id, used for its own `<id>_offered`/`<id>_started` internal flags. */
  id: string;
  choiceId: string;
  monsterDefinitionId: string;
  killsRequired: number;
  /** World-state flag set (if not already) the moment the first qualifying kill is
   *  observed — before `killsRequired` is reached — so a `TimedEventDefinition` can
   *  start counting down from first contact rather than only once the full
   *  threshold, if the story point should feel pressured before it's fully unlocked. */
  progressStartFlag?: string;
}

/**
 * A turn-limited world event (ARCHITECTURE.md §3) — a gap surfaced by a climactic
 * story choice that needed to feel time-pressured rather than a calm, simulation-
 * paused dialogue menu. Ticked once per player turn by `GameEngine` (a `'timed-
 * events-tick'` environmental update, alongside surfaces/substances/spawns) rather
 * than gated behind a modal, so the countdown keeps running while the player acts.
 */
export interface TimedEventDefinition {
  id: string;
  /** World-state flag whose becoming true starts this event's countdown (checked
   *  once per tick; the turn it first reads true is turn zero of the countdown). */
  startFlag: string;
  /** Turns after `startFlag` first reads true before `expireConsequences` fire. */
  turnLimit: number;
  /** World-state flag marking this event as manually resolved. If true by the time
   *  the timer would expire, expiry is skipped entirely — content sets this itself
   *  (e.g. as a `setFlag` consequence on whatever in-world action resolves the
   *  event) before the timer runs out. Also set automatically the moment expiry
   *  *does* fire, so a expired event never re-fires. */
  resolvedFlag: string;
  /** Applied via the same `applyConsequences` used by choice resolution, once,
   *  exactly when the timer expires unresolved. */
  expireConsequences: ChoiceConsequence[];
  /** Logged when expiry fires. Content usually also narrates the moment itself via
   *  a `logMessage` consequence; this is a fallback/redundant nudge, not required. */
  expireMessage?: string;
}

export interface TileZoneBand {
  floor: number;
  zoneKey: string;
  label?: string;
}

export interface AtlasProceduralTheme<TContext = any> {
  themeId: string;
  renderTile?: (
    ctx: TContext,
    key: string,
    ox: number,
    oy: number,
    size: number
  ) => boolean | void;
  renderers?: Record<
    string,
    (ctx: TContext, ox: number, oy: number, size: number) => void
  >;
  palette?: Record<string, string>;
  tileZoneBands?: TileZoneBand[];
}


export interface StarterKitDefinition {
  weaponItemId: string;
  purseItemId?: string;
  coins?: Array<{ denomination: CoinDenomination; count: number }>;
  beltItemId?: string;
  beltSlotItemIds?: string[];
  packItemIds?: string[];
  spellsKnown?: string[];
}

export type SpriteRecipe<TContext = any> = (
  ctx: TContext,
  ox: number,
  oy: number,
  size: number
) => void;

export interface GameContentManifest {
  id: string;
  name: string;
  description?: string;
  monsters: MonsterDefinition[];
  items: ItemDefinition[];
  spells: SpellDefinition[];
  town: TownLayoutDefinition;
  quest: QuestArcDefinition;
  atlas: AtlasProceduralTheme;
  starterKit: StarterKitDefinition;
  affinityMatrix?: AffinityMatrixConfig;
  equipmentSlots?: EquipmentSlotDefinition[];
  theme?: Partial<ThemeTokens>;
  floorGenerators?: Record<number, string>;
  vaults?: VaultBlueprint[];
  advisorQuotes?: string[];
  spriteRecipes?: Record<string, SpriteRecipe>;
  presetNames?: string[];
  statusHandlers?: Record<string, StatusHandler>;
  actionHooks?: ActionHook[];
  aiBehaviors?: Record<string, AiBehaviorStrategy>;
  actionCommands?: Record<string, import('../actions/actionRegistry').GameAction<any>>;
  aiStrategies?: Record<string, import('../ai/aiRegistry').AIStrategy>;
  modalLayouts?: Record<string, any>;
  keybindings?: Record<string, any>;
  featureFlags?: Record<string, boolean>;
  combatConfig?: CombatConfig;
  progressionConfig?: ProgressionConfig;
  /** Zone-tiered, difficulty-scaled monster power (ARCHITECTURE.md §3). When omitted,
   * `dungeon/spawner.ts`'s monster-scaling functions fall back to the flat per-floor curve. */
  monsterScaling?: MonsterScalingConfig;
  initialWorldState?: WorldState;
  choices?: Record<string, ChoiceDefinition>;
  pacts?: RunPactDefinition[];
  traps?: TrapDefinition[];
  itemAliasPools?: ItemAliasPools;
  surfaceTypes?: SurfaceTypeDefinition[];
  statusEffects?: StatusEffectDefinition[];
  /** When true, the storage layer will also check legacy un-namespaced save keys for backward compatibility. Set to true for the COTW manifest only. */
  supportsLegacyKeys?: boolean;
  trackedMilestones?: TrackedMilestoneDefinition[];
  renownMilestones?: RenownMilestoneDefinition[];
  renownTitles?: RenownTitleDefinition[];
  companions?: CompanionDefinition[];
  flankLayout?: FlankLayoutConfig;
  /** Turn-limited world events (ARCHITECTURE.md §3, `TimedEventDefinition`). */
  timedEvents?: TimedEventDefinition[];
  /** Kill-count-gated choice unlocks (ARCHITECTURE.md §3, `StoryChoiceTrigger`). */
  storyChoiceTriggers?: StoryChoiceTrigger[];
  /** "Driven off" boss resolutions (ARCHITECTURE.md §3, `BossFleeResolution`). */
  bossFleeResolutions?: BossFleeResolution[];
  /**
   * Pack-neutral wiring for the Rune of Return (ARCHITECTURE.md P-03 stage 3). The
   * mechanic (channel timing, banking, mobility, interrupt rules) is fixed engine
   * logic; only presentation and the town refill trigger vary per pack. `undefined`
   * disables the attunement-on-interact hook, but the item/channel mechanic itself
   * still works without it (charges just can't be refilled).
   */
  runeOfReturn?: RuneOfReturnManifestConfig;
}

/** See `GameContentManifest.runeOfReturn`. */
export interface RuneOfReturnManifestConfig {
  /** NPC id whose interaction triggers a full, free, instant charge refill (the base
   * pack's dwarven rune-smith at the forge; another pack reskins by pointing this at
   * its own NPC). */
  attunementNpcId?: string;
  /** Pack-provided display names for the three progression tracks, shown in logs and
   * (eventually) the level-up UI. Falls back to generic engine names. */
  trackNames?: { celerity?: string; weave?: string; mobility?: string };
}

export type {
  CombatConfig,
  ProgressionConfig,
  LevelUpBonus,
  EquipmentSlotDefinition,
  EquipmentSlotLayout,
  WorldState,
  Predicate,
  ChoiceDefinition,
  ChoiceOption,
  ChoiceConsequence,
  RunPactDefinition,
};

/**
 * Validates that a GameContentManifest contains all required fields.
 * Throws a descriptive error if any required field is missing.
 * Call this at GameEngine construction time to catch misconfigured manifests early.
 */
export function validateManifest(manifest: GameContentManifest): void {
  if (!manifest || typeof manifest !== 'object') return;
  if (!manifest.id || typeof manifest.id !== 'string') {
    throw new Error(
      `[GameContentManifest] Manifest must have a non-empty string 'id' field.`
    );
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error(
      `[GameContentManifest] Manifest '${manifest.id}' must have a non-empty string 'name' field.`
    );
  }
  // Only validate array fields if explicitly provided but wrong type
  const arrayFields: Array<keyof GameContentManifest> = ['monsters', 'items', 'spells'];
  for (const key of arrayFields) {
    const val = (manifest as any)[key];
    if (val !== undefined && val !== null && !Array.isArray(val)) {
      throw new Error(
        `[GameContentManifest] Manifest '${manifest.id}' field '${key}' must be an array when provided.`
      );
    }
  }
}
