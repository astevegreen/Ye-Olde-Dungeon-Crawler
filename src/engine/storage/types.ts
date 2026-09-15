import type { TileType, GameDifficulty } from '../types';
import type { EquipmentSlot, ItemCategory, ItemQuality, ItemStatModifiers, ElementalAffix } from '../items/item';
import type { ContainerType } from '../items/container';
import type { SerializedStatusEffect } from '../status/types';
import type { CoinDenomination } from '../economy/types';
import type { CharacterAttributes, Gender } from '../character/types';
import type { ElementType, ElementalAffinity } from '../magic/elements';
import type { AiBehaviorType } from '../bestiary/monsterDefinitions';
import type { AiState, MonsterIntent } from '../entities/monster';
import type { SerializedTownReturnData } from '../townReturn/types';
import type { Position } from '../types';
import type { WorldState } from '../state/worldState';
import type { PlaneState } from '../spatial/planeTypes';
import type { SerializedSurfaceCell } from '../surfaces/surfaceGrid';
import type { SerializedSubstanceCell } from '../environment/substanceGrid';

export interface TutorialFlags {
  conduitSeen?: boolean;
  sprintSeen?: boolean;
  winchSeen?: boolean;
  townPortalSeen?: boolean;
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
  compendium?: Record<string, { kills: number; tier: 0 | 1 | 2 | 3; firstEncounterFloor?: number }>;
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
  corpseData?: {
    archetypeId: string;
    decayTicksRemaining: number;
    isBurned: boolean;
  };
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
  morphEnvelope?: SerializedMorphEnvelope;
  planeId?: string;
  corruptionScore?: number;
  unspentStatPoints?: number;
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

/** Companions & Pet Progression, Phase 1 (ARCHITECTURE.md P-14). Top-level in SaveData, not per-floor. */
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
  storedFovRle?: Record<number, string>;
  compendium?: Record<string, { kills: number; tier: 0 | 1 | 2 | 3; firstEncounterFloor?: number }>;
  townReturn?: SerializedTownReturnData;
  worldState?: WorldState;
  planes?: Record<string, PlaneState>;
  prngState?: number;
  /** Companions & Pet Progression, Phase 1 (ARCHITECTURE.md P-14). Null/absent = no companion summoned. */
  companion?: SerializedCompanion | null;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
