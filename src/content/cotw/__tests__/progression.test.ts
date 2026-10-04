import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { Monster } from '../../../engine/entities/monster';
import type { GameDifficulty } from '../../../engine/types';
import { cotwManifest } from '../index';
import { COTW_LEVEL_CAP, COTW_PROGRESSION } from '../progression';

/**
 * Q4 "B", Q25 "approved" (tracker 3.1): levels cap at 50; a full clear reaches about 47 on
 * every difficulty, and the last three come from revisiting or the Mead of Suttungr.
 * `npm run balance` measures the same per floor with 20 seeds.
 */
const SEEDS = [8100, 8101, 8102, 8103];
const LAST_FLOOR = 50;

/** XP a full clear offers: the raid and every monster present when floors 1–50 are generated. */
function fullClearXp(seed: number, difficulty: GameDifficulty): number {
  const profiles = new ProfileManager(new MemoryStorage(), cotwManifest);
  const hostileXp = (engine: ReturnType<typeof profiles.createCharacter>['engine']): number =>
    engine.map
      .getAllEntities()
      .filter((e): e is Monster => e instanceof Monster && e.isAlive() && e.faction !== 'player' && e !== engine.companion)
      .reduce((sum, m) => sum + m.xpValue, 0);
  const { engine: raid } = profiles.createCharacter('Saga', { seed, difficulty, prologue: true });
  let xp = hostileXp(raid);
  const { engine } = profiles.createCharacter('Saga', { seed, difficulty });
  engine.onChoiceInteract = undefined;
  for (let floor = 1; floor <= LAST_FLOOR; floor++) {
    engine.changeFloor(floor);
    xp += hostileXp(engine);
  }
  return xp;
}

function levelAfter(xp: number): number {
  const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 1 });
  engine.player.gainXp(xp);
  return engine.player.level;
}

describe('cotw progression (Q4 "B", Q25)', () => {
  it('is the pack’s own: cap 50, XP to the next level rising as level^1.5', () => {
    expect(cotwManifest.progressionConfig).toBe(COTW_PROGRESSION);
    expect(COTW_LEVEL_CAP).toBe(50);
    expect(COTW_PROGRESSION.maxLevel).toBe(50);
    const need = COTW_PROGRESSION.getXpForNextLevel!;
    expect(need(1)).toBe(90);
    expect(need(2)).toBe(255);
    expect(need(10)).toBe(2846);
    expect(need(47)).toBe(28999);
  });

  it('stops at level 50 however much XP comes after', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Saga', { seed: 1 });
    engine.player.gainXp(10_000_000);
    expect(engine.player.level).toBe(50);
    expect(engine.player.isAtLevelCap).toBe(true);
  });

  it.each<GameDifficulty>(['easy', 'medium', 'hard'])('reaches about level 47 on a full clear (%s)', (difficulty) => {
    const levels = SEEDS.map((seed) => levelAfter(fullClearXp(seed, difficulty)));
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    expect(mean, levels.join(', ')).toBeGreaterThanOrEqual(46);
    expect(mean, levels.join(', ')).toBeLessThanOrEqual(48);
  }, 60_000);
});
