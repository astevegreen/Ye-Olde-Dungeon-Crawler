import type { Position, TileDefinition } from '../types';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { SpellDefinition } from '../magic/types';
import type { ItemCategory, ItemQuality, EquipmentSlot, ItemStatModifiers, Item, RangedWeaponConfig } from '../items/item';
import type { ModifierAlignment, ModifierCategory } from '../items/modifiers';
import type { ItemFamilyConfig } from '../items/modifierRoller';
import type { ContainerType } from '../items/container';
import type { PotionType } from '../items/consumables';
import type { CoinDenomination } from '../economy/types';
import type { NpcRole } from '../entities/npc';
import type { AffinityMatrixConfig, ElementType } from '../magic/elements';
import type { EquipmentSlotDefinition } from '../inventory/paperdoll';
import type { ThemeTokens } from './theme';
import type { VaultBlueprint } from '../dungeon/vaultStamp';
import type { StatusHandler } from '../status/statusHandlers';
import type { ActionHook } from '../actions/actionPipeline';
import type { AiBehaviorStrategy } from '../ai/aiBehaviorRegistry';
import type { CombatConfig, ProgressionConfig, LevelUpBonus, AttributeScalingConfig } from './config';
import type { PerkDefinition, PerkEffects, LevelMilestoneTrigger } from './perks';
import type { WorldState } from '../state/worldState';
import type { Predicate } from '../predicates/types';
import type { ChoiceDefinition, ChoiceOption, ChoiceConsequence } from './choice';
import type { HookDescriptor } from '../hooks/hookDispatcher';
import type { RunPactDefinition } from '../pacts/pactManager';
import type { CompanionDefinition } from '../entities/companion';
import type { MonsterScalingConfig } from './monsterScaling';
import type { GasType } from '../surfaces/surfaceGrid';
import type { Gender } from '../character/types';

export interface MerchantConfig {
  id: string;
  name: string;
  greeting: string;
  markupRatio?: number;
  markdownRatio?: number;
  /**
   * The shop's authored stock. A factory, called once per town built and once per load,
   * so each merchant holds its own items: a bought purse, a wand's spent charges or a
   * sold item's flags never reach another hero's shop.
   */
  initialInventory: () => Item[];
  predicate?: Predicate;
}

export type ConsumableEffectDescriptor =
  | { type: 'restore_hp'; amount: number | string }
  | { type: 'restore_mana'; amount: number | string }
  | { type: 'cure_status'; status: string }
  | { type: 'apply_status'; status: string; duration: number; potency?: number }
  | { type: 'gain_xp'; amount: number }
  /** Raises the drinker `levels` (default 1) whole levels, paying each level's remaining XP. */
  | { type: 'gain_level'; levels?: number }
  | { type: 'gain_stat'; stat: 'strength' | 'intelligence' | 'constitution' | 'dexterity'; amount: number }
  | { type: 'teleport'; range?: number; random?: boolean }
  | { type: 'restore_volatile_energy'; amount?: number | 'full' }
  | {
      /**
       * Tag-Filtered Radial Aura (docs/architecture/content-extensibility.md): applies `status` to every
       * living entity within `radius` of the user matching any of `tags` (e.g. a
       * holy torch blinding undead within 4 tiles), through the bounded
       * `findTaggedEntitiesInRadius` query (`combat/radialAuraFilter.ts`). Only the user is spared: like a spell
       * burst, it afflicts allies too (a hero's companion is a `monster` by type).
       */
      type: 'radial_status';
      radius: number;
      tags: string[];
      status: string;
      duration: number;
      potency?: number;
    }
  /**
   * Fills the user's tile and every open tile within `radius` of it with `gas` for `duration`
   * turns: a smoke plume, say. An opaque gas hides whoever stands in it (Q13 "A",
   * `ai/perception.ts`).
   */
  | { type: 'release_gas'; gas: GasType; radius: number; duration: number };

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
  /** Always this family (`manifest.itemFamilies`), its tier by floor: a cursed relic, say. */
  family?: ModifierCategory;
  /**
   * How likely floor and chest loot is to draw this definition against the others in its group
   * (`selectFloorItemDefinition`). Default 1; a rarer item, a relic say, is below 1; 0 never
   * drops at random (it is sold, granted or dropped by name).
   */
  lootWeight?: number;
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
  /**
   * What wearing it does beside its stats, in a perk's terms (`PerkEffects`): an element it
   * resists (`resistsElements`), statuses that never take hold (`grantsStatusImmunities`),
   * traps that never spring (`trapImmune`). Read from the worn item through `wornModifiers`.
   * Definition-only, like `hooks`: never saved, and given back on load.
   */
  wornEffects?: PerkEffects;
}

export type TrapType = string;

export interface TrapDefinition {
  type: TrapType;
  name: string;
  damage?: number;
  message?: string;
  disarmDifficulty?: number;
  /** How well it hides: Search rolls against it, passive perception needs 2 more (default 14). */
  concealment?: number;
  /** The shallowest floor `trapPlacement` hides it on (default 1). */
  minFloor?: number;
  /** The deepest floor `trapPlacement` hides it on (default: no limit). */
  maxFloor?: number;
  /** Its share of a floor's draws among the traps that floor allows (default 1). */
  weight?: number;
}

/**
 * How many traps a generated floor hides (`placeFloorTraps`). Bands, as `floorEncounters`:
 * the entry with the greatest `minFloor` not deeper than the floor gives the count, drawn
 * evenly from `min` to `max`. A floor shallower than every entry gets none.
 */
export interface TrapPlacementConfig {
  perFloor: Array<{ minFloor: number; min: number; max: number }>;
}

export interface StatusEffectDefinition {
  id: string;
  name: string;
  hudColor?: string;
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
  /** What the Story shows while the milestone is still locked: a hint that doesn't name
   *  it. Without one, a locked milestone shows as "? ? ?". */
  riddle?: string;
  /** The riddle itself stays untold until this flag is set: for a milestone whose very
   *  existence is a beat the game reveals later (cotw: the two Níðhögg endings, after Víðnir). */
  riddleAfterFlag?: string;
}

/**
 * Something the hero can learn and keep, e.g. a runestone's verse: shown in the Story's
 * Carved Verses once `flag` is set. A display list over flags, like `trackedMilestones`.
 */
export interface LoreEntryDefinition {
  flag: string;
  title: string;
  /** The words as found; line breaks are kept. */
  verse: string;
  /** What it teaches, in plain terms. */
  lore: string;
  /** A fusion (a `magic.hybrids` spell) this lore tells how to forge: once read, the
   *  Spellbook lists it among the fusions the hero knows. */
  fusionSpellId?: string;
}

/**
 * How the Story names a faction in `WorldState.factions` and when the hero has met it.
 * A faction shows once its standing moves from its starting value, once `metFlag` is
 * set, or from the start with `metAtStart`; until then it stays hidden.
 */
export interface FactionDefinition {
  id: string;
  /** Display name; defaults to the id in title case. */
  name?: string;
  metFlag?: string;
  metAtStart?: boolean;
}

/**
 * A cumulative renown-granting milestone (Milestone Renown Ledger, docs/architecture/content-extensibility.md).
 * Distinct from TrackedMilestoneDefinition: that is a flag-based display list for the
 * World Ledger sidebar, while this drives a scalar per-category renown score used for
 * title thresholds (`RenownTitleDefinition`) and vendor-unlock predicates (`minCounter`
 * against the `renown:<category>` world-state counter this produces).
 */
export interface RenownMilestoneDefinition {
  /** Stable ID. Engine call sites (e.g. breakCurses, SearchAction) record milestones
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

export interface TownBuildingDefinition {
  name: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  door: { x: number; y: number; isOpen?: boolean };
  buildingType?: 'temple' | 'bank' | 'shop' | 'smithy' | 'house' | 'generic';
  /** Holy ground within its bounds (the temple): burns the bearer of a `sacredGroundBurn` modifier. */
  sacred?: boolean;
}


export interface TownServicesDefinition {
  templeName?: string;
  priestTitle?: string;
  /** `{items}` names what was cleansed; the engine appends where the items went (pack or still worn). */
  cleanseMessageTemplate?: string;
  noCursesMessage?: string;
  donationRequiredTemplate?: string;
  healMessageTemplate?: string;
  sageName?: string;
  sageTitle?: string;
  bankName?: string;
  bankerTitle?: string;
  /** The banker's exchange. Placeholders: {coins} (the value), {oldCount}, {newCount} (coins before and after). */
  compactionMessageTemplate?: string;
  /** Faction whose standing gates temple services. Default `'temple_standing'`. */
  templeStandingFaction?: string;
  /** Shown when the temple refuses service (negative standing or corruption refusal). */
  templeRefusalMessage?: string;
  /** Shown when the hero wears a `templeShunned` item and asks for anything but the cleanse. */
  templeShunnedMessage?: string;
  /** Player `corruptionScore` at or above which the temple refuses service. Absent = never. */
  corruptionRefusalThreshold?: number;
  /** Player `corruptionScore` at or above which temple prices are multiplied. Absent = never. */
  corruptionSurchargeThreshold?: number;
  /** Price multiplier past `corruptionSurchargeThreshold`. Default 2. */
  corruptionSurchargeMultiplier?: number;
  /** What the temple takes from the pack as offerings (`TempleService.makeOffering`); absent, none. */
  templeOfferings?: TempleOfferingsDefinition;
  /** Blessings the priests grant once each, free, at a piety threshold (`TempleService.receiveBlessing`). */
  templeBlessings?: TempleBlessingDefinition[];
  /** The renown category the hero's piety is counted in. Default `'piety'`. */
  pietyCategory?: string;
  /** Smiths who raise an item's +N (`SmithService`): each adds a Forge list to its merchant's shop. */
  smiths?: SmithDefinition[];
  /** The sage's monster lore for sale (`LoreService`); absent, the sage sells none. */
  monsterLore?: MonsterLoreDefinition;
  /** The companion skills the trainer teaches (`trainer_teach_skill`), one offer each in his
   *  dialog; absent, he teaches none. */
  trainerSkills?: TrainerSkillDefinition[];
}

/** A companion skill a town trainer teaches: what the companion learns, and how it is offered. */
export interface TrainerSkillDefinition {
  /** The skill id the companion learns (`Companion.unlockedSkills`, `use_companion_skill`). */
  id: string;
  /** Its name in the offer ("Teach <name>") and the trainer's messages. */
  name: string;
  /** What it does, under the offer. */
  description: string;
  /** What it does when the hero commands it (`use_companion_skill`). */
  effect: CompanionSkillEffect;
}

/** What a companion skill does when used: the engine applies these and nothing else. */
export interface CompanionSkillEffect {
  /** The companion heals this share of its max HP (0.2 = a fifth). */
  companionHealPercent?: number;
  /** The hero gains this status. */
  heroStatus?: { type: string; duration: number };
  /** The line logged: `{companion}` is the companion's name, `{healed}` the HP it regained. */
  message: string;
}

/**
 * The sage's monster lore (tracker 4.1): Study raises a known creature one bestiary rank,
 * a Rumor reveals an unmet one the hero picks. Each price is `baseCp + perFloorCp × ` the
 * creature's home floor (`minFloor`).
 */
export interface MonsterLoreDefinition {
  study: { baseCp: number; perFloorCp: number };
  rumor: { baseCp: number; perFloorCp: number };
}

/**
 * A smith (tracker 2.7): raises a carried or worn item's +N one step at a time, for
 * `stepPricesCp[level]` (the price of reaching level + 1), up to `stepPricesCp.length`. Only
 * identified, unbound items of `categories`. A step is worth what a dungeon +N is: +2 attack on a
 * weapon, +1 defense on anything else.
 */
export interface SmithDefinition {
  /** The merchant whose shop gains the Forge list. */
  npcId: string;
  categories: ItemCategory[];
  stepPricesCp: number[];
  /** Logged on a step; `{item}` names the item, as it now is. */
  messageTemplate?: string;
  /**
   * A one-time piece of work, free: one item straight to `toLevel`. Offered while `predicate`
   * holds and `flag` is unset; the flag records it.
   */
  masterwork?: {
    name: string;
    description: string;
    toLevel: number;
    predicate?: Predicate;
    flag: string;
    /** Logged when done; `{item}` names the item. */
    message: string;
  };
}

/**
 * Temple offerings: an identified item from the pack carrying a family of one of these
 * alignments is taken, for no coin. Each records `milestoneId` (repeatable, so its renown is the
 * piety an offering earns) and adds `standingDelta` to the temple's standing. Accepted at any
 * standing; refused, like every service but the cleanse, while the hero wears a `templeShunned` item.
 */
export interface TempleOfferingsDefinition {
  alignments: ModifierAlignment[];
  milestoneId: string;
  standingDelta?: number;
  /** Logged on an offering; `{item}` names it. */
  messageTemplate?: string;
}

/** What a temple blessing does; each is granted once, and remembered as a world flag. */
export type TempleBlessingEffect =
  /** Temple healing costs nothing from then on. */
  | { type: 'freeHealing' }
  /** One carried item of these categories, identified and with no family, gains `family` at the
   *  tier the hero's deepest floor (`deepestFloorCounter`) has reached. */
  | { type: 'hallowItem'; family: ModifierCategory; categories: ItemCategory[] }
  /** Max HP rises by this share for good (`Player.maxHpPercentBonus`); 0.1 is +10%. */
  | { type: 'maxHpPercent'; percent: number };

export interface TempleBlessingDefinition {
  id: string;
  name: string;
  description: string;
  /** The piety (renown in `pietyCategory`) at which it becomes available. */
  minPiety: number;
  effect: TempleBlessingEffect;
  /** Logged when granted; `{item}` names a hallowed item. */
  message?: string;
}

export interface TownNpcDefinition {
  id: string;
  name: string;
  role: NpcRole;
  position: Position;
  greeting: string;
  dialogText?: string;
  /** What a townsperson without a shop or service tells the hero beyond their greeting
   *  (the town dialog's "Local advice"). Absent, they only greet. */
  advice?: string;
  shopId?: string;
  merchantConfig?: MerchantConfig;
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
  /**
   * The town's tiles, one string per row: '#' rock or wall, '.' ground, '+'/"'" doors, '>'
   * stairs down; `legend` maps other characters to tile types (the pack's own tiles). When
   * set, it replaces the open courtyard, and `buildings` only name the interiors (their
   * walls are in the rows).
   */
  layout?: string[];
  legend?: Record<string, string>;
  /**
   * The town lies in daylight (`GameMap.lit`): sight there reaches as far as line of sight
   * goes rather than the hero's own radius, and the renderer draws no torchlight. Absent,
   * the town is lit like a dungeon floor.
   */
  lit?: boolean;
}

/**
 * A depth band of wandering monsters (`QuestArcDefinition.floorEncounters`), keyed by the
 * floor the band starts on: it holds for that floor and every deeper one up to the next
 * key (owner Q8, "bands"). A listed monster still waits for its own `minFloor`.
 */
export interface FloorEncounterConfig {
  /** Who wanders in on these floors; empty (or none deep enough yet) = the depth-weighted catalog. */
  monsterIds: string[];
  /** The most living hostile monsters a floor of the band holds before no wanderer comes. */
  maxMonsters: number;
}

export interface BossFloorLayoutDefinition {
  width: number;
  height: number;
  playerSpawn: Position;
  stairsUp: Position;
  bossSpawn: Position;
  pillars?: Position[];
  /** The boss's guards: the pack's monsters, scaled for the floor, each on its own free
   *  walkable tile. Absent or empty = the engine's four placeholder bodyguards. */
  guards?: Array<{ definitionId: string; position: Position }>;
  /**
   * The lair's tiles, one string per row (`width` x `height`): '#' rock, '.' floor, '~'
   * shallow water, 'X' chasm, 'P' pillar, 'B' iron bars, '+'/"'" doors; `legend` maps other
   * characters to tile types. Absent = the engine's built-in hall. The boss and its hoard
   * are placed at `bossSpawn` either way.
   */
  layout?: string[];
  legend?: Record<string, string>;
}

export interface QuestArcDefinition {
  id: string;
  name: string;
  maxFloor: number;
  allowsDifficultyScaling?: boolean;
  bossMonsterId: string;
  /** World-state flag set when `bossMonsterId` dies, so an objective or a
   *  `trackedMilestones` entry can follow the kill (they read flags only). */
  bossSlainFlag?: string;
  relicItemId: string;
  /**
   * The single legacy ending, for a quest that declares no `endings`: the hero wins by
   * speaking to this NPC on `victoryFloor` with the relic. A quest with `endings` ends
   * through them instead, and these four go unread.
   */
  victoryNpcId?: string;
  victoryFloor?: number;
  victoryDialogue?: string;
  victoryScoreBonus?: number;
  /** Logged when the boss dies, if set (e.g. a relic it drops). */
  relicDropMessage?: string;
  victoryEpitaph?: string;
  championProclamation?: string;
  bossLairTitle?: string;
  bossEntryMessage?: string;
  victoryPortalTileId?: string;
  /** Logged when the victory portal opens where the boss fell. */
  victoryPortalMessage?: string;
  townReturnPosition?: Position;
  bossFloorLayout: BossFloorLayoutDefinition;
  /** Wandering-monster bands by the floor each starts on (`FloorEncounterConfig`). */
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
  /** Title of the ending's narrative screen, shown before the final score screen. */
  title?: string;
  /** The ending told as paragraphs on its narrative screen. No narrative, no screen. */
  narrative?: string[];
  /** The final score screen's banner for this ending (defaults to the pack's victory banner). */
  banner?: string;
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
  /** A tile (e.g. a portal) opened where the boss stood when it was driven off. */
  portalTileId?: string;
  /** Logged when that tile opens. */
  portalMessage?: string;
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
  /** Logged once, the moment `progressStartFlag` is set — tells the player a countdown
   *  just started, since a silent timer can expire before they know it exists. */
  progressStartMessage?: string;
  /** Must also hold before the choice is offered, for a story beat that waits on more
   *  than a kill (e.g. a relic carried). Evaluated against world state each move. */
  when?: Predicate;
}

/** Attribute-threshold-gated choice unlocks (ARCHITECTURE.md §3). Sibling of `StoryChoiceTrigger`:
 *  same one-time `<id>_offered` world-flag idiom, keyed on an attribute value instead of kill count. */
export interface AttributeMilestoneTrigger {
  /** Stable id, used for its own `<id>_offered` internal flag. */
  id: string;
  attribute: 'strength' | 'dexterity' | 'constitution' | 'intelligence';
  /** Fires once the attribute is at or above this value. */
  threshold: number;
  /** Key into `manifest.choices`. */
  choiceId: string;
}

/**
 * A thematic family of monsters for Slayer's Compendium category mastery
 * (`src/engine/compendium/`). Kills of every member count toward the category; at
 * `masteryKills` the player chooses a mastery perk that applies to the whole family.
 * A monster belongs to at most one category.
 */
export interface MonsterCategoryDefinition {
  id: string;
  /** Player-facing name, e.g. "The Restless Dead". */
  name: string;
  icon?: string;
  description?: string;
  /** Monster definition IDs in this category. */
  members: string[];
  /** Combined kills across all members needed to unlock category mastery. */
  masteryKills: number;
}

/**
 * A turn-limited world event (ARCHITECTURE.md §3) — a gap surfaced by a climactic
 * story choice that needed to feel time-pressured rather than a calm, simulation-
 * paused dialogue menu. Ticked once per player turn by `GameEngine` (a `'timed-
 * events-tick'` environmental update, alongside surfaces and spawns) rather
 * than gated behind a modal, so the countdown keeps running while the player acts.
 */
/**
 * One line of the pack's running objective (`manifest.objectives`, read by
 * `getCurrentObjective`): the HUD shows the first entry that is available and not
 * yet done, so a pack lists them in story order.
 */
export interface ObjectiveDefinition {
  id: string;
  /** What the HUD shows, e.g. "Find what steals the village's warmth." */
  text: string;
  /** Shown only once this world flag is set. */
  availableWhenFlag?: string;
  /** Done once any of these world flags is set. */
  doneWhenAnyFlag?: string[];
  /** Done once this world counter reaches the value (e.g. a deepest-floor counter). */
  doneWhenCounterAtLeast?: { counter: string; value: number };
  /** The HUD's bearing beside the line points at the nearest of these entities still on the
   *  floor, under `label` ("held villager 9 NW"), in place of the nearest stairs down. */
  pointTo?: { entityIds: string[]; label: string };
}

export interface TimedEventDefinition {
  id: string;
  /** World-state flag whose becoming true starts this event's countdown (checked
   *  once per tick; the turn it first reads true is turn zero of the countdown). */
  startFlag: string;
  /** Turns after `startFlag` first reads true before `expireConsequences` fire. */
  turnLimit: number;
  /** Player-facing name. When set, the HUD shows the running countdown
   *  (`getTimedEventCountdowns`); unlabelled events stay hidden. */
  label?: string;
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
  /** Neighbour-aware terrain, lighting and memory styling. Absent = one recipe per tile type, as before. */
  terrain?: TerrainArtConfig;
  /** Tag -> sprite rules for the pack's own creatures, checked in order before the
   * renderer's generic archetype rules. `spriteKey` names a pack recipe. */
  spriteTagRules?: SpriteTagRule[];
  /**
   * Art for what covers a cell, keyed `surface~<type>` for a ground surface (the engine's
   * `water`, `oil_slick`, `acid_pool`, `ice_sheet`, `mud`, `fire`) and `gas~<type>` for a gas
   * (`fire_storm`, `poison_cloud`, `dense_steam`).
   * A type without an entry gets the renderer's neutral wash in the theme's role colors.
   */
  overlays?: Record<string, CellOverlayArt>;
}

/**
 * Draws what covers one cell (rendering tier; the engine only carries the data). Unlike a
 * `SpriteRecipe`, baked once into the atlas, it runs every frame, in canvas units at the
 * cell's place on screen (`px`, `py`, `size` square), over the terrain: `now` is the frame's
 * clock in ms, so it can flicker or drift, and `x`, `y` the cell, to vary it from its
 * neighbours. Content code never reads the clock itself (§7.2).
 */
export type CellOverlayArt<TContext = any> = (
  ctx: TContext,
  px: number,
  py: number,
  size: number,
  cell: { x: number; y: number; now: number }
) => void;

/** Maps a monster tag to a sprite key (ARCHITECTURE.md §3: sprite choice comes from the pack). */
export interface SpriteTagRule {
  tag: string;
  spriteKey: string;
}

/**
 * How a pack draws terrain beyond one recipe per tile type (rendering tier; the engine only
 * carries the data). Recipes are keyed `<base>[_<zone>]~<part>`: `<base>` is the tile's sprite
 * name (`floor`, `wall`, `water`, `chasm`, `pillar`, `bars`, `stairs_down`, `stairs_up`,
 * `trap`, `door_closed`, `door_open`, or a pack tile's type), `<zone>` the active
 * `tileZoneBands` key (on floor 0, `town` or `town_<buildingType>`), and `<part>`:
 *
 *   field  `t<n>` tone picked by smooth world-space noise; `d<n>` detail picked by a stable
 *          hash at `detailRate`; with `macro`, prefixed `q<0-3>` for the 2x2 quadrant.
 *   wall   `top` (south neighbour solid) or `face<n>` (south open), plus overlays on open
 *          sides: `rimN`, `rimE`, `rimW` (top) / `edgeE`, `edgeW` (face), and `cornerNE`,
 *          `cornerNW`, `cornerSE`, `cornerSW` where only the diagonal is open.
 *   area   `q<0-3>` (a 2x2 macro that tiles seamlessly), plus `edgeN|E|S|W` toward
 *          neighbours of another type, so a pool or a pit reads as one body.
 *   prop   `prop`, drawn over the floor underlay (pillars, bars, stairs, traps, pack tiles).
 *   door   `face` (between walls east and west, drawn in the wall line) or `side` (over floor).
 *
 * A key that has no recipe makes that cell fall back to the one-recipe-per-type path.
 */
export interface TerrainArtConfig {
  /** Keyed by base sprite name. Bases without a style draw as props or doors. */
  styles: Record<string, TerrainStyle>;
  /** Soft shadow on floor below and beside walls. */
  contactShadows?: boolean;
  /** A ground shadow under the player and monsters. */
  entityShadows?: boolean;
  /** Torchlight: visible cells darken toward the edge of sight, with a warm pool near the player. */
  torch?: { radius: number; color: string; warmth: number; falloff: number };
  /** Light-emitting tiles: zone key, then tile type. */
  emissive?: Record<string, Record<string, { color: string; radius: number; strength: number }>>;
  /** Remembered cells: desaturate, flatten toward each cell's mean and darken (0-1 each). */
  memory?: { desaturate: number; flatten: number; darken: number; tint?: string; tintAmount?: number };
}

export interface TerrainStyle {
  kind: 'field' | 'wall' | 'area';
  /** field: tone variants picked by smooth world-space noise (clustered shading). */
  tones?: number;
  /** field: detail variants swapped in by a stable per-cell hash. */
  details?: number;
  detailRate?: number;
  /** field/area: variants also indexed by the 2x2 quadrant, for tile-spanning patterns. */
  macro?: boolean;
  /** wall: face variants picked by a stable per-cell hash. */
  faces?: number;
}


export interface StarterKitDefinition {
  weaponItemId: string;
  armorItemId?: string;
  bootsItemId?: string;
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

/**
 * A sprite that draws its own final pixels (rendering tier): the pack lights, shades and
 * outlines it and gives it its own ground shadow, so the atlas's shading, outline and rim
 * passes and the renderer's entity shadow skip it. It may idle: the map cycles its frames on
 * a slow ambient tick that never holds input (§4), and holds frame 0 when the player reduces
 * motion and in remembered views. Frames are baked on first use.
 */
export interface PixelSprite {
  /** Idle frames, 1-4. Default 1. */
  frames?: number;
  /**
   * One frame's straight-alpha RGBA pixels, `size` by `size` (the atlas's stored cell edge).
   * Deterministic: the same frame and size give the same pixels; no DOM, clock or randomness.
   */
  render(frame: number, size: number): Uint8ClampedArray;
}

/**
 * Alignment auras (rendering tier): drawn around and over an identified item's sprite, on
 * the map and on its icons, by the family the item's name is colored by ('cursed', 'hexed',
 * 'unholy', 'chaotic', 'enchanted', 'blessed', 'holy', 'artifact'). An unidentified item
 * shows plain. The aura loops on the same ambient tick as idle sprites, and holds frame 0
 * when the player reduces motion.
 */
export interface ItemAuraArt {
  /** Frames in one loop, 1-16; a multiple of four keeps an idling item in step with it. */
  frames: number;
  /** The families that have an aura; an item of any other shows plain. */
  tones: readonly string[];
  /**
   * The item's straight-alpha pixels (`size` by `size`, in the idle frame that matches) with
   * the aura drawn behind and over them, the same size. Deterministic, as `PixelSprite.render`.
   */
  render(item: Uint8ClampedArray, size: number, tone: string, frame: number): Uint8ClampedArray;
}

/** What the hero has on, for `HeroSpriteArt.lookKey`. */
export interface HeroGear {
  gender: Gender;
  equipped(slot: EquipmentSlot): Item | null;
}

/**
 * The hero's map sprite built from the gear they wear (rendering tier): the pack reads the
 * equipped items and names a look, and the renderer bakes each look once it is worn.
 */
export interface HeroSpriteArt {
  /** A stable key for the look this gear makes; the same key reuses the baked sprite. */
  lookKey(gear: HeroGear): string;
  /** The sprite for a key `lookKey` returned. */
  sprite(lookKey: string): PixelSprite;
}

/**
 * Pack-specific wording for shared presentation screens (§3: presentation code names no
 * pack). The pack's title and tagline are `GameContentManifest.name`/`description`, and
 * its town is `town.name`; everything here is optional and falls back to neutral text.
 */
export interface PackBranding {
  /** The high-score hall, e.g. "Hall of Heroes". */
  hallOfFameName?: string;
  /** Short form for buttons and score badges, e.g. "Heroes". */
  hallOfFameShortName?: string;
  /** The world in flavor text, e.g. "the Realm". */
  worldName?: string;
  /** Game-over heading after a win, e.g. "Victory in the Realm!". */
  victoryTitle?: string;
  /** Game-over banner line after a win. */
  victoryBanner?: string;
  /** Game-over banner line after a death. */
  fallenBanner?: string;
  /** The pack's name for experience points, e.g. "Megin". Defaults to "XP". */
  xpName?: string;
  /** Glyph engraved on the HUD health orb, e.g. a rune. Defaults to a neutral heart. */
  healthGlyph?: string;
  /** Glyph engraved on the HUD mana orb. Defaults to a neutral star. */
  manaGlyph?: string;
  /** The pack's name for the spell resource, shown under the mana orb. Defaults to "Mana". */
  manaName?: string;
  /**
   * The unit amounts of it are written in ("3 MP"). Defaults to "MP", or to
   * `manaName` when the pack names the resource but not its unit.
   */
  manaUnit?: string;
  /**
   * A decorative rule drawn at the end of menu section headings, e.g. a row of runes.
   * Ornament only: it never carries meaning. Defaults to none.
   */
  ornament?: string;
  /** The Story's name for `loreEntries`, e.g. "Carved Verses". Defaults to "Lore". */
  loreTitle?: string;
  /** The label over a lore entry's verse (the story), e.g. "Saga". Defaults to "Verse". */
  loreVerseLabel?: string;
  /** The label over a lore entry's practical lore, e.g. "Rune-lore". Defaults to "Lore". */
  loreNoteLabel?: string;
}

export interface ManaTerms {
  /** "Mana", or the pack's own word. */
  name: string;
  /** "MP", or the pack's own unit. */
  unit: string;
}

/** The spell resource's name and unit for player-facing text (PackBranding.manaName/manaUnit). */
export function resolveManaTerms(manifest?: { branding?: PackBranding }): ManaTerms {
  const b = manifest?.branding;
  const name = b?.manaName ?? 'Mana';
  return { name, unit: b?.manaUnit ?? (b?.manaName ? b.manaName : 'MP') };
}

/**
 * The systems a first-time hint introduces. Presentation decides when each is first met
 * (an altar reached, a creature with a kill rite seen, the pact keeper greeted, a companion
 * at the hero's side, the first renown, a Rune of Return carried, a faction standing moved,
 * the first saga deed) and shows the pack's hint once per hero (`Player.tutorialFlags`).
 */
export type FirstTimeHintId =
  | 'altar'
  | 'killRite'
  | 'pactKeeper'
  | 'companion'
  | 'renown'
  | 'runeOfReturn'
  | 'factionStanding'
  | 'story'
  | 'grimoire';

export interface FirstTimeHintDefinition {
  title: string;
  /** One or two sentences. `{key:<action>}` names the key bound to that command, e.g. `{key:story}`. */
  text: string;
}

/**
 * A pack's coin scale (`GameContentManifest.coinage`): what one coin pile is worth on a floor
 * and which metal it comes in. `mintCoinPile` mints from it; a pack's monsters can mint their
 * purses from it too, so ground and monster coin follow one curve.
 */
export interface CoinageDefinition {
  /** Mean value, in copper, of one ordinary pile on this floor. A pile is worth from half to
   * one and a half times this, times its richness. */
  pileValueCp: (floor: number) => number;
  /** Relative chance of each metal for a pile on this floor. */
  metalWeights: (floor: number) => Readonly<Record<CoinDenomination, number>>;
  /** A pile of more coins than this steps up to the next metal. Default 60. */
  maxPileCoins?: number;
}

/**
 * How much loot a floor holds (`GameContentManifest.loot`): the per-room rolls of
 * `populateDungeonLoot`, how many entries a chest holds (`createDungeonChest`: room, vault
 * and monster chests and the boss hoard), and the newest-item rule (`selectFloorItemDefinition`).
 * A field left out keeps the built-in rate. Monster drops are the pack's own loot tables.
 */
export interface LootRatesDefinition {
  /** Per room past the arrival room: the chance of one loose drop. Default 0.6. */
  roomDropChance?: number;
  /** The share of loose drops that are coin piles rather than items. Default 0.4. */
  roomCoinShare?: number;
  /** Per room past the arrival room: the chance of a chest. Default 0.25. */
  roomChestChance?: number;
  /** How many entries a chest holds, both ends included. Default [2, 4]. */
  chestEntries?: readonly [number, number];
  /** The share of chest entries that are coin piles. Default 0.35. */
  chestCoinShare?: number;
  /** How many entries the chest in a secret cache holds, both ends included. Default [2, 3]. */
  cacheEntries?: readonly [number, number];
  /** The share of item draws taken from the newest definitions the floor has unlocked. Default 0.75. */
  newestShare?: number;
  /**
   * How many of the newest definitions (by `minFloor`) that share is spread over; definitions
   * sharing a `minFloor` stay together, so the group can be larger. Default 1: only the
   * definitions with the highest `minFloor`, which lets one item fill a floor.
   */
  newestDefinitions?: number;
}

export interface GameContentManifest {
  id: string;
  name: string;
  description?: string;
  branding?: PackBranding;
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
  /** Sprites that draw their own pixels and may idle (`PixelSprite`), keyed like `spriteRecipes`; a key in both draws from here. */
  pixelSprites?: Record<string, PixelSprite>;
  /** Auras around identified items of a family (`ItemAuraArt`); without it every item shows plain. */
  itemAuras?: ItemAuraArt;
  /** The hero drawn wearing their gear; without it the hero is the `player`/`player_female` sprite. */
  heroSprite?: HeroSpriteArt;
  presetNames?: string[];
  statusHandlers?: Record<string, StatusHandler>;
  actionHooks?: ActionHook[];
  aiBehaviors?: Record<string, AiBehaviorStrategy>;
  aiStrategies?: Record<string, import('../ai/aiRegistry').AIStrategy>;
  combatConfig?: CombatConfig;
  progressionConfig?: ProgressionConfig;
  /** Zone-tiered, difficulty-scaled monster power (ARCHITECTURE.md §3). When omitted,
   * `dungeon/spawner.ts`'s monster-scaling functions fall back to the flat per-floor curve. */
  monsterScaling?: MonsterScalingConfig;
  /** How coin piles are minted, by floor: ground piles, chest coins and the boss hoard
   * (`mintCoinPile`). When omitted, `spawnFloorCurrency`'s built-in table applies. */
  coinage?: CoinageDefinition;
  /**
   * The item families (Blessed, Cursed, …) floor and monster loot roll, with their tiers and
   * per-game counts (`rollItemFamily`, ADR-0012). When omitted, every item is Normal.
   */
  itemFamilies?: ItemFamilyConfig;
  /** Floor loot volume: per-room drop and chest chances, chest size, the newest-item rule. */
  loot?: LootRatesDefinition;
  initialWorldState?: WorldState;
  /** Names and "met" rules for the factions in `initialWorldState.factions` (`FactionDefinition`). */
  factions?: FactionDefinition[];
  /** World counter the pack keeps the deepest floor reached in, read by the Story's descent line. */
  deepestFloorCounter?: string;
  choices?: Record<string, ChoiceDefinition>;
  /** Optional magic systems: mana overflow, grimoire grid, kill rites, altars (`magic/magicConfig.ts`). */
  magic?: import('../magic/magicConfig').MagicSystemConfig;
  pacts?: RunPactDefinition[];
  /**
   * The town NPC (by id) who seals and renounces pacts. When set, pacts change only in
   * that NPC's dialog (the `pact_toggle` command) and the Pacts tab only reports them;
   * without it the Pacts tab seals and renounces them itself.
   */
  pactKeeperNpcId?: string;
  /** A short, dismissible hint the first time each system is met; a system without one shows none. */
  firstTimeHints?: Partial<Record<FirstTimeHintId, FirstTimeHintDefinition>>;
  traps?: TrapDefinition[];
  /** How many of `traps` each generated floor hides; absent, floors hide none. */
  trapPlacement?: TrapPlacementConfig;
  tiles?: TileDefinition[];
  statusEffects?: StatusEffectDefinition[];
  trackedMilestones?: TrackedMilestoneDefinition[];
  /** Verses and lore the hero keeps once found (`LoreEntryDefinition`). */
  loreEntries?: LoreEntryDefinition[];
  renownMilestones?: RenownMilestoneDefinition[];
  renownTitles?: RenownTitleDefinition[];
  companions?: CompanionDefinition[];
  /** Turn-limited world events (ARCHITECTURE.md §3, `TimedEventDefinition`). */
  timedEvents?: TimedEventDefinition[];
  /** The running objective, in story order (`ObjectiveDefinition`). */
  objectives?: ObjectiveDefinition[];
  /** Kill-count-gated choice unlocks (ARCHITECTURE.md §3, `StoryChoiceTrigger`). */
  storyChoiceTriggers?: StoryChoiceTrigger[];
  /** Attribute-threshold-gated choice unlocks (ARCHITECTURE.md §3, `AttributeMilestoneTrigger`). */
  attributeMilestones?: AttributeMilestoneTrigger[];
  /** Level-gated choice unlocks (`LevelMilestoneTrigger`): cotw's Saga perks. */
  levelMilestones?: LevelMilestoneTrigger[];
  /** The perks a choice may grant (`PerkDefinition`, docs/architecture/content-extensibility.md). */
  perks?: PerkDefinition[];
  /** "Driven off" boss resolutions (ARCHITECTURE.md §3, `BossFleeResolution`). */
  bossFleeResolutions?: BossFleeResolution[];
  /** Monster families for compendium category mastery (`MonsterCategoryDefinition`). */
  monsterCategories?: MonsterCategoryDefinition[];
  /**
   * Pack-neutral wiring for the Rune of Return (docs/architecture/content-extensibility.md). The
   * mechanic (channel timing, banking, mobility, interrupt rules) is fixed engine
   * logic; only presentation and the town refill trigger vary per pack. `undefined`
   * disables the attunement-on-interact hook, but the item/channel mechanic itself
   * still works without it (charges just can't be refilled).
   */
  runeOfReturn?: RuneOfReturnManifestConfig;
  /** Fixed tile placements stamped at specific floor generation (docs/architecture/content-extensibility.md). */
  fixedTilePlacements?: FixedTilePlacement[];
  /** Vault blueprints guaranteed to stamp at specific floors, optionally populated with NPCs. */
  scriptedVaultPlacements?: ScriptedVaultPlacement[];
  /** A scene on the town map before the run proper (`PrologueDefinition`). */
  prologue?: PrologueDefinition;
  /**
   * Faction-standing price tiers applied to merchant buy prices. Absent = flat prices.
   * The first matching tier wins, so list the most extreme tiers first.
   */
  merchantPricing?: MerchantPricingRules;
  /** Per-floor-band procedural room decoration. The first band containing the floor applies. */
  roomDecoration?: RoomDecorationBand[];
  /**
   * Per-floor-band layout strategy (`DungeonGeneratorRegistry` id) and its tuning. The first
   * band containing the floor applies; a quest's explicit `floorGenerators[floor]` still wins.
   */
  floorLayouts?: FloorLayoutBand[];
  /** Procedural floor dimensions in tiles. Default 50x35. */
  floorSize?: { width: number; height: number };
  /** Elemental hazards the run advisor warns about, per floor band. */
  floorHazards?: FloorHazardAdvisory[];
}

/** A band of floors generated by one layout strategy (`GameContentManifest.floorLayouts`). */
export interface FloorLayoutBand {
  minFloor: number;
  maxFloor?: number;
  /** A registered `DungeonGeneratorStrategy` id: 'bsp', 'cavern', 'caverns', 'halls', 'rift', 'lattice', 'warrens', 'spine'. */
  strategy: string;
  /** Strategy tuning; see `dungeon/layout/drafts.ts` for each strategy's keys. */
  params?: Record<string, unknown>;
  /** The room the band's first floor opens in, so a new zone arrives as an event. */
  threshold?: ThresholdRoomDefinition;
}

/**
 * An authored arrival room (`FloorLayoutBand.threshold`). `layout` is rows of layout
 * characters: '#' rock, '.' floor, 'P' pillar, 'B' bars, '+'/"'" doors, '~' water, 'X'
 * chasm, and one '@' where the player arrives (the up stairs). Walkable cells on its edge
 * are its exits. Strategies built on `LayoutStrategy` carve it near their usual start;
 * rooms and corridors ignores it.
 */
export interface ThresholdRoomDefinition {
  layout: string[];
}

/**
 * Procedural room decoration for a band of floors (`GameContentManifest.roomDecoration`).
 * Floors outside every band use the engine defaults: no puddles or fissures, grand-hall
 * colonnades at 0.6, single pillars at 0.5, plain wall partitions.
 */
export interface RoomDecorationBand {
  minFloor: number;
  maxFloor?: number;
  /** Chance per room of a 2x2 shallow-water puddle. */
  puddleChance?: number;
  /** Chance per room of a short chasm fissure; a fissured room gets no other decoration. */
  fissureChance?: number;
  /** Chance per large (9x9+) room of 2x2 corner pillars. Default 0.6. */
  grandHallChance?: number;
  /** Chance per room of four single pillars. Default 0.5. */
  pillarChance?: number;
  /** Chance an interior partition is iron bars rather than wall. Default 0. */
  ironBarsChance?: number;
}

/**
 * An elemental hazard the run advisor warns about when the player descends into a band
 * of floors without resisting `element` (`GameContentManifest.floorHazards`).
 */
export interface FloorHazardAdvisory {
  minFloor: number;
  maxFloor?: number;
  element: ElementType;
  title: string;
  /** `{floor}` is replaced with the target floor number. */
  message: string;
  recommendation: string;
  /** When false, a weak resistance is still reported as a warning, not a danger. Default true. */
  escalateWhenWeak?: boolean;
}

/** An NPC a scripted vault placement puts on one of the vault's `N` layout markers. */
export interface ScriptedVaultNpc {
  id: string;
  name: string;
  role?: NpcRole;
  greeting?: string;
  dialogText?: string;
  /** Talking to the NPC opens this `manifest.choices` key (`NpcConfig.choiceId`). */
  choiceId?: string;
}

/** An NPC a prologue stands on the town map at a fixed tile. */
export interface PrologueNpc extends ScriptedVaultNpc {
  position: Position;
}

/**
 * A short scene played on the town map before the run proper (`GameContentManifest.prologue`,
 * `quest/prologue.ts`). A new run begins with it when its creator asks
 * (`ProfileManager.createCharacter`'s `prologue` option). It runs while `startFlag` is set
 * and `endFlag` is not; the pack's own hooks decide when it is over and call
 * `concludePrologue`, which sets `endFlag`.
 */
export interface PrologueDefinition {
  /** Where the hero stands when the run begins. */
  playerSpawn: Position;
  /** Set when a run begins with the prologue. */
  startFlag: string;
  /** Set by `concludePrologue` when it ends. */
  endFlag: string;
  /** Logged when the run begins, in place of the town's welcome. */
  openingMessage?: string;
  /** Logged when it ends. */
  closingMessage?: string;
  /** While it runs, the town is unlit (seen by the hero's own sight), whatever `town.lit` says. */
  dark?: boolean;
  /** While it runs, damage cannot take the hero below this HP. Absent or 0: they can die. */
  heroHpFloor?: number;
  /** Monsters placed when it begins, each at floor-1 strength, with ids `prologue-monster-<n>`.
   *  Those still on the map when it ends leave with it. */
  monsters?: { definitionId: string; position: Position; /** Already alert when placed: no waking-up line. */ awake?: boolean }[];
  /** NPCs placed when it begins. Those still on the map when it ends leave with it. */
  npcs?: PrologueNpc[];
  /** NPCs placed when it ends, on their tile or the nearest free one. */
  aftermathNpcs?: PrologueNpc[];
  /** Set by the pack once the aftermath's own beat is over (cotw: Hallvard's last words). Until
   *  then, progress choices stay held while the hero is in town, as they are during the scene. */
  aftermathFlag?: string;
}

/** See `GameContentManifest.scriptedVaultPlacements`. */
export interface ScriptedVaultPlacement {
  floor: number;
  vaultId: string;
  /** Filled into the vault's `N` markers in layout (row-major) order. */
  npcs?: ScriptedVaultNpc[];
}

export interface MerchantPriceTier {
  /** Tier applies when standing >= this value. */
  minStanding?: number;
  /** Tier applies when standing <= this value. */
  maxStanding?: number;
  /** Multiplier on the base buy price, e.g. 0.75 for a 25% discount. */
  multiplier: number;
}

/** See `GameContentManifest.merchantPricing`. */
export interface MerchantPricingRules {
  /** Faction whose standing selects the tier. */
  faction: string;
  tiers: MerchantPriceTier[];
}

export interface FixedTilePlacement {
  floor: number;
  tileId: string;
  placement: 'middle_room_center';
  requiresChoiceId?: string;
}

/** See `GameContentManifest.runeOfReturn`. */
export interface RuneOfReturnManifestConfig {
  /** NPC id whose interaction triggers a full, free, instant charge refill (the base
   * pack's dwarven rune-smith at the forge; another pack reskins by pointing this at
   * its own NPC). */
  attunementNpcId?: string;
  /** Pack-provided display names for the three progression tracks, shown wherever
   * presentation names a track (the Character tab, the points log, the discovery card);
   * `resolveBranding` falls back to neutral names. */
  trackNames?: { celerity?: string; weave?: string; mobility?: string };
  /** Location where the Rune of Return is first acquired. */
  acquisition?: { floor: number; vaultId: string };
  /** Where the attunement NPC says the rune lies, completing "<npc> speaks of ...",
   * e.g. "an ancient ice vault on Floor 5". Defaults to a neutral line naming the floor. */
  whereaboutsHint?: string;
}

export type {
  CombatConfig,
  ProgressionConfig,
  AttributeScalingConfig,
  PerkDefinition,
  PerkEffects,
  LevelMilestoneTrigger,
  LevelUpBonus,
  EquipmentSlotDefinition,
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
    const val: unknown = manifest[key];
    if (val !== undefined && val !== null && !Array.isArray(val)) {
      throw new Error(
        `[GameContentManifest] Manifest '${manifest.id}' field '${key}' must be an array when provided.`
      );
    }
  }
}
