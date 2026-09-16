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
} from '../magic/runeOfReturn';

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
  unspentStatPoints?: number;
  runeMastery?: RuneOfReturnMastery;
  runeChannelBankedTurns?: number;
}

const DEFAULT_PLAYER_STATS: CombatStats = {
  hp: 30,
  maxHp: 30,
  attack: 6,
  defense: 2,
};

export const DEFAULT_STARTER_SPELLS: string[] = [];

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
  public unspentStatPoints: number;
  /** Rune of Return progression (ARCHITECTURE.md P-03 stage 3): mastery lives on the
   * player (like an attribute), not the item, so losing/replacing the rune doesn't
   * reset invested points. */
  public runeMastery: RuneOfReturnMastery;
  /** Turns of channel progress banked from the last interrupt (Steadfast Weave). */
  public runeChannelBankedTurns: number;
  public pactMutatorsSupplier?: () => import('../pacts/pactManager').RunPactMutatorRules;

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
    this.gender = config.gender ?? 'male';
    this.difficulty = config.difficulty ?? DEFAULT_DIFFICULTY;
    this.maxFloor = config.maxFloor ?? DIFFICULTY_MAX_FLOORS[this.difficulty];
    this.intelligence = config.intelligence ?? 15;
    this.constitution = config.constitution ?? 15;
    this.dexterity = config.dexterity ?? 15;
    this.maxMana = config.maxMana ?? Math.floor(this.intelligence * 2 + 5);
    this.mana = config.mana ?? this.maxMana;
    this.spellsKnown = config.spellsKnown ? [...config.spellsKnown] : [...DEFAULT_STARTER_SPELLS];
    if (config.quickSpells) {
      this.quickSpells = [...config.quickSpells];
      while (this.quickSpells.length < 10) this.quickSpells.push(null);
    } else {
      this.quickSpells = Array(10).fill(null);
      for (let i = 0; i < Math.min(10, this.spellsKnown.length); i++) {
        this.quickSpells[i] = this.spellsKnown[i];
      }
    }
    this.level = config.level ?? 1;
    this.xp = config.xp ?? 0;
    this.unspentStatPoints = config.unspentStatPoints ?? 0;
    this.progressionConfig = config.progressionConfig;
    this.tutorialFlags = config.tutorialFlags ? { ...config.tutorialFlags } : {};
    this.deepestRecallFloor = config.deepestRecallFloor;
    this.recallPosition = config.recallPosition ? { ...config.recallPosition } : undefined;
    this.runeMastery = config.runeMastery ? { ...config.runeMastery } : defaultRuneMastery();
    this.runeChannelBankedTurns = config.runeChannelBankedTurns ?? 0;
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

      this.maxHp += gains.maxHp ?? 5;
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
        this._maxHp += amount * 2;
        this.hp = Math.min(this.maxHp, this.hp + amount * 2);
        break;
      case 'intelligence':
        this.intelligence += amount;
        this.maxMana += amount * 2;
        this.mana = Math.min(this.maxMana, this.mana + amount * 2);
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

  public learnSpell(spellId: string): boolean {
    if (this.spellsKnown.includes(spellId)) {
      return false;
    }
    this.spellsKnown.push(spellId);
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
    return this.inventory.getEncumbrance(this.strength) !== EncumbranceLevel.Immobilized;
  }

  public override getActionCost(baseCost: number): number {
    return calculateAttribute(this, 'actionCost', { baseCost });
  }
}

