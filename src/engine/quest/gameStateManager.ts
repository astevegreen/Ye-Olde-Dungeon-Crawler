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
    const bossId = engine?.manifest?.quest?.bossMonsterId ?? 'boss_hrungnir';
    if (monster.definitionId === bossId || (bossId === 'boss_hrungnir' && monster.definitionId === 'boss_hrungnir') || monster.definitionId === 'boss-monster') {
      this.bossDefeated = true;
    }
  }

  /**
   * Checks whether the player currently satisfies the quest victory condition.
   * Condition: Player is back on the victory floor and carrying the quest relic.
   */
  public checkVictoryEligible(engine: GameEngine): boolean {
    if (this.runStatus !== 'active') return false;
    const victoryFloor = engine.manifest?.quest?.victoryFloor ?? 0;
    const relicId = engine.manifest?.quest?.relicItemId ?? 'sun-stone-of-freyr';
    const hasRelic =
      engine.player.inventory.primaryPack.getItem(relicId) !== null ||
      engine.player.inventory.paperdoll.getAllEquipped().some((e) => e.item.id === relicId) ||
      DungeonArc.isRelicInPlayerPossession(engine.player);
    return engine.currentFloor === victoryFloor && hasRelic;
  }

  /**
   * Triggers the grand victory sequence, records champion into the Hall of Valhalla,
   * and updates profile status to 'victorious'.
   */
  public triggerVictory(engine: GameEngine, profileManager?: ProfileManager): ValhallaEntry {
    this.runStatus = 'victorious';
    const p = engine.player;
    const totalGoldCp = getPlayerTotalCp(p);
    const bonus = engine.manifest?.quest?.victoryScoreBonus ?? 5000;
    const score = Leaderboard.calculateScore(p.xp, totalGoldCp, this.deepestFloor, true, bonus);
    const epitaph =
      engine.manifest?.quest?.victoryEpitaph ??
      `Champion - Recovered the Quest Relic`;

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
      engine.manifest?.quest?.victoryDialogue ??
        '✦✦✦ VICTORY! You have returned with the quest relic! ✦✦✦'
    );
    engine.log(
      `${engine.manifest?.quest?.championProclamation ?? 'You are proclaimed Champion!'} Final Score: ${score} Points.`
    );

    if (this.onStateChanged) {
      this.onStateChanged('victorious', { status: 'victorious', entry });
    }

    return entry;
  }

  /**
   * Triggers permadeath, records fallen hero into the Hall of Valhalla,
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
