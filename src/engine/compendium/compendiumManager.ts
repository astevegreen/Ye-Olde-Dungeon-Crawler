import type {
  CompendiumEntry,
  MonsterMasteryTier,
  SerializedCompendium,
  MasteryPerkId,
  MasteryScope,
} from './types';
import { MASTERY_PERKS, SPECIES_MASTERY_KILLS } from './types';
import type { GameEngine } from '../engine';
import type { MonsterCategoryDefinition } from '../types/manifest';

/** Chosen category-mastery perks, keyed by `MonsterCategoryDefinition.id`. */
export type SerializedCategoryPerks = Record<string, MasteryPerkId>;

function tierForKills(kills: number): MonsterMasteryTier {
  if (kills >= SPECIES_MASTERY_KILLS) return 3;
  if (kills >= 1) return 2;
  return 1;
}

export class CompendiumManager {
  private entries: Map<string, CompendiumEntry> = new Map();
  private categoryPerks: Map<string, MasteryPerkId> = new Map();

  constructor(initialData?: SerializedCompendium, categoryPerks?: SerializedCategoryPerks) {
    if (initialData) {
      this.deserialize(initialData);
    }
    if (categoryPerks) {
      this.deserializeCategoryPerks(categoryPerks);
    }
  }

  /**
   * Records that a monster was encountered (e.g. seen in player's FOV).
   * Advances Tier 0 (Undiscovered) to Tier 1 (Encountered).
   */
  public recordEncounter(
    definitionId: string,
    name?: string,
    floor?: number
  ): { advanced: boolean; entry: CompendiumEntry } {
    let entry = this.entries.get(definitionId);

    if (!entry) {
      entry = {
        definitionId,
        name: name ?? definitionId,
        kills: 0,
        tier: 1,
        firstEncounterFloor: floor,
      };
      this.entries.set(definitionId, entry);
      return { advanced: true, entry };
    }

    if (name && entry.name === definitionId) {
      entry.name = name;
    }

    if (entry.tier === 0) {
      entry.tier = 1;
      if (floor !== undefined && entry.firstEncounterFloor === undefined) {
        entry.firstEncounterFloor = floor;
      }
      return { advanced: true, entry };
    }

    return { advanced: false, entry };
  }

  /**
   * Records a kill for a monster type.
   * Increments kill count and updates mastery tier:
   * - 1st kill: Advances to Tier 2 (First Slain).
   * - `SPECIES_MASTERY_KILLS`th kill: Advances to Tier 3 (Mastered).
   */
  public recordKill(
    definitionId: string,
    name?: string
  ): {
    kills: number;
    tier: MonsterMasteryTier;
    previousTier: MonsterMasteryTier;
    tierAdvanced: boolean;
  } {
    let entry = this.entries.get(definitionId);

    if (!entry) {
      entry = {
        definitionId,
        name: name ?? definitionId,
        kills: 0,
        tier: 1,
      };
      this.entries.set(definitionId, entry);
    }

    if (name && entry.name === definitionId) {
      entry.name = name;
    }

    const previousTier = entry.tier;
    entry.kills += 1;

    const earned = tierForKills(entry.kills);
    const tierAdvanced = earned > entry.tier;
    if (tierAdvanced) {
      entry.tier = earned;
    }

    return {
      kills: entry.kills,
      tier: entry.tier,
      previousTier,
      tierAdvanced,
    };
  }

  public getEntry(definitionId: string): CompendiumEntry {
    const existing = this.entries.get(definitionId);
    if (existing) {
      return { ...existing };
    }
    return {
      definitionId,
      name: definitionId,
      kills: 0,
      tier: 0,
    };
  }

  public getAllEntries(): CompendiumEntry[] {
    return Array.from(this.entries.values()).map((e) => ({ ...e }));
  }

  public getTier(definitionId: string): MonsterMasteryTier {
    return this.entries.get(definitionId)?.tier ?? 0;
  }

  public hasMastery(definitionId: string): boolean {
    return this.getTier(definitionId) === 3;
  }

  /** The perk chosen for this monster type's own (species) mastery. */
  public getPerk(definitionId: string): MasteryPerkId | undefined {
    return this.entries.get(definitionId)?.chosenPerk;
  }

  /** The perk chosen for a monster category's mastery. */
  public getCategoryPerk(categoryId: string): MasteryPerkId | undefined {
    return this.categoryPerks.get(categoryId);
  }

  /** Total kills across a category's members. */
  public getCategoryKills(category: MonsterCategoryDefinition): number {
    let total = 0;
    for (const id of category.members) {
      total += this.entries.get(id)?.kills ?? 0;
    }
    return total;
  }

  public hasCategoryMastery(category: MonsterCategoryDefinition): boolean {
    return this.getCategoryKills(category) >= category.masteryKills;
  }

  /** Initial selection is allowed anywhere; changing an existing choice only in town. */
  public selectPerk(
    definitionId: string,
    perkId: MasteryPerkId,
    inTown: boolean
  ): { success: boolean; reason?: string } {
    const entry = this.entries.get(definitionId);
    if (!entry || entry.tier < 3) {
      return {
        success: false,
        reason: `Slay this creature ${SPECIES_MASTERY_KILLS} times to master it and choose a perk.`,
      };
    }

    if (entry.chosenPerk && entry.chosenPerk !== perkId && !inTown) {
      return {
        success: false,
        reason: 'Mastery perks can only be changed while safely resting in Town.',
      };
    }

    entry.chosenPerk = perkId;
    return { success: true };
  }

  public selectCategoryPerk(
    category: MonsterCategoryDefinition,
    perkId: MasteryPerkId,
    inTown: boolean
  ): { success: boolean; reason?: string } {
    if (!this.hasCategoryMastery(category)) {
      return {
        success: false,
        reason: `Slay ${category.masteryKills} of ${category.name} to master them and choose a perk.`,
      };
    }

    const current = this.categoryPerks.get(category.id);
    if (current && current !== perkId && !inTown) {
      return {
        success: false,
        reason: 'Mastery perks can only be changed while safely resting in Town.',
      };
    }

    this.categoryPerks.set(category.id, perkId);
    return { success: true };
  }

  /** +10% evasion against a monster whose species or category mastery chose Survivor. */
  public getMasteryEvasionBonus(definitionId: string, categoryId?: string): number {
    return this.hasPerk(definitionId, 'survivor', categoryId) ? 0.10 : 0;
  }

  /** Whether `perkId` is active against a monster, via its species or its category mastery. */
  public hasPerk(definitionId: string, perkId: MasteryPerkId, categoryId?: string): boolean {
    if (this.getPerk(definitionId) === perkId) return true;
    return categoryId !== undefined && this.categoryPerks.get(categoryId) === perkId;
  }

  public serialize(): SerializedCompendium {
    const result: SerializedCompendium = {};
    for (const [id, entry] of this.entries.entries()) {
      result[id] = {
        kills: entry.kills,
        tier: entry.tier,
        firstEncounterFloor: entry.firstEncounterFloor,
        chosenPerk: entry.chosenPerk,
        galdrHarvested: entry.galdrHarvested,
      };
    }
    return result;
  }

  public serializeCategoryPerks(): SerializedCategoryPerks {
    return Object.fromEntries(this.categoryPerks.entries());
  }

  public deserialize(data?: SerializedCompendium): void {
    if (!data) return;
    for (const [id, record] of Object.entries(data)) {
      // Tier 3 needs SPECIES_MASTERY_KILLS; a save from when mastery took fewer kills
      // drops back to tier 2 (and loses its perk) until the player earns it again.
      const tier: MonsterMasteryTier =
        record.tier === 3 && record.kills < SPECIES_MASTERY_KILLS ? tierForKills(record.kills) : record.tier;
      const chosenPerk = tier === 3 ? record.chosenPerk : undefined;
      const existing = this.entries.get(id);
      if (existing) {
        existing.kills = record.kills;
        existing.tier = tier;
        existing.firstEncounterFloor = record.firstEncounterFloor ?? existing.firstEncounterFloor;
        existing.chosenPerk = chosenPerk ?? existing.chosenPerk;
        existing.galdrHarvested = record.galdrHarvested ?? existing.galdrHarvested;
      } else {
        this.entries.set(id, {
          definitionId: id,
          name: id,
          kills: record.kills,
          tier,
          firstEncounterFloor: record.firstEncounterFloor,
          chosenPerk,
          galdrHarvested: record.galdrHarvested,
        });
      }
    }
  }

  public recordGaldrHarvest(definitionId: string): void {
    const entry = this.entries.get(definitionId);
    if (!entry) {
      this.entries.set(definitionId, {
        definitionId,
        name: definitionId,
        kills: 0,
        tier: 1,
        galdrHarvested: true,
      });
    } else {
      entry.galdrHarvested = true;
    }
  }

  public isGaldrHarvested(definitionId: string): boolean {
    return Boolean(this.entries.get(definitionId)?.galdrHarvested);
  }

  private deserializeCategoryPerks(data: SerializedCategoryPerks): void {
    for (const [categoryId, perkId] of Object.entries(data)) {
      if (perkId in MASTERY_PERKS) {
        this.categoryPerks.set(categoryId, perkId);
      }
    }
  }
}

/** The category (if any) a monster definition belongs to in the active manifest. */
export function getMonsterCategory(
  engine: GameEngine,
  definitionId: string
): MonsterCategoryDefinition | undefined {
  return engine.manifest?.monsterCategories?.find((c) => c.members.includes(definitionId));
}

/** Whether `perkId` is active against this monster type, via species or category mastery. */
export function hasMasteryPerk(engine: GameEngine, definitionId: string, perkId: MasteryPerkId): boolean {
  if (!engine.compendium) return false;
  return engine.compendium.hasPerk(definitionId, perkId, getMonsterCategory(engine, definitionId)?.id);
}

/** A mastery the player has earned but not yet chosen a perk for. */
export interface PendingMasteryChoice {
  scope: MasteryScope;
  masteryId: string;
  name: string;
}

/** Every earned mastery still waiting on a perk choice, species first. */
export function getPendingMasteryChoices(engine: GameEngine): PendingMasteryChoice[] {
  const compendium = engine.compendium;
  if (!compendium) return [];
  const pending: PendingMasteryChoice[] = [];
  for (const entry of compendium.getAllEntries()) {
    if (entry.tier === 3 && !entry.chosenPerk) {
      pending.push({ scope: 'species', masteryId: entry.definitionId, name: entry.name });
    }
  }
  for (const category of engine.manifest?.monsterCategories ?? []) {
    if (compendium.hasCategoryMastery(category) && !compendium.getCategoryPerk(category.id)) {
      pending.push({ scope: 'category', masteryId: category.id, name: category.name });
    }
  }
  return pending;
}

/**
 * Records a kill toward species and category mastery, logging and emitting
 * `mastery_unlocked` for each mastery the kill completes.
 */
export function recordMasteryKill(engine: GameEngine, definitionId: string, name: string): void {
  const compendium = engine.compendium;
  if (!compendium) return;

  const killRes = compendium.recordKill(definitionId, name);
  if (killRes.tierAdvanced && killRes.tier === 2) {
    engine.log(`*** Slayer's Compendium: You uncovered the affinities and weaknesses of ${name}! ***`);
  } else if (killRes.tierAdvanced && killRes.tier === 3) {
    engine.log(`*** MASTERED! You have slain ${killRes.kills} ${name} — choose a Mastery Perk against them! ***`);
    engine.emitGameEvent({
      type: 'mastery_unlocked',
      turn: engine.turnCount,
      scope: 'species',
      masteryId: definitionId,
      name,
      kills: killRes.kills,
    });
  }

  const category = getMonsterCategory(engine, definitionId);
  if (!category) return;
  const categoryKills = compendium.getCategoryKills(category);
  // Only the kill that crosses the threshold announces it.
  if (categoryKills === category.masteryKills && !compendium.getCategoryPerk(category.id)) {
    engine.log(`*** CATEGORY MASTERED! ${categoryKills} of ${category.name} slain — choose a Mastery Perk against all of them! ***`);
    engine.emitGameEvent({
      type: 'mastery_unlocked',
      turn: engine.turnCount,
      scope: 'category',
      masteryId: category.id,
      name: category.name,
      kills: categoryKills,
    });
  }
}

/**
 * Presentation-facing helper to choose a species or category mastery perk,
 * with the town-only respec rule, a game event, and a log line.
 */
export function selectMasteryPerk(
  engine: GameEngine,
  scope: MasteryScope,
  masteryId: string,
  perkId: MasteryPerkId
): { success: boolean; reason?: string } {
  const compendium = engine.compendium;
  if (!compendium) {
    return { success: false, reason: 'Compendium is unavailable.' };
  }

  const inTown = engine.currentFloor === 0;
  let targetName: string;
  let result: { success: boolean; reason?: string };
  if (scope === 'category') {
    const category = engine.manifest?.monsterCategories?.find((c) => c.id === masteryId);
    if (!category) return { success: false, reason: 'Unknown monster category.' };
    targetName = category.name;
    result = compendium.selectCategoryPerk(category, perkId, inTown);
  } else {
    targetName = compendium.getEntry(masteryId).name;
    result = compendium.selectPerk(masteryId, perkId, inTown);
  }

  if (result.success) {
    engine.log(`*** Mastery Perk: ${MASTERY_PERKS[perkId].name} against ${targetName}! ***`);
    engine.emitGameEvent({
      type: 'mastery_perk_selected',
      turn: engine.turnCount,
      scope,
      masteryId,
      perkId,
    });
  }
  return result;
}
