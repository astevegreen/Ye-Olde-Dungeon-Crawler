import type { TileType, GameDifficulty } from '../types';
import type { EquipmentSlot, ItemCategory, ItemQuality, ItemStatModifiers, ElementalAffix } from '../items/item';
import type { ContainerType } from '../items/container';
import type { SerializedStatusEffect } from '../status/types';
import type { CoinDenomination } from '../economy/types';
import type { CharacterAttributes, Gender } from '../character/types';
import type { ElementType, ElementalAffinity } from '../magic/elements';
import type { AiBehaviorType } from '../bestiary/monsterDefinitions';
import type { AiState, MonsterIntent } from '../entities/monster';
import type { CompanionArchetype } from '../entities/companion';
import type { Position } from '../types';
import type { WorldState } from '../state/worldState';
import type { PlaneState } from '../spatial/planeTypes';
import type { SerializedSurfaceCell } from '../surfaces/surfaceGrid';
import type { SerializedSubstanceCell } from '../environment/substanceGrid';

// One-time tutorial flags, saved with the hero. Presentation's first-time hints record
// each hint shown as `hint:<FirstTimeHintId>` (`src/ui/hints/`); the keys are open, so a
// pack or a later feature can add its own without engine changes.
export interface TutorialFlags {
  [flag: string]: boolean | undefined;
}

export interface CharacterProfile {
  id: string;
  name: string;
  gender?: Gender;
  difficulty?: GameDifficulty;
  manifestId?: string;
  maxFloor?: number;
  attributes?: CharacterAttributes;
  questStatus?: 'active' | 'fallen' | 'victorious';
  epitaph?: string;
  level: number;
  floor: number;
  lastSaved: number;
  hp: number;
  maxHp: number;
  strength: number;
  mana?: number;
  maxMana?: number;
  xp?: number;
  xpToNextLevel?: number;
  compendium?: Record<string, { kills: number; tier: 0 | 1 | 2 | 3; firstEncounterFloor?: number; chosenPerk?: import('../compendium/types').MasteryPerkId }>;
  /** Chosen category-mastery perks by monster category ID. Optional; absent = none chosen. */
  compendiumCategoryPerks?: Record<string, import('../compendium/types').MasteryPerkId>;
  tutorialFlags?: TutorialFlags;
  deepestRecallFloor?: number;
  recallPosition?: Position;
  unspentStatPoints?: number;
}

export interface RosterManifest {
  profiles: CharacterProfile[];
  activeProfileId?: string;
}

export interface SerializedWandData {
  spellId: string;
  charges: number;
  maxCharges: number;
}

export interface SerializedChaoticProcConfig {
  procChance: number;
  type: 'backlash' | 'teleport' | 'confuse' | 'wild_magic';
  param: number;
  description: string;
}

export interface SerializedTagCombatBonus {
  tag: string;
  multiplier: number;
  flatBonus: number;
  renownCategory?: string;
  renownAmount?: number;
  message?: string;
}

export interface SerializedConsecratedGroundPenalty {
  damagePenalty: number;
  selfDamagePerAttack: number;
}

export interface SerializedItemModifier {
  id: string;
  name: string;
  alignment: 'positive' | 'negative' | 'chaotic';
  category: 'blessed' | 'enchanted' | 'holy' | 'cursed' | 'hexed' | 'unholy' | 'chaotic';
  prefix?: string;
  suffix?: string;
  cursed?: boolean;
  statDeltas?: ItemStatModifiers;
  meleeDamageMultiplier?: number;
  meleeDamageFlatBonus?: number;
  spellDamageMultiplier?: number;
  manaCostDiscount?: number;
  damageTakenMultiplier?: number;
  damageTakenFlatBonus?: number;
  tagBonuses?: SerializedTagCombatBonus[];
  consecratedGroundPenalty?: SerializedConsecratedGroundPenalty;
  chaoticProc?: SerializedChaoticProcConfig;
  description?: string;
}

export interface SerializedItemBase {
  id: string;
  name: string;
  unidentifiedName: string;
  category: ItemCategory;
  slot?: EquipmentSlot;
  weight: number;
  bulk: number;
  quality: ItemQuality;
  identified: boolean;
  stats: ItemStatModifiers;
  description: string;
  value?: number;
  minFloor?: number;
  tier?: number;
  enchantmentLevel?: number;
  elementalAffix?: ElementalAffix;
  wandData?: SerializedWandData;
  scrollSpellId?: string;
  potionType?: string;
  potionPotency?: number;
  runeOfReturnData?: { charges: number };
  coinData?: {
    denomination: CoinDenomination;
    count: number;
  };
  durability?: {
    current: number;
    max: number;
  };
  aspectState?: string;
  unitWeight?: number;
  modifiers?: SerializedItemModifier[];
  parentId?: string | null;
  ownerId?: string | null;
}

export interface SerializedMorphEnvelope {
  originalArchetypeId: string;
  originalName: string;
  originalStats: {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
  };
  originalSpeed: number;
  originalResistances?: Partial<Record<ElementType, ElementalAffinity>>;
  remainingTicks: number;
  spillDamage: boolean;
  temporaryHp: number;
  maxTemporaryHp: number;
}

export interface SerializedItem extends SerializedItemBase {
  isContainer?: false;
}

export interface SerializedContainer extends SerializedItemBase {
  isContainer: true;
  containerType: ContainerType;
  maxWeightCapacity: number;
  maxBulkCapacity: number;
  maxSlots?: number;
  acceptedCategories?: readonly string[];
  items: SerializedItemNode[];
  /** Absent in older saves, which load as never opened. */
  opened?: boolean;
}

export type SerializedItemNode = SerializedItem | SerializedContainer;

export interface SerializedInventory {
  paperdoll: Record<EquipmentSlot, SerializedItemNode | null>;
  primaryPack: SerializedContainer;
}

export interface SerializedPlayer {
  id: string;
  name: string;
  gender?: Gender;
  difficulty?: GameDifficulty;
  maxFloor?: number;
  attributes?: CharacterAttributes;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  baseAttack: number;
  baseDefense: number;
  strength: number;
  intelligence?: number;
  constitution?: number;
  dexterity?: number;
  speed: number;
  energy: number;
  mana?: number;
  maxMana?: number;
  spellsKnown?: string[];
  level?: number;
  xp?: number;
  statusEffects?: SerializedStatusEffect[];
  inventory: SerializedInventory;
  tutorialFlags?: TutorialFlags;
  deepestRecallFloor?: number;
  recallPosition?: Position;
  quickSpells?: (string | null)[];
  /** Potion-row pins; absent in saves from before the row could be pinned. */
  quickPotions?: (string | null)[];
  morphEnvelope?: SerializedMorphEnvelope;
  planeId?: string;
  corruptionScore?: number;
  unspentStatPoints?: number;
  /** Rune of Return mastery investment (docs/architecture/content-rune-of-return.md): points spent
   * from the same `unspentStatPoints` pool as core attributes, on the rune's three
   * independent progression tracks. */
  runeMastery?: { celerityPoints: number; weavePoints: number; mobilityPoints: number };
  /** Turns of channel progress banked from the last interrupt, applied to the next
   * attempt with the same charge (Steadfast Weave track). Resets to 0 on completion. */
  runeChannelBankedTurns?: number;
  hasDiscoveredRune?: boolean;
  runeCharges?: number;
  runeMaxCharges?: number;
  energyModel?: SerializedEnergyModel;
  voidDebt?: number;
  grimoire?: import('../magic/grimoireMatrix').GrimoireSlot[];
  grimoirePages?: import('../magic/grimoireMatrix').GrimoirePage[];
  activeGrimoireIndex?: number;
  grimoireOpenSlots?: number[];
  grimoireGrounds?: Record<number, string>;
}

/** `WorldState` as saved: remote-vault items are serialized item trees, not live Items. */
export type SerializedWorldState = Omit<WorldState, 'remoteVaults'> & {
  remoteVaults?: Record<string, SerializedItemNode[]>;
};

export interface SerializedEnergyModel {
  structuredEnergy: number;
  maxStructuredEnergy: number;
  volatileEnergy: number;
  maxVolatileEnergy: number;
  vitalityTenderBurned: number;
}

export interface SerializedMonster {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  resistances?: Partial<Record<ElementType, ElementalAffinity>>;
  definitionId?: string;
  aiType?: AiBehaviorType;
  aiState?: AiState;
  spells?: string[];
  spellCooldown?: number;
  fleeHealthPercent?: number;
  xpValue?: number;
  intent?: MonsterIntent;
  statusEffects?: SerializedStatusEffect[];
  inventory?: SerializedInventory;
  morphEnvelope?: SerializedMorphEnvelope;
  planeId?: string;
}

/** Companions & Pet Progression, Phase 1 (docs/architecture/content-companions.md). Top-level in SaveData, not per-floor. */
export interface SerializedCompanion {
  id: string;
  name: string;
  companionDefinitionId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  statusEffects?: SerializedStatusEffect[];
  primaryPack: SerializedContainer;
  /** Trainer-taught AI archetype; absent = 'balanced'. */
  archetype?: CompanionArchetype;
  /** Trainer-taught skills; absent = none. */
  unlockedSkills?: string[];
}

export interface SerializedNpc {
  id: string;
  name: string;
  x: number;
  y: number;
  role: string;
  shopId?: string;
  greeting: string;
  dialogText: string;
  isStationary?: boolean;
  choiceId?: string;
}

export interface SerializedGroundTile {
  x: number;
  y: number;
  items: SerializedItemNode[];
}

import type { TrapType } from '../types/manifest';

export interface SerializedTrap {
  id: string;
  type: TrapType;
  x: number;
  y: number;
  revealed: boolean;
  triggered?: boolean;
  disarmed?: boolean;
  damage?: number;
  concealment?: number;
  disarmDifficulty?: number;
  customMessage?: string;
}

export interface SerializedMap {
  width: number;
  height: number;
  tiles?: TileType[][];
  tilesRle?: string;
  tileCodes?: string[];
  groundItems: SerializedGroundTile[];
  monsters: SerializedMonster[];
  npcs?: SerializedNpc[];
  traps?: SerializedTrap[];
  surfaces?: SerializedSurfaceCell[];
  substances?: SerializedSubstanceCell[];
  lastVisitedTick?: number;
  floorTurnCount?: number;
  isCleared?: boolean;
}

export interface SaveData {
  profile: CharacterProfile;
  savedAt: number;
  player: SerializedPlayer;
  map: SerializedMap;
  fovExplored?: [number, number][];
  fovRle?: string;
  contentManifestId?: string;
  turnCount: number;
  messages: string[];
  currentFloor?: number;
  difficulty?: GameDifficulty;
  maxFloor?: number;
  storedMaps?: Record<number, SerializedMap>;
  /** Floors held in the async tier rather than inline (schema v10, ARCHITECTURE.md §5). */
  archivedFloors?: number[];
  storedFovRle?: Record<number, string>;
  compendium?: Record<string, { kills: number; tier: 0 | 1 | 2 | 3; firstEncounterFloor?: number; chosenPerk?: import('../compendium/types').MasteryPerkId }>;
  /** Chosen category-mastery perks by monster category ID. Optional; absent = none chosen. */
  compendiumCategoryPerks?: Record<string, import('../compendium/types').MasteryPerkId>;
  worldState?: SerializedWorldState;
  planes?: Record<string, PlaneState>;
  prngState?: number;
  /** Companions & Pet Progression, Phase 1 (docs/architecture/content-companions.md). Null/absent = no companion summoned. */
  companion?: SerializedCompanion | null;
  /** The companion last dismissed, kept to be summoned back (`GameEngine.dismissedCompanion`). */
  dismissedCompanion?: SerializedCompanion;
  /** A fallen companion awaiting a trainer's revival (`GameEngine.deadCompanionRecord`). */
  deadCompanion?: SerializedCompanion;
  /** Chronicle of Discoveries rolling event log (ARCHITECTURE.md §5). */
  discoveryEvents?: Array<{
    type: 'floor_transition' | 'secret_door' | 'trap_disarmed' | 'boss_slain' | 'close_call' | 'pact_sealed' | 'quest_milestone' | 'general';
    text: string;
    floor: number;
    turn: number;
    timestamp: number;
    icon?: string;
  }>;
  /**
   * Each town merchant's stock as it stood (merchant id -> items), so what the hero bought
   * stays gone and what they sold stays on the shelf. Absent (older saves) = the manifest's
   * initial stock.
   */
  merchantStock?: Record<string, SerializedItemNode[]>;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
