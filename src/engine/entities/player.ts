import type { CombatStats, Position, GameDifficulty } from '../types';
import { DIFFICULTY_MAX_FLOORS, DEFAULT_DIFFICULTY } from '../types';
import { Actor } from './actor';
import { InventoryManager } from '../inventory/inventory-manager';
import { EncumbranceLevel } from '../inventory/encumbrance';
import type { CharacterAttributes, Gender } from '../character/types';
import type { ProgressionConfig, LevelUpBonus, PerkDefinition } from '../types/manifest';
import type { ItemModifier } from '../items/modifiers';
import { productWorn, sumWorn, wearsFlag } from '../items/wornModifiers';
import type { TutorialFlags } from '../storage/types';
import { calculateAttribute } from '../stats/attributeCalculator';
import {
  defaultRuneMastery,
  allocateRuneMastery as allocateRuneMasteryPoints,
  type RuneOfReturnMastery,
  type RuneOfReturnTrack,
  RUNE_MAX_CHARGES,
} from '../magic/runeOfReturn';
import type { GrimoireAxis, GrimoireSystemConfig } from '../magic/magicConfig';
import {
  addExtraSlot,
  assignStat,
  copyGrimoireState,
  createGrimoireState,
  doubleSlotLend,
  forgeSpellElement,
  forgetFromGrimoire,
  learnIntoGrimoire,
  placeSpell,
  reconcileGrimoireState,
  restatGrimoire,
  type ForgeOffer,
  type GrimoireSlotRef,
  type GrimoireState,
  type LearnResult,
  type StatPickOutcome,
} from '../magic/grimoires';
import { copyLearningStoneState, createLearningStoneState, type LearningStoneState } from '../magic/learningStones';

/** Maximum hit points one allocated point of Constitution adds. */
export const HP_PER_CONSTITUTION = 2;
/** Maximum mana one allocated point of Intelligence adds. */
export const MANA_PER_INTELLIGENCE = 2;

export interface PlayerConfig {
  id?: string;
  name?: string;
  gender?: Gender;
  difficulty?: GameDifficulty;
  maxFloor?: number;
  position: Position;
  stats?: CombatStats;
  speed?: number;
  strength?: number;
  intelligence?: number;
  constitution?: number;
  dexterity?: number;
  inventory?: InventoryManager;
  mana?: number;
  maxMana?: number;
  spellsKnown?: string[];
  level?: number;
  xp?: number;
  progressionConfig?: ProgressionConfig;
  tutorialFlags?: TutorialFlags;
  deepestRecallFloor?: number;
  recallPosition?: Position;
  quickSpells?: (string | null)[];
  quickPotions?: (string | null)[];
  unspentStatPoints?: number;
  runeMastery?: RuneOfReturnMastery;
  runeChannelBankedTurns?: number;
  hasDiscoveredRune?: boolean;
  runeCharges?: number;
  runeMaxCharges?: number;
  voidDebt?: number;
  /** Perks held (`manifest.perks`), resolved by the loader from their saved ids. */
  perks?: PerkDefinition[];
  /** The pack's three-grimoire model (`manifest.magic.grimoires`); omitted, the hero has none. */
  grimoireSystem?: GrimoireSystemConfig;
  /** Saved three-grimoire state; omitted under a declared model, it is built from `spellsKnown`. */
  grimoireState?: GrimoireState;
  /** Saved shard-and-stone state (P-34); omitted, the hero has met no stone. */
  learningStones?: LearningStoneState;
}

/** The share of each bar a level-up restores (`ProgressionConfig.levelUpHeal`); 1 without the config. */
export function levelUpHealShare(config: ProgressionConfig | undefined, constitution: number): number {
  const heal = config?.levelUpHeal;
  if (!heal) return 1;
  const above = Math.max(0, constitution - (heal.baseline ?? 10));
  return Math.max(0, Math.min(heal.cap ?? 1, heal.percent + above * (heal.perConstitutionAbove ?? 0)));
}

const DEFAULT_PLAYER_STATS: CombatStats = {
  hp: 30,
  maxHp: 30,
  attack: 6,
  defense: 2,
};

const DEFAULT_STARTER_SPELLS: string[] = [];

export class Player extends Actor {
  declare public inventory: InventoryManager;
  public mana: number;
  public maxMana: number;
  public spellsKnown: string[];
  public level: number;
  public xp: number;
  public intelligence: number;
  public constitution: number;
  public dexterity: number;
  public gender: Gender;
  public difficulty: GameDifficulty;
  public maxFloor: number;
  public progressionConfig?: ProgressionConfig;
  public tutorialFlags: TutorialFlags;
  public deepestRecallFloor?: number;
  public recallPosition?: Position;
  public quickSpells: (string | null)[];
  /**
   * Potion kinds pinned to the HUD's potion row, one per slot, keyed by
   * `potionKindKey`. Undefined until the player (or the HUD's first-run default)
   * pins something, so the HUD can tell "never set" from "deliberately emptied".
   */
  public quickPotions?: (string | null)[];
  public unspentStatPoints: number;
  /** Rune of Return progression (docs/architecture/content-extensibility.md): mastery lives on the
   * player (like an attribute), not the item, so losing/replacing the rune doesn't
   * reset invested points. */
  public runeMastery: RuneOfReturnMastery;
  /** Turns of channel progress banked from the last interrupt (Steadfast Weave). */
  public runeChannelBankedTurns: number;
  public hasDiscoveredRune: boolean;
  public runeCharges: number;
  public runeMaxCharges: number;
  declare public pactMutatorsSupplier?: () => import('../pacts/pactManager').RunPactMutatorRules;
  public voidDebt: number;
  /** A lasting share added to max HP (0.1 is +10%), from a temple blessing (`TempleBlessingEffect`). */
  public maxHpPercentBonus = 0;
  /** The perks held, in the order granted (tracker 3.6). Saved by id; see `perkIds`. */
  private readonly perks: PerkDefinition[] = [];
  /** The perks' effects as modifiers, read beside what the hero wears (`wornModifiers`). */
  public perkModifiers: ItemModifier[] = [];
  /** Ids of the items carried when the stairs were last taken (Lore-Keeper, `identifiesCarriedOnStairs`). */
  public carriedAtStairs: string[] = [];
  /** The pack's three-grimoire model, given by whoever builds the hero; not saved. */
  public readonly grimoireSystem?: GrimoireSystemConfig;
  /** Three-grimoire state (P-29). Kept, though inert, when the pack no longer declares the model. */
  public grimoireState?: GrimoireState;
  /** Shard-and-stone state (P-34): spells shown, stones met, spells read cheaper. */
  public learningStones: LearningStoneState;

  constructor(config: PlayerConfig) {
    super({
      id: config.id ?? 'player',
      name: config.name ?? 'Adventurer',
      type: 'player',
      faction: 'player',
      position: config.position,
      stats: config.stats ?? { ...DEFAULT_PLAYER_STATS },
      speed: config.speed ?? 100,
      strength: config.strength ?? 15,
      inventory: config.inventory,
    });
    this.voidDebt = config.voidDebt ?? 0;
    this.gender = config.gender ?? 'male';
    this.difficulty = config.difficulty ?? DEFAULT_DIFFICULTY;
    this.maxFloor = config.maxFloor ?? DIFFICULTY_MAX_FLOORS[this.difficulty];
    this.intelligence = config.intelligence ?? 15;
    this.constitution = config.constitution ?? 15;
    this.dexterity = config.dexterity ?? 15;
    this.maxMana = config.maxMana ?? Math.floor(this.intelligence * 2 + 5);
    this.mana = config.mana ?? this.maxMana;
    this.spellsKnown = config.spellsKnown ? [...config.spellsKnown] : [...DEFAULT_STARTER_SPELLS];
    this.grimoireSystem = config.grimoireSystem;
    this.grimoireState = config.grimoireState ? copyGrimoireState(config.grimoireState) : undefined;
    this.learningStones = config.learningStones ? copyLearningStoneState(config.learningStones) : createLearningStoneState();
    if (this.grimoireSystem) {
      this.grimoireState ??= createGrimoireState();
      reconcileGrimoireState(this.grimoireSystem, this.grimoireState, this.spellsKnown);
    }
    if (config.quickSpells) {
      this.quickSpells = [...config.quickSpells];
      while (this.quickSpells.length < 10) this.quickSpells.push(null);
    } else {
      this.quickSpells = Array(10).fill(null);
      for (let i = 0; i < Math.min(10, this.spellsKnown.length); i++) {
        this.quickSpells[i] = this.spellsKnown[i];
      }
    }
    if (config.quickPotions) this.quickPotions = [...config.quickPotions];
    this.level = config.level ?? 1;
    this.xp = config.xp ?? 0;
    this.unspentStatPoints = config.unspentStatPoints ?? 0;
    for (const perk of config.perks ?? []) this.grantPerk(perk);
    // A shield beside a two-hander, for a hero whose perks allow it (Giant's Grip).
    this.inventory.paperdoll.shieldBesideTwoHanded = () => wearsFlag(this, 'shieldWithTwoHanded');
    this.progressionConfig = config.progressionConfig;
    this.tutorialFlags = config.tutorialFlags ? { ...config.tutorialFlags } : {};
    this.deepestRecallFloor = config.deepestRecallFloor;
    this.recallPosition = config.recallPosition ? { ...config.recallPosition } : undefined;
    this.runeMastery = config.runeMastery ? { ...config.runeMastery } : defaultRuneMastery();
    this.runeChannelBankedTurns = config.runeChannelBankedTurns ?? 0;
    this.hasDiscoveredRune = config.hasDiscoveredRune ?? false;
    this.runeMaxCharges = config.runeMaxCharges ?? RUNE_MAX_CHARGES;
    this.runeCharges = config.runeCharges !== undefined
      ? Math.max(0, Math.min(config.runeCharges, this.runeMaxCharges))
      : this.runeMaxCharges;
  }

  public get attributes(): CharacterAttributes {
    return {
      strength: this.strength,
      intelligence: this.intelligence,
      constitution: this.constitution,
      dexterity: this.dexterity,
    };
  }

  public getXpRequirement(level: number, config?: ProgressionConfig): number {
    const cfg = config ?? this.progressionConfig;
    if (cfg?.getXpForNextLevel) {
      return cfg.getXpForNextLevel(level);
    }
    if (cfg?.baseXp) {
      const exponent = cfg.xpExponent ?? 1.2;
      return Math.floor(cfg.baseXp * Math.pow(exponent, level - 1));
    }
    return level * 50 + (level - 1) * 25;
  }

  public get xpToNextLevel(): number {
    return this.getXpRequirement(this.level);
  }

  /** The pack's `maxLevel` is reached: no more levels, though `totalXp` still counts. */
  public get isAtLevelCap(): boolean {
    const cap = this.progressionConfig?.maxLevel;
    return cap !== undefined && this.level >= cap;
  }

  /** XP earned over the whole run: what each level reached cost, plus `xp`, which is
   *  only the progress into the current level (it resets at every level-up). */
  public get totalXp(): number {
    let total = this.xp;
    for (let level = 1; level < this.level; level++) total += this.getXpRequirement(level);
    return total;
  }

  public gainXp(
    amount: number,
    config?: ProgressionConfig
  ): {
    leveledUp: boolean;
    newLevel: number;
    statPointsAwarded?: number;
    unspentStatPoints?: number;
    statGains?: LevelUpBonus;
    /** HP and mana the level-ups restored (`ProgressionConfig.levelUpHeal`; in full without it). */
    healed?: number;
    manaRestored?: number;
  } {
    const progression = config ?? this.progressionConfig;
    this.xp += amount;
    let leveledUp = false;
    let totalPointsAwarded = 0;
    let accumulatedGains: LevelUpBonus = {};
    let healed = 0;
    let manaRestored = 0;

    while (true) {
      if (progression?.maxLevel && this.level >= progression.maxLevel) {
        break;
      }
      const needed = this.getXpRequirement(this.level, progression);
      if (this.xp < needed) {
        break;
      }
      this.xp -= needed;
      this.level += 1;

      // Unspent stat point allocation decoupling
      const points = progression?.statPointsPerLevel ?? 3;
      this.unspentStatPoints += points;
      totalPointsAwarded += points;

      const hasCustomGains = Boolean(progression?.statGains);
      const gains: LevelUpBonus = typeof progression?.statGains === 'function'
        ? progression.statGains(this.level)
        : (progression?.statGains ?? {
            maxHp: 5,
            maxMana: 4,
            baseAttack: 1,
            baseDefense: 1,
          });

      // From the base, not the getter: a pact's or item's modifier must not be written into it.
      this.maxHp = this.baseMaxHpValue + (gains.maxHp ?? 5);
      this.maxMana += gains.maxMana ?? 4;
      // The level's heal: the pack's share of each bar (rising with Constitution), else all of it.
      const share = wearsFlag(this, 'levelUpFullHeal') ? 1 : levelUpHealShare(progression, this.constitution);
      const hpBefore = this.hp;
      const manaBefore = this.mana;
      this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * share));
      if (progression?.levelUpHeal?.restoresMana !== false || share === 1) {
        this.mana = Math.min(this.maxMana, this.mana + Math.round(this.maxMana * share));
      }
      healed += this.hp - hpBefore;
      manaRestored += this.mana - manaBefore;

      if (hasCustomGains) {
        if (gains.strength) this.strength += gains.strength;
        if (gains.intelligence) this.intelligence += gains.intelligence;
        if (gains.constitution) this.constitution += gains.constitution;
        if (gains.dexterity) this.dexterity += gains.dexterity;
      }
      this.baseAttack += gains.baseAttack ?? 1;
      this.baseDefense += gains.baseDefense ?? 1;

      accumulatedGains = {
        maxHp: (accumulatedGains.maxHp ?? 0) + (gains.maxHp ?? 5),
        maxMana: (accumulatedGains.maxMana ?? 0) + (gains.maxMana ?? 4),
        strength: (accumulatedGains.strength ?? 0) + (gains.strength ?? 0),
        intelligence: (accumulatedGains.intelligence ?? 0) + (gains.intelligence ?? 0),
        constitution: (accumulatedGains.constitution ?? 0) + (gains.constitution ?? 0),
        dexterity: (accumulatedGains.dexterity ?? 0) + (gains.dexterity ?? 0),
        baseAttack: (accumulatedGains.baseAttack ?? 0) + (gains.baseAttack ?? 1),
        baseDefense: (accumulatedGains.baseDefense ?? 0) + (gains.baseDefense ?? 1),
      };

      leveledUp = true;
    }

    return {
      leveledUp,
      newLevel: this.level,
      statPointsAwarded: leveledUp ? totalPointsAwarded : 0,
      unspentStatPoints: this.unspentStatPoints,
      statGains: leveledUp ? accumulatedGains : undefined,
      healed: leveledUp ? healed : undefined,
      manaRestored: leveledUp ? manaRestored : undefined,
    };
  }

  public allocateAttribute(
    attribute: 'strength' | 'dexterity' | 'constitution' | 'intelligence',
    amount: number = 1
  ): boolean {
    if (amount <= 0 || this.unspentStatPoints < amount) {
      return false;
    }
    this.unspentStatPoints -= amount;
    switch (attribute) {
      case 'strength':
        this.strength += amount;
        break;
      case 'dexterity':
        this.dexterity += amount;
        break;
      case 'constitution':
        this.constitution += amount;
        this._maxHp += amount * HP_PER_CONSTITUTION;
        this.hp = Math.min(this.maxHp, this.hp + amount * HP_PER_CONSTITUTION);
        break;
      case 'intelligence':
        this.intelligence += amount;
        this.maxMana += amount * MANA_PER_INTELLIGENCE;
        this.mana = Math.min(this.maxMana, this.mana + amount * MANA_PER_INTELLIGENCE);
        break;
      default:
        this.unspentStatPoints += amount;
        return false;
    }
    return true;
  }

  /** The Strength the hero carries with: Strength scaled by what it wears (`carryMultiplier`). */
  public get carryStrength(): number {
    return Math.round(this.strength * productWorn(this, 'carryMultiplier'));
  }

  /** The share of max HP what the hero wears and holds adds (`maxHpPercent`; read by `calculateAttribute`). */
  public get wornMaxHpPercent(): number {
    return sumWorn(this, 'maxHpPercent');
  }

  /** Tiles what the hero wears and the perks it holds add to its sight radius (`sightBonus`; ADR-0013). */
  public get sightBonus(): number {
    return sumWorn(this, 'sightBonus');
  }

  /** Raises (or lowers) an attribute for good outside the point pool: a perk's or a story's gift. */
  public modifyAttribute(attribute: 'strength' | 'dexterity' | 'constitution' | 'intelligence', delta: number): void {
    if (delta === 0) return;
    this[attribute] += delta;
    if (attribute === 'constitution') {
      this._maxHp += delta * HP_PER_CONSTITUTION;
      this.hp = Math.max(1, Math.min(this.maxHp, this.hp + Math.max(0, delta) * HP_PER_CONSTITUTION));
    }
    if (attribute === 'intelligence') {
      this.maxMana = Math.max(0, this.maxMana + delta * MANA_PER_INTELLIGENCE);
      this.mana = Math.min(this.maxMana, this.mana + Math.max(0, delta) * MANA_PER_INTELLIGENCE);
    }
  }

  /** Grants a perk; one already held is left alone. Its effects join `perkModifiers` at once. */
  public grantPerk(perk: PerkDefinition): boolean {
    if (this.perks.some((p) => p.id === perk.id)) return false;
    this.perks.push(perk);
    if (perk.effects) {
      this.perkModifiers.push({ id: `perk:${perk.id}`, name: perk.name, alignment: 'positive', category: 'blessed', ...perk.effects });
      for (const status of perk.effects.grantsStatusImmunities ?? []) {
        if (!this.statusImmunities.includes(status)) this.statusImmunities.push(status);
      }
    }
    return true;
  }

  public hasPerk(perkId: string): boolean {
    return this.perks.some((p) => p.id === perkId);
  }

  /** The perks held, in the order granted. */
  public get heldPerks(): readonly PerkDefinition[] {
    return this.perks;
  }

  /** What the save keeps: the ids, resolved against the pack on load. */
  public get perkIds(): string[] {
    return this.perks.map((p) => p.id);
  }

  /** Spends unspent mastery points on a Rune of Return track, from the same pool as
   * `allocateAttribute`. See `allocateRuneMastery` in `magic/runeOfReturn.ts`. */
  public allocateRuneMastery(track: RuneOfReturnTrack, amount: number = 1): boolean {
    return allocateRuneMasteryPoints(this, track, amount);
  }

  public consumeMana(amount: number): boolean {
    if (this.mana < amount) {
      return false;
    }
    this.mana -= amount;
    return true;
  }

  public restoreMana(amount: number): number {
    const prev = this.mana;
    this.mana = Math.min(this.maxMana, this.mana + Math.max(0, amount));
    return this.mana - prev;
  }

  public accrueVoidDebt(amount: number): number {
    this.voidDebt = (this.voidDebt ?? 0) + Math.max(0, amount);
    return this.voidDebt;
  }

  /** Lowers debt by `amount`, never below `floor` (see `lingeringDebtFloor`). */
  public decayVoidDebt(amount: number = 1, floor: number = 0): number {
    const debt = this.voidDebt ?? 0;
    this.voidDebt = Math.max(Math.min(floor, debt), debt - Math.max(0, amount));
    return this.voidDebt;
  }

  public clearVoidDebt(): void {
    this.voidDebt = 0;
  }

  /** The three-grimoire model with its state, when the pack declares it for this hero. */
  private grimoireModel(): { system: GrimoireSystemConfig; state: GrimoireState } | undefined {
    return this.grimoireSystem && this.grimoireState ? { system: this.grimoireSystem, state: this.grimoireState } : undefined;
  }

  /** Spells offered while every slot was full, waiting for the hero to make room. */
  public get pendingSpellOffers(): readonly string[] {
    return this.grimoireState?.offers ?? [];
  }

  public learnSpell(spellId: string): boolean {
    return this.learnSpellResult(spellId).outcome === 'learned';
  }

  /**
   * Learns a spell. Under the three-grimoire model it takes the first free slot, opening a
   * grimoire when the new count of known spells calls for one; with every slot full it is
   * not learned and the outcome is `full`. A spell forgotten this run is never relearned.
   */
  public learnSpellResult(spellId: string): LearnResult {
    if (this.spellsKnown.includes(spellId)) return { outcome: 'known', opened: [] };
    let result: LearnResult = { outcome: 'learned', opened: [] };
    const model = this.grimoireModel();
    if (model) {
      result = learnIntoGrimoire(model.system, model.state, this.spellsKnown, spellId);
      if (result.outcome !== 'learned') return result;
    }
    this.spellsKnown.push(spellId);
    // The first free quick-cast key takes it.
    const freeQuickSlot = this.quickSpells.indexOf(null);
    if (freeQuickSlot >= 0) {
      this.quickSpells[freeQuickSlot] = spellId;
    }
    return result;
  }

  /**
   * Permanently forgets a spell: removes it from the known list and the quick-cast bar.
   * Under the three-grimoire model it leaves its slot and is gone for the run.
   */
  public forgetSpell(spellId: string): void {
    const model = this.grimoireModel();
    if (model && this.spellsKnown.includes(spellId)) forgetFromGrimoire(model.state, spellId);
    this.spellsKnown = this.spellsKnown.filter((id) => id !== spellId);
    this.quickSpells = this.quickSpells.map((id) => (id === spellId ? null : id));
  }

  /**
   * Pins a potion kind to a potion-row slot, or clears it with `null`. A kind lives in
   * one slot at a time: pinning it elsewhere moves it.
   */
  public setQuickPotion(slotIndex: number, kindKey: string | null, slotCount = 4): void {
    const pins = [...(this.quickPotions ?? [])];
    while (pins.length < slotCount) pins.push(null);
    if (slotIndex < 0 || slotIndex >= pins.length) return;
    if (kindKey !== null) {
      for (let i = 0; i < pins.length; i++) if (pins[i] === kindKey) pins[i] = null;
    }
    pins[slotIndex] = kindKey;
    this.quickPotions = pins;
  }

  /** Places a known spell in a slot of an open grimoire; a spell already there swaps into its old slot. */
  public placeGrimoireSpell(spellId: string, slot: GrimoireSlotRef): boolean {
    const model = this.grimoireModel();
    return !!model && placeSpell(model.system, model.state, this.spellsKnown, spellId, slot);
  }

  /** Puts a stat on a grimoire's axis; an axis that already holds one changes only with `replace`. */
  public assignGrimoireStat(grimoireId: string, axis: GrimoireAxis, statId: string, replace = false): StatPickOutcome {
    const model = this.grimoireModel();
    return model ? assignStat(model.system, model.state, { grimoireId, axis, statId }, replace) : 'unknown-grimoire';
  }

  /** Re-picks every axis of one grimoire at once; changes nothing unless the whole pick is valid. */
  public restatGrimoire(grimoireId: string, stats: Partial<Record<GrimoireAxis, string>>): StatPickOutcome {
    const model = this.grimoireModel();
    return model ? restatGrimoire(model.system, model.state, grimoireId, stats) : 'unknown-grimoire';
  }

  /** Adds a slot to an open grimoire, touching one it has. */
  public addGrimoireSlot(slot: GrimoireSlotRef): boolean {
    const model = this.grimoireModel();
    return !!model && addExtraSlot(model.system, model.state, slot);
  }

  /** Doubles what one slot lends to its neighbours, once per slot. */
  public doubleGrimoireSlotLend(slot: GrimoireSlotRef): boolean {
    const model = this.grimoireModel();
    return !!model && doubleSlotLend(model.system, model.state, slot);
  }

  /** Adds an element to a known spell (the forge swaps an earlier forge's; fate's stays). */
  /** Free forges given by choices, waiting for the hero to pick a spell. */
  public get pendingForgeOffers(): readonly ForgeOffer[] {
    return this.grimoireState?.forgeOffers ?? [];
  }

  /** Keeps a free forge for later; false when the hero has no grimoires to forge in. */
  public offerForge(offer: ForgeOffer): boolean {
    const model = this.grimoireModel();
    if (!model) return false;
    model.state.forgeOffers.push({ ...offer });
    return true;
  }

  /** Takes a waiting forge offer away (claimed), by its place in the list. */
  public takeForgeOffer(index: number): ForgeOffer | undefined {
    return this.grimoireModel()?.state.forgeOffers.splice(index, 1)[0];
  }

  public forgeSpell(spellId: string, element: string, fated?: string): boolean {
    const model = this.grimoireModel();
    if (!model || !this.spellsKnown.includes(spellId)) return false;
    forgeSpellElement(model.state, spellId, element, fated);
    return true;
  }

  /** Assigns a spell to a quick-cast slot, or clears the slot with `null`. */
  public setQuickSpell(slotIndex: number, spellId: string | null): void {
    this.quickSpells[slotIndex] = spellId;
  }

  public markTutorialSeen(flag: keyof TutorialFlags): void {
    this.tutorialFlags[flag] = true;
  }

  public override get maxHp(): number {
    return calculateAttribute(this, 'maxHp');
  }

  public override set maxHp(value: number) {
    this._maxHp = value;
  }

  public override get attack(): number {
    return calculateAttribute(this, 'attack');
  }

  public override set attack(value: number) {
    this.baseAttack = value;
  }

  public override get defense(): number {
    return calculateAttribute(this, 'defense');
  }

  public override set defense(value: number) {
    this.baseDefense = value;
  }

  public override canMove(): boolean {
    if (!super.canMove()) return false;
    return this.inventory.getEncumbrance(this.carryStrength) !== EncumbranceLevel.Immobilized;
  }

  public override getActionCost(baseCost: number): number {
    return calculateAttribute(this, 'actionCost', { baseCost });
  }
}

