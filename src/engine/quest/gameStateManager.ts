import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { ProfileManager } from '../storage/profile-manager';
import { getPlayerTotalCp } from '../economy/currency';
import { DungeonArc } from './dungeonArc';
import { QUEST_RELIC_ID, type QuestStatus } from './types';
import { Leaderboard, type HallOfFameEntry } from '../hallOfFame/leaderboard';

export interface GameStateSummary {
  status: QuestStatus;
  entry?: HallOfFameEntry;
  causeOfDeath?: string;
  killerName?: string;
  /** The quest ending reached, when the run was won through a named ending. */
  endingId?: string;
}

export class GameStateManager {
  public runStatus: QuestStatus = 'active';
  public deepestFloor = 0;
  public causeOfDeath = '';
  public killerName = '';
  public onStateChanged?: (status: QuestStatus, summary: GameStateSummary) => void;

  private leaderboard: Leaderboard;
  /** The run's Hall of Legends entry once it has ended: a second end returns it, records nothing. */
  private lastEntry?: HallOfFameEntry;

  constructor(leaderboard?: Leaderboard) {
    this.leaderboard = leaderboard ?? new Leaderboard();
  }

  public updateFloor(floor: number): void {
    if (floor > this.deepestFloor) {
      this.deepestFloor = floor;
    }
  }

  /**
   * Checks whether the player currently satisfies the quest victory condition, and
   * if so, which one — a quest may declare several named `endings` (ARCHITECTURE.md
   * §3), checked in insertion order; a quest with no `endings` map falls back to the
   * single legacy relic-at-victory-floor condition (`'default'`). Returns the
   * matching ending id, or `undefined` if none is satisfied yet.
   */
  public checkVictoryEligible(engine: GameEngine): string | undefined {
    if (this.runStatus !== 'active') return undefined;
    const quest = engine.manifest?.quest;
    const defaultVictoryFloor = quest?.victoryFloor ?? 0;

    const endings = quest?.endings;
    if (endings) {
      for (const [id, ending] of Object.entries(endings)) {
        const victoryFloor = ending.victoryFloor ?? defaultVictoryFloor;
        if (engine.currentFloor !== victoryFloor) continue;
        const hasRelic = ending.relicItemId ? this.playerCarries(engine, ending.relicItemId) : false;
        const hasFlag = ending.requiredFlag ? engine.getWorldFlag(ending.requiredFlag) : false;
        const hasKill = ending.requiredMonsterKillId
          ? engine.compendium.getEntry(ending.requiredMonsterKillId).kills >= 1
          : false;
        if (
          (ending.relicItemId && hasRelic) ||
          (ending.requiredFlag && hasFlag) ||
          (ending.requiredMonsterKillId && hasKill)
        ) {
          return id;
        }
      }
      return undefined;
    }

    const relicId = quest?.relicItemId ?? QUEST_RELIC_ID;
    const hasRelic = this.playerCarries(engine, relicId);
    return engine.currentFloor === defaultVictoryFloor && hasRelic ? 'default' : undefined;
  }

  /** That item (by id, or a copy of its definition) anywhere on the hero, worn, in the pack,
   *  belt or a bag; the quest's default relic does not stand in for another (R-econ-17). */
  private playerCarries(engine: GameEngine, itemId: string): boolean {
    return DungeonArc.isRelicInPlayerPossession(engine.player, itemId);
  }

  /**
   * Triggers the grand victory sequence for the given ending (from
   * `checkVictoryEligible`, or omitted for the legacy single-ending behavior),
   * records champion into the leaderboard, and updates profile status to
   * 'victorious'.
   */
  public triggerVictory(engine: GameEngine, profileManager?: ProfileManager, endingId?: string): HallOfFameEntry {
    if (this.runStatus !== 'active' && this.lastEntry) return this.lastEntry;
    this.runStatus = 'victorious';
    const p = engine.player;
    const quest = engine.manifest?.quest;
    const ending = endingId ? quest?.endings?.[endingId] : undefined;

    const totalGoldCp = getPlayerTotalCp(p);
    const bonus = ending?.victoryScoreBonus ?? quest?.victoryScoreBonus ?? 5000;
    const score = Leaderboard.calculateScore(p.totalXp, totalGoldCp, this.deepestFloor, true, bonus);
    const epitaph = ending?.victoryEpitaph ?? quest?.victoryEpitaph ?? `Champion - Recovered the Quest Relic`;

    const entry: HallOfFameEntry = {
      id: p.id,
      heroName: p.name,
      gender: p.gender,
      status: 'victorious',
      epitaph,
      level: p.level,
      deepestFloor: this.deepestFloor,
      turns: engine.turnCount,
      xp: p.totalXp,
      goldCp: totalGoldCp,
      score,
      date: Date.now(),
    };

    this.leaderboard.recordRun(entry);
    this.lastEntry = entry;

    if (profileManager) {
      const manifest = profileManager.getManifest();
      const prof = manifest.profiles.find((pr) => pr.id === p.id);
      if (prof) {
        prof.questStatus = 'victorious';
        prof.epitaph = epitaph;
        profileManager.saveCharacter(engine, prof);
      }
    }

    engine.log(
      ending?.victoryDialogue ?? quest?.victoryDialogue ?? 'VICTORY! You have returned with the quest relic!'
    );
    engine.log(
      `${ending?.championProclamation ?? quest?.championProclamation ?? 'You are proclaimed Champion!'} Final Score: ${score} Points.`
    );

    const notify = this.onStateChanged;
    if (notify) {
      engine.notifyPresentation('onStateChanged', () => notify('victorious', { status: 'victorious', entry, endingId: ending ? endingId : undefined }));
    }

    return entry;
  }

  /**
   * Triggers permadeath, records fallen hero into the leaderboard,
   * and updates profile status to 'fallen'.
   */
  public triggerDeath(engine: GameEngine, killer?: Entity, profileManager?: ProfileManager, cause?: string): HallOfFameEntry {
    if (this.runStatus !== 'active' && this.lastEntry) return this.lastEntry;
    this.runStatus = 'fallen';
    const p = engine.player;
    // A creature by name, else what killed the hero (`KillContext.cause`: fire, poison, a trap).
    this.killerName = killer?.name ?? cause ?? 'Mortal Wounds';
    this.causeOfDeath = `Slain by ${this.killerName} on Floor ${engine.currentFloor}`;
    const totalGoldCp = getPlayerTotalCp(p);
    const score = Leaderboard.calculateScore(p.totalXp, totalGoldCp, this.deepestFloor, false);

    const entry: HallOfFameEntry = {
      id: p.id,
      heroName: p.name,
      gender: p.gender,
      status: 'fallen',
      epitaph: this.causeOfDeath,
      level: p.level,
      deepestFloor: this.deepestFloor,
      turns: engine.turnCount,
      xp: p.totalXp,
      goldCp: totalGoldCp,
      score,
      date: Date.now(),
    };

    this.leaderboard.recordRun(entry);
    this.lastEntry = entry;

    if (profileManager) {
      const manifest = profileManager.getManifest();
      const prof = manifest.profiles.find((pr) => pr.id === p.id);
      if (prof) {
        prof.questStatus = 'fallen';
        prof.epitaph = this.causeOfDeath;
        profileManager.saveCharacter(engine, prof);
      }
    }

    engine.log(`*** FALLEN IN BATTLE: ${this.causeOfDeath} ***`);
    engine.log(`Your name is etched in the Hall of Legends with ${score} Points.`);

    const notify = this.onStateChanged;
    if (notify) {
      const summary: GameStateSummary = { status: 'fallen', entry, causeOfDeath: this.causeOfDeath, killerName: this.killerName };
      engine.notifyPresentation('onStateChanged', () => notify('fallen', summary));
    }

    return entry;
  }
}
