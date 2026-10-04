import type { CombatStats, Position, GameDifficulty } from '../types';
import { DIFFICULTY_MAX_FLOORS, DEFAULT_DIFFICULTY } from '../types';
import { Actor } from './actor';
import { InventoryManager } from '../inventory/inventory-manager';
import { EncumbranceLevel } from '../inventory/encumbrance';
import type { CharacterAttributes, Gender } from '../character/types';
import type { ProgressionConfig, LevelUpBonus } from '../types/manifest';
import type { TutorialFlags } from '../storage/types';
import { calculateAttribute } from '../stats/attributeCalculator';
import {
  defaultRuneMastery,
  allocateRuneMastery as allocateRuneMasteryPoints,
  type RuneOfReturnMastery,
  type RuneOfReturnTrack,
  RUNE_MAX_CHARGES,
} from '../magic/runeOfReturn';
import { EnergyModel, type DualEnergyConfig } from '../actors/energyModel';
import {
  GrimoireMatrixManager,
  type GrimoireSlot,
  type GrimoirePage,
  GRIMOIRE_SIZE,
} from '../magic/grimoireMatrix';

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
  energyModel?: EnergyModel;
  voidDebt?: number;
  grimoire?: GrimoireSlot[];
  grimoirePages?: GrimoirePage[];
  activeGrimoireIndex?: number;
  /** Grimoire slots open to spells; omitted means all nine. */
  grimoireOpenSlots?: number[];
  /** Element each grounded slot was opened with, by slot index. */
  grimoireGrounds?: Record<number, string>;
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
  /** Rune of Return progression (docs/architecture/content-rune-of-return.md): mastery lives on the
   * player (like an attribute), not the item, so losing/replacing the rune doesn't
   * reset invested points. */
  public runeMastery: RuneOfReturnMastery;
  /** Turns of channel progress banked from the last interrupt (Steadfast Weave). */
  public runeChannelBankedTurns: number;
  public hasDiscoveredRune: boolean;
  public runeCharges: number;
  public runeMaxCharges: number;
  declare public pactMutatorsSupplier?: () => import('../pacts/pactManager').RunPactMutatorRules;
  public energyModel?: EnergyModel;
  public voidDebt: number;
  public grimoirePages: GrimoirePage[];
  public activeGrimoireIndex: number;
  /** Slots open to spells on every page; undefined means all nine (saves from before sealing). */
  public grimoireOpenSlots?: number[];
  public grimoireGrounds: Record<number, string>;

  public get grimoire(): GrimoireSlot[] {
    return this.grimoirePages[this.activeGrimoireIndex]?.slots ?? this.grimoirePages[0]?.slots ?? [];
  }

  public set grimoire(slots: GrimoireSlot[]) {
    if (this.grimoirePages[this.activeGrimoireIndex]) {
      this.grimoirePages[this.activeGrimoireIndex].slots = slots;
    }
  }

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
    this.energyModel = config.energyModel;
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
    this.activeGrimoireIndex = config.activeGrimoireIndex ?? 0;
    this.grimoireOpenSlots = config.grimoireOpenSlots ? [...config.grimoireOpenSlots] : undefined;
    this.grimoireGrounds = { ...(config.grimoireGrounds ?? {}) };
    if (config.grimoirePages && config.grimoirePages.length > 0) {
      this.grimoirePages = config.grimoirePages.map((page) => ({
        ...page,
        slots: page.slots.map((s) => ({
          ...s,
          infusedGlyphs: s.infusedGlyphs ? [...s.infusedGlyphs] : undefined,
        })),
      }));
    } else if (config.grimoire) {
      const defaultPages = GrimoireMatrixManager.createDefaultGrimoirePages(this.spellsKnown);
      defaultPages[0].slots = config.grimoire.map((s) => ({
        ...s,
        infusedGlyphs: s.infusedGlyphs ? [...s.infusedGlyphs] : undefined,
      }));
      this.grimoirePages = defaultPages;
    } else {
      this.grimoirePages = GrimoireMatrixManager.createDefaultGrimoirePages(this.spellsKnown, this.grimoireOpenSlots);
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
  } {
    const progression = config ?? this.progressionConfig;
    this.xp += amount;
    let leveledUp = false;
    let totalPointsAwarded = 0;
    let accumulatedGains: LevelUpBonus = {};

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
      this.hp = this.maxHp;
      this.maxMana += gains.maxMana ?? 4;
      this.mana = this.maxMana;

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

  /** Whether a grimoire slot is open to spells (not sealed). */
  public isGrimoireSlotOpen(slotIndex: number): boolean {
    return !this.grimoireOpenSlots || this.grimoireOpenSlots.includes(slotIndex);
  }

  /** Unseals a grimoire slot on every page, grounding it in `element`. */
  public openGrimoireSlot(slotIndex: number, element: string): boolean {
    if (this.isGrimoireSlotOpen(slotIndex) || slotIndex < 0 || slotIndex >= GRIMOIRE_SIZE) return false;
    this.grimoireOpenSlots = [...(this.grimoireOpenSlots ?? []), slotIndex].sort((a, b) => a - b);
    this.grimoireGrounds[slotIndex] = element;
    return true;
  }

  /** Switches the active grimoire page to the specified index. */
  public switchGrimoirePage(index: number): boolean {
    if (index < 0 || index >= this.grimoirePages.length) return false;
    this.activeGrimoireIndex = index;
    return true;
  }

  public learnSpell(spellId: string): boolean {
    if (this.spellsKnown.includes(spellId)) {
      return false;
    }
    this.spellsKnown.push(spellId);
    // Auto-slot into the first empty open grimoire slot on the active page, and the first free quick-cast key
    const emptySlot = this.grimoire.find((s) => s.spellId === null && this.isGrimoireSlotOpen(s.slotIndex));
    if (emptySlot) {
      emptySlot.spellId = spellId;
    }
    const freeQuickSlot = this.quickSpells.indexOf(null);
    if (freeQuickSlot >= 0) {
      this.quickSpells[freeQuickSlot] = spellId;
    }
    return true;
  }

  /** Permanently forgets a spell: removes it from the known list, every grimoire page, and the quick-cast bar. */
  public forgetSpell(spellId: string): void {
    this.spellsKnown = this.spellsKnown.filter((id) => id !== spellId);
    for (const page of this.grimoirePages) {
      for (const slot of page.slots) {
        if (slot.spellId === spellId) slot.spellId = null;
      }
    }
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

  /**
   * Assigns a known spell to a 3x3 grimoire slot (0..8) on the active page (or target page),
   * or clears it with `null`. A page holds one copy of a spell, since a cast draws on only
   * one slot: placing it again moves it.
   */
  public setGrimoireSlot(slotIndex: number, spellId: string | null, pageIndex?: number): boolean {
    if (slotIndex < 0 || slotIndex >= GRIMOIRE_SIZE) return false;
    if (spellId && (!this.spellsKnown.includes(spellId) || !this.isGrimoireSlotOpen(slotIndex))) return false;
    const page = pageIndex !== undefined ? this.grimoirePages[pageIndex] : this.grimoirePages[this.activeGrimoireIndex];
    if (!page || !page.slots[slotIndex]) return false;
    if (spellId) {
      for (const slot of page.slots) if (slot.spellId === spellId) slot.spellId = null;
    }
    page.slots[slotIndex].spellId = spellId;
    return true;
  }

  /** Assigns a spell to a quick-cast slot, or clears the slot with `null`. */
  public setQuickSpell(slotIndex: number, spellId: string | null): void {
    this.quickSpells[slotIndex] = spellId;
  }

  public markTutorialSeen(flag: keyof TutorialFlags): void {
    this.tutorialFlags[flag] = true;
  }

  public initEnergyModel(config?: DualEnergyConfig): EnergyModel {
    if (!this.energyModel) {
      this.energyModel = new EnergyModel(config);
    }
    return this.energyModel;
  }

  public hasEnergyModel(): boolean {
    return this.energyModel !== undefined;
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
    return this.inventory.getEncumbrance(this.strength) !== EncumbranceLevel.Immobilized;
  }

  public override getActionCost(baseCost: number): number {
    return calculateAttribute(this, 'actionCost', { baseCost });
  }
}

