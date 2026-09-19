import type { Entity } from '../entities/entity';
import type { Monster } from '../entities/monster';
import type { GameEngine } from '../engine';
import type { ProfileManager } from '../storage/profile-manager';
import { getPlayerTotalCp } from '../economy/currency';
import { DungeonArc } from './dungeonArc';
import type { QuestStatus } from './types';
import { Leaderboard, type ValhallaEntry } from '../hallOfFame/leaderboard';

export interface GameStateSummary {
  status: QuestStatus;
  entry?: ValhallaEntry;
  causeOfDeath?: string;
  killerName?: string;
}

export class GameStateManager {
  public runStatus: QuestStatus = 'active';
  public deepestFloor = 0;
  public monstersKilled = 0;
  public bossDefeated = false;
  public causeOfDeath = '';
  public killerName = '';
  public onStateChanged?: (status: QuestStatus, summary: GameStateSummary) => void;

  private leaderboard: Leaderboard;

  constructor(leaderboard?: Leaderboard) {
    this.leaderboard = leaderboard ?? new Leaderboard();
  }

  public updateFloor(floor: number): void {
    if (floor > this.deepestFloor) {
      this.deepestFloor = floor;
    }
  }

  public recordMonsterKill(monster: Monster, engine?: GameEngine): void {
    this.monstersKilled += 1;
    const bossId = engine?.manifest?.quest?.bossMonsterId;
    if ((bossId && monster.definitionId === bossId) || monster.definitionId === 'boss-monster') {
      this.bossDefeated = true;
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

    const relicId = quest?.relicItemId ?? 'sun-stone-of-freyr';
    const hasRelic = this.playerCarries(engine, relicId);
    return engine.currentFloor === defaultVictoryFloor && hasRelic ? 'default' : undefined;
  }

  private playerCarries(engine: GameEngine, itemId: string): boolean {
    return (
      engine.player.inventory.primaryPack.getItem(itemId) !== null ||
      engine.player.inventory.paperdoll.getAllEquipped().some((e) => e.item.id === itemId) ||
      DungeonArc.isRelicInPlayerPossession(engine.player)
    );
  }

  /**
   * Triggers the grand victory sequence for the given ending (from
   * `checkVictoryEligible`, or omitted for the legacy single-ending behavior),
   * records champion into the leaderboard, and updates profile status to
   * 'victorious'.
   */
  public triggerVictory(engine: GameEngine, profileManager?: ProfileManager, endingId?: string): ValhallaEntry {
    this.runStatus = 'victorious';
    const p = engine.player;
    const quest = engine.manifest?.quest;
    const ending = endingId ? quest?.endings?.[endingId] : undefined;

    const totalGoldCp = getPlayerTotalCp(p);
    const bonus = ending?.victoryScoreBonus ?? quest?.victoryScoreBonus ?? 5000;
    const score = Leaderboard.calculateScore(p.xp, totalGoldCp, this.deepestFloor, true, bonus);
    const epitaph = ending?.victoryEpitaph ?? quest?.victoryEpitaph ?? `Champion - Recovered the Quest Relic`;

    const entry: ValhallaEntry = {
      id: p.id,
      heroName: p.name,
      gender: p.gender,
      status: 'victorious',
      epitaph,
      level: p.level,
      deepestFloor: this.deepestFloor,
      turns: engine.turnCount,
      xp: p.xp,
      goldCp: totalGoldCp,
      score,
      date: Date.now(),
    };

    this.leaderboard.recordRun(entry);

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
      ending?.victoryDialogue ?? quest?.victoryDialogue ?? '✦✦✦ VICTORY! You have returned with the quest relic! ✦✦✦'
    );
    engine.log(
      `${ending?.championProclamation ?? quest?.championProclamation ?? 'You are proclaimed Champion!'} Final Score: ${score} Points.`
    );

    if (this.onStateChanged) {
      this.onStateChanged('victorious', { status: 'victorious', entry });
    }

    return entry;
  }

  /**
   * Triggers permadeath, records fallen hero into the leaderboard,
   * and updates profile status to 'fallen'.
   */
  public triggerDeath(engine: GameEngine, killer?: Entity, profileManager?: ProfileManager): ValhallaEntry {
    this.runStatus = 'fallen';
    const p = engine.player;
    this.killerName = killer?.name ?? 'Mortal Wounds';
    this.causeOfDeath = `Slain by ${this.killerName} on Floor ${engine.currentFloor}`;
    const totalGoldCp = getPlayerTotalCp(p);
    const score = Leaderboard.calculateScore(p.xp, totalGoldCp, this.deepestFloor, false);

    const entry: ValhallaEntry = {
      id: p.id,
      heroName: p.name,
      gender: p.gender,
      status: 'fallen',
      epitaph: this.causeOfDeath,
      level: p.level,
      deepestFloor: this.deepestFloor,
      turns: engine.turnCount,
      xp: p.xp,
      goldCp: totalGoldCp,
      score,
      date: Date.now(),
    };

    this.leaderboard.recordRun(entry);

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

    if (this.onStateChanged) {
      this.onStateChanged('fallen', {
        status: 'fallen',
        entry,
        causeOfDeath: this.causeOfDeath,
        killerName: this.killerName,
      });
    }

    return entry;
  }
}
